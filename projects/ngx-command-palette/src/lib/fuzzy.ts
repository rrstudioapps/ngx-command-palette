// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

import type { Command, HighlightSegment } from './command.model';

export interface FuzzyMatch {
  /** Higher is better. Only meaningful to compare matches of the same query. */
  readonly score: number;
  /** Indices of `text` matched by the query, ascending. */
  readonly indices: readonly number[];
}

// Pesi del punteggio: lettere consecutive e inizi di parola valgono di più, i buchi costano.
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

function isWordStart(text: string, i: number): boolean {
  if (i === 0) return true;
  const prev = text[i - 1];
  if (SEPARATORS.has(prev)) return true;
  // camelCase: minuscola seguita da maiuscola
  const cur = text[i];
  return prev === prev.toLowerCase() && cur !== cur.toLowerCase() && cur === cur.toUpperCase();
}

/**
 * Fuzzy subsequence match: every character of `query` (spaces ignored) must appear in
 * `text` in order. Returns the best scoring alignment or `null`. Case and accent insensitive.
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const q = query.replace(/\s+/g, '').split('').map(fold);
  if (q.length === 0) return { score: 0, indices: [] };
  // Lavora su unità UTF-16: gli indici restano quelli di `text`.
  const t: string[] = [];
  // eslint-disable-next-line @typescript-eslint/prefer-for-of -- for-of scorre i code point e sfaserebbe gli indici
  for (let i = 0; i < text.length; i++) t.push(fold(text[i]));
  const m = q.length;
  const n = t.length;
  if (m > n) return null;

  const NEG = -Infinity;
  // M[i][j]: miglior punteggio con q[i] abbinato a t[j]
  // D[i][j]: miglior punteggio con q[0..i] abbinati entro t[0..j] (con penalità per i caratteri saltati dopo)
  const M: Float64Array[] = [];
  const D: Float64Array[] = [];
  const bonus = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    bonus[j] =
      SCORE_CHAR +
      (isWordStart(text, j) ? BONUS_WORD_START : 0) +
      (j === 0 ? BONUS_STRING_START : 0);
  }

  // Per la ricostruzione: da dove arriva ogni M (consecutivo o salto) e quale k dà ogni D
  const consec: Uint8Array[] = [];
  const Dk: Int32Array[] = [];
  for (let i = 0; i < m; i++) {
    const Mi = new Float64Array(n).fill(NEG);
    const Di = new Float64Array(n).fill(NEG);
    const Ci = new Uint8Array(n);
    const Ki = new Int32Array(n).fill(-1);
    for (let j = i; j < n; j++) {
      if (t[j] === q[i]) {
        if (i === 0) {
          Mi[j] = bonus[j] - PENALTY_LEADING * j;
        } else if (j > 0) {
          const consecutive = M[i - 1][j - 1] + BONUS_CONSECUTIVE;
          const jump = D[i - 1][j - 1];
          if (consecutive >= jump && consecutive > NEG) {
            Mi[j] = consecutive + bonus[j];
            Ci[j] = 1;
          } else if (jump > NEG) {
            Mi[j] = jump + bonus[j];
          }
        }
      }
      const carried = j > 0 ? Di[j - 1] - PENALTY_GAP : NEG;
      if (Mi[j] > NEG && Mi[j] >= carried) {
        Di[j] = Mi[j];
        Ki[j] = j;
      } else if (j > 0) {
        Di[j] = carried;
        Ki[j] = Ki[j - 1];
      }
    }
    M.push(Mi);
    D.push(Di);
    consec.push(Ci);
    Dk.push(Ki);
  }

  // Fine dell'allineamento: il miglior M sull'ultima riga
  let end = -1;
  let best = NEG;
  for (let j = m - 1; j < n; j++) {
    if (M[m - 1][j] > best) {
      best = M[m - 1][j];
      end = j;
    }
  }
  if (end < 0) return null;

  // Ricostruzione degli indici all'indietro
  const indices = new Array<number>(m);
  let j = end;
  for (let i = m - 1; i >= 0; i--) {
    indices[i] = j;
    if (i === 0) break;
    j = consec[i][j] ? j - 1 : Dk[i - 1][j - 1];
  }

  // Piccolo premio alle stringhe corte: a parità di match vince il testo più vicino alla query
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

// Peso dei campi: il label conta di più, poi le keywords, poi la descrizione.
const WEIGHT_KEYWORD = 0.8;
const WEIGHT_DESCRIPTION = 0.5;
/**
 * Qualità minima (punti medi per carattere) per keywords e descrizione: testi lunghi
 * contengono quasi ogni sequenza di lettere sparse, quindi lì servono inizi di parola o lettere vicine.
 */
const MIN_SECONDARY_QUALITY = 4;

function strongEnough(match: FuzzyMatch | null, query: string): match is FuzzyMatch {
  const length = query.replace(/\s+/g, '').length;
  return !!match && length > 0 && match.score / length >= MIN_SECONDARY_QUALITY;
}

/**
 * Matches a command against the query using label, keywords and description.
 * `indices` refer to the label (empty when only keywords/description matched).
 */
export function matchCommand(query: string, command: Command): FuzzyMatch | null {
  const label = fuzzyMatch(query, command.label);
  let best: FuzzyMatch | null = label;
  for (const keyword of command.keywords ?? []) {
    const m = fuzzyMatch(query, keyword);
    if (strongEnough(m, query) && (!best || m.score * WEIGHT_KEYWORD > best.score)) {
      best = { score: m.score * WEIGHT_KEYWORD, indices: label?.indices ?? [] };
    }
  }
  if (command.description) {
    const m = fuzzyMatch(query, command.description);
    if (strongEnough(m, query) && (!best || m.score * WEIGHT_DESCRIPTION > best.score)) {
      best = { score: m.score * WEIGHT_DESCRIPTION, indices: label?.indices ?? [] };
    }
  }
  return best;
}
