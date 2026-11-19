// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

import { formatShortcut, isApplePlatform, matchesShortcut, parseShortcut } from './shortcut';

function key(init: Partial<KeyboardEvent> & { key: string }) {
  return { code: '', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...init };
}

describe('parseShortcut', () => {
  it('parses modifiers and key', () => {
    expect(parseShortcut('mod+k')).toEqual({
      key: 'k',
      mod: true,
      ctrl: false,
      meta: false,
      alt: false,
      shift: false,
    });
    expect(parseShortcut('Ctrl + Shift + P')).toMatchObject({ key: 'p', ctrl: true, shift: true });
    expect(parseShortcut('cmd+option+space')).toMatchObject({ key: ' ', meta: true, alt: true });
    expect(parseShortcut('/').key).toBe('/');
  });

  it('throws without a key', () => {
    expect(() => parseShortcut('ctrl+shift')).toThrow();
  });
});

describe('matchesShortcut', () => {
  const modK = parseShortcut('mod+k');

  it('maps mod to Ctrl outside Apple platforms', () => {
    expect(matchesShortcut(key({ key: 'k', ctrlKey: true }), modK, false)).toBe(true);
    expect(matchesShortcut(key({ key: 'k', metaKey: true }), modK, false)).toBe(false);
  });

  it('maps mod to ⌘ on Apple platforms', () => {
    expect(matchesShortcut(key({ key: 'k', metaKey: true }), modK, true)).toBe(true);
    expect(matchesShortcut(key({ key: 'k', ctrlKey: true }), modK, true)).toBe(false);
  });

  it('rejects extra modifiers', () => {
    expect(matchesShortcut(key({ key: 'K', ctrlKey: true, shiftKey: true }), modK, false)).toBe(
      false,
    );
    expect(matchesShortcut(key({ key: 'k', ctrlKey: true, altKey: true }), modK, false)).toBe(
      false,
    );
  });

  it('matches by physical key on non-Latin layouts', () => {
    expect(matchesShortcut(key({ key: 'л', code: 'KeyK', ctrlKey: true }), modK, false)).toBe(true);
  });

  it('matches symbol keys regardless of shift', () => {
    expect(matchesShortcut(key({ key: '?', shiftKey: true }), parseShortcut('?'), false)).toBe(
      true,
    );
  });
});

describe('formatShortcut', () => {
  it('formats for each platform', () => {
    expect(formatShortcut(parseShortcut('mod+k'), true)).toBe('⌘K');
    expect(formatShortcut(parseShortcut('mod+k'), false)).toBe('Ctrl+K');
    expect(formatShortcut(parseShortcut('ctrl+shift+p'), false)).toBe('Ctrl+Shift+P');
  });
});

describe('isApplePlatform', () => {
  it('detects macOS and iOS', () => {
    expect(isApplePlatform({ platform: 'MacIntel' } as Navigator)).toBe(true);
    expect(isApplePlatform({ platform: 'iPhone' } as Navigator)).toBe(true);
    expect(isApplePlatform({ platform: 'Win32' } as Navigator)).toBe(false);
    expect(isApplePlatform(undefined)).toBe(false);
  });
});
