// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

import type { Command, HighlightSegment } from './command.model';

export interface FuzzyMatch {
  /** Higher is better. Only meaningful to compare matches of the same query. */
  readonly score: number;
  /** Indices of `text` matched by the query, ascending. */
  readonly indices: readonly number[];
}

// Scoring weights: consecutive letters and word starts are worth more, gaps cost.
const SCORE_CHAR = 1;
const BONUS_CONSECUTIVE = 5;
const BONUS_WORD_START = 8;
const BONUS_STRING_START = 4;
const PENALTY_GAP = 1;
const PENALTY_LEADING = 0.2;
const SEPARATORS = new Set([' ', '-', '_', '.', '/', ':', '(', '[', ',']);

/** Lowercase and without accents, one character in → one character out (keeps indices aligned). */
function fold(char: string): string {
  const base = char.normalize('NFD').replace(/\p{M}/gu, '');
  return (base[0] ?? char).toLowerCase();
}

/**
 * Folds a whole string. ASCII (the common case) has no accents, so the native `toLowerCase`
 * does the job and keeps the length; anything else is folded character by character.
 */
function foldText(text: string): string {
  // eslint-disable-next-line no-control-regex -- the range is the ASCII block on purpose
  if (/^[\x00-\x7f]*$/.test(text)) return text.toLowerCase();
  let out = '';
  // eslint-disable-next-line @typescript-eslint/prefer-for-of -- for-of iterates code points and would shift the indices
  for (let i = 0; i < text.length; i++) out += fold(text[i]);
  return out;
}

/** The query without spaces, folded. Do it once per search, not once per command. */
function foldQuery(query: string): string {
  return foldText(query.replace(/\s+/g, ''));
}

function isWordStart(text: string, i: number): boolean {
  if (i === 0) return true;
  const prev = text[i - 1];
  if (SEPARATORS.has(prev)) return true;
  // camelCase: lowercase followed by uppercase
  const cur = text[i];
  return prev === prev.toLowerCase() && cur !== cur.toLowerCase() && cur === cur.toUpperCase();
}

/**
 * Fuzzy subsequence match: every character of `query` (spaces ignored) must appear in
 * `text` in order. Returns the best scoring alignment or `null`. Case and accent insensitive.
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  return matchFolded(foldQuery(query), text);
}

// Scoring tables, reused between calls: matching runs once per command on every keystroke,
// and allocating them each time dominated the cost with thousands of commands.
let tableM = new Float64Array(512);
let tableD = new Float64Array(512);
let tableC = new Uint8Array(512);
let tableK = new Int32Array(512);
let tableB = new Float64Array(128);

function ensureTables(size: number, width: number): void {
  if (tableM.length < size) {
    const length = Math.max(size, tableM.length * 2);
    tableM = new Float64Array(length);
    tableD = new Float64Array(length);
    tableC = new Uint8Array(length);
    tableK = new Int32Array(length);
  }
  if (tableB.length < width) tableB = new Float64Array(Math.max(width, tableB.length * 2));
}

/** `fuzzyMatch` for a query that is already folded (see `foldQuery`). */
function matchFolded(q: string, text: string): FuzzyMatch | null {
  if (q.length === 0) return { score: 0, indices: [] };
  // Work on UTF-16 units so indices stay those of `text`.
  const t = foldText(text);
  const m = q.length;
  const n = t.length;
  if (m > n) return null;
  // Cheap exit before the scoring tables: most commands do not contain the letters in order
  for (let i = 0, from = 0; i < m; i++) {
    from = t.indexOf(q[i], from) + 1;
    if (from === 0) return null;
  }

  const NEG = -Infinity;
  const size = m * n;
  ensureTables(size, n);
  // Row i starts at i * n. M: best score with q[i] matched to t[j].
  // D: best score with q[0..i] matched within t[0..j] (minus a penalty for characters skipped after).
  const M = tableM;
  const D = tableD;
  // For the traceback: where each M comes from (consecutive or jump) and which k gives each D
  const consec = tableC;
  const Dk = tableK;
  M.fill(NEG, 0, size);
  D.fill(NEG, 0, size);
  consec.fill(0, 0, size);
  Dk.fill(-1, 0, size);
  // Computed when a letter matches (always positive, so -1 means "not yet")
  const bonus = tableB;
  bonus.fill(-1, 0, n);
  const bonusAt = (j: number): number =>
    bonus[j] >= 0
      ? bonus[j]
      : (bonus[j] =
          SCORE_CHAR +
          (isWordStart(text, j) ? BONUS_WORD_START : 0) +
          (j === 0 ? BONUS_STRING_START : 0));

  for (let i = 0; i < m; i++) {
    const row = i * n;
    const prev = row - n;
    for (let j = i; j < n; j++) {
      const at = row + j;
      if (t[j] === q[i]) {
        if (i === 0) {
          M[at] = bonusAt(j) - PENALTY_LEADING * j;
        } else if (j > 0) {
          const consecutive = M[prev + j - 1] + BONUS_CONSECUTIVE;
          const jump = D[prev + j - 1];
          if (consecutive >= jump && consecutive > NEG) {
            M[at] = consecutive + bonusAt(j);
            consec[at] = 1;
          } else if (jump > NEG) {
            M[at] = jump + bonusAt(j);
          }
        }
      }
      const carried = j > 0 ? D[at - 1] - PENALTY_GAP : NEG;
      if (M[at] > NEG && M[at] >= carried) {
        D[at] = M[at];
        Dk[at] = j;
      } else if (j > 0) {
        D[at] = carried;
        Dk[at] = Dk[at - 1];
      }
    }
  }

  // End of the alignment: the best M on the last row
  let end = -1;
  let best = NEG;
  const last = (m - 1) * n;
  for (let j = m - 1; j < n; j++) {
    if (M[last + j] > best) {
      best = M[last + j];
      end = j;
    }
  }
  if (end < 0) return null;

  // Rebuild the indices backwards
  const indices = new Array<number>(m);
  let j = end;
  for (let i = m - 1; i >= 0; i--) {
    indices[i] = j;
    if (i === 0) break;
    j = consec[i * n + j] ? j - 1 : Dk[(i - 1) * n + j - 1];
  }

  // Small bonus for short strings: with equal matches the text closest to the query wins
  const score = best - (n - m) * 0.01;
  return { score, indices };
}

/** Splits `text` into matched / unmatched segments for highlighting. */
export function highlightSegments(text: string, indices: readonly number[]): HighlightSegment[] {
  if (indices.length === 0) return text ? [{ text, match: false }] : [];
  const set = new Set(indices);
  const out: HighlightSegment[] = [];
  let buf = '';
  let bufMatch = set.has(0);
  for (let i = 0; i < text.length; i++) {
    const match = set.has(i);
    if (match !== bufMatch && buf) {
      out.push({ text: buf, match: bufMatch });
      buf = '';
    }
    bufMatch = match;
    buf += text[i];
  }
  if (buf) out.push({ text: buf, match: bufMatch });
  return out;
}

// Field weights: label first, then keywords, then description.
const WEIGHT_KEYWORD = 0.8;
const WEIGHT_DESCRIPTION = 0.5;
/**
 * Minimum quality (average points per character) for keywords and description: long texts
 * contain almost any scattered letter sequence, so there we require word starts or close letters.
 */
const MIN_SECONDARY_QUALITY = 4;

function strongEnough(match: FuzzyMatch | null, length: number): match is FuzzyMatch {
  return !!match && length > 0 && match.score / length >= MIN_SECONDARY_QUALITY;
}

/**
 * Matches a command against the query using label, keywords and description.
 * `indices` refer to the label (empty when only keywords/description matched).
 */
export function matchCommand(query: string, command: Command): FuzzyMatch | null {
  const q = foldQuery(query);
  const label = matchFolded(q, command.label);
  let best: FuzzyMatch | null = label;
  for (const keyword of command.keywords ?? []) {
    const m = matchFolded(q, keyword);
    if (strongEnough(m, q.length) && (!best || m.score * WEIGHT_KEYWORD > best.score)) {
      best = { score: m.score * WEIGHT_KEYWORD, indices: label?.indices ?? [] };
    }
  }
  if (command.description) {
    const m = matchFolded(q, command.description);
    if (strongEnough(m, q.length) && (!best || m.score * WEIGHT_DESCRIPTION > best.score)) {
      best = { score: m.score * WEIGHT_DESCRIPTION, indices: label?.indices ?? [] };
    }
  }
  return best;
}
