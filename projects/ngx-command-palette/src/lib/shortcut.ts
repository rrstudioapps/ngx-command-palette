// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

/** A parsed keyboard shortcut such as `mod+k` or `ctrl+shift+p`. */
export interface ParsedShortcut {
  readonly key: string;
  readonly mod: boolean;
  readonly ctrl: boolean;
  readonly meta: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
}

const MODIFIERS: Record<string, keyof Omit<ParsedShortcut, 'key'>> = {
  mod: 'mod',
  ctrl: 'ctrl',
  control: 'ctrl',
  meta: 'meta',
  cmd: 'meta',
  command: 'meta',
  alt: 'alt',
  option: 'alt',
  shift: 'shift',
};

const KEY_ALIASES: Record<string, string> = {
  space: ' ',
  esc: 'escape',
  slash: '/',
  plus: '+',
};

/**
 * Parses a shortcut string. Parts are separated by `+`; `mod` means ⌘ on Apple
 * platforms and Ctrl elsewhere. Examples: `mod+k`, `ctrl+shift+p`, `/`.
 */
export function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut
    .toLowerCase()
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean);
  if (shortcut.trim().endsWith('++') || shortcut.trim() === '+') parts.push('+');
  const result = { key: '', mod: false, ctrl: false, meta: false, alt: false, shift: false };
  for (const part of parts) {
    const modifier = MODIFIERS[part];
    if (modifier) result[modifier] = true;
    else result.key = KEY_ALIASES[part] ?? part;
  }
  if (!result.key) throw new Error(`ngx-command-palette: invalid shortcut "${shortcut}"`);
  return result;
}

/** True on macOS / iOS, where `mod` maps to the ⌘ key. */
export function isApplePlatform(nav: Navigator | undefined = globalThis.navigator): boolean {
  if (!nav) return false;
  const platform =
    (nav as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    nav.platform ??
    '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}

type KeyEventLike = Pick<
  KeyboardEvent,
  'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'
>;

/** True when `event` matches `shortcut`. Letters also match by physical key (non-Latin layouts). */
export function matchesShortcut(
  event: KeyEventLike,
  shortcut: ParsedShortcut,
  apple: boolean,
): boolean {
  const wantCtrl = shortcut.ctrl || (shortcut.mod && !apple);
  const wantMeta = shortcut.meta || (shortcut.mod && apple);
  if (event.ctrlKey !== wantCtrl || event.metaKey !== wantMeta || event.altKey !== shortcut.alt) {
    return false;
  }
  const key = (event.key ?? '').toLowerCase();
  // Shift matters only when requested or for letters ("?" needs Shift, but nobody writes it)
  const isLetter = /^[a-z]$/.test(shortcut.key);
  if ((shortcut.shift || isLetter) && event.shiftKey !== shortcut.shift) return false;
  if (key === shortcut.key) return true;
  // With Alt or non-Latin layouts event.key changes: fall back to the physical key
  if (isLetter && event.code === `Key${shortcut.key.toUpperCase()}`) return true;
  if (/^[0-9]$/.test(shortcut.key) && event.code === `Digit${shortcut.key}`) return true;
  return false;
}

/** Human readable label, e.g. `⌘K` on macOS and `Ctrl+K` elsewhere. */
export function formatShortcut(shortcut: ParsedShortcut, apple: boolean): string {
  const key =
    shortcut.key === ' '
      ? 'Space'
      : shortcut.key.length === 1
        ? shortcut.key.toUpperCase()
        : capitalize(shortcut.key);
  if (apple) {
    return (
      (shortcut.ctrl ? '⌃' : '') +
      (shortcut.alt ? '⌥' : '') +
      (shortcut.shift ? '⇧' : '') +
      (shortcut.meta || shortcut.mod ? '⌘' : '') +
      key
    );
  }
  const parts: string[] = [];
  if (shortcut.ctrl || shortcut.mod) parts.push('Ctrl');
  if (shortcut.meta) parts.push('Win');
  if (shortcut.alt) parts.push('Alt');
  if (shortcut.shift) parts.push('Shift');
  parts.push(key);
  return parts.join('+');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
