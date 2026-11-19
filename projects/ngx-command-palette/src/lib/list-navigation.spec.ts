// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

import { keyToAction, moveIndex } from './list-navigation';

function key(k: string, mods: Partial<KeyboardEvent> = {}) {
  return {
    key: k,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    ...mods,
  };
}

describe('keyToAction', () => {
  it('maps navigation keys', () => {
    expect(keyToAction(key('ArrowDown'))).toBe('next');
    expect(keyToAction(key('ArrowUp'))).toBe('prev');
    expect(keyToAction(key('Home'))).toBe('first');
    expect(keyToAction(key('End'))).toBe('last');
    expect(keyToAction(key('Enter'))).toBe('select');
    expect(keyToAction(key('Escape'))).toBe('close');
    expect(keyToAction(key('n', { ctrlKey: true }))).toBe('next');
    expect(keyToAction(key('p', { ctrlKey: true }))).toBe('prev');
  });

  it('leaves text editing keys to the input', () => {
    expect(keyToAction(key('a'))).toBeNull();
    expect(keyToAction(key('n'))).toBeNull();
    expect(keyToAction(key('Home', { shiftKey: true }))).toBeNull();
    expect(keyToAction(key('Enter', { isComposing: true }))).toBeNull();
  });
});

describe('moveIndex', () => {
  const none = [false, false, false];

  it('moves and wraps around', () => {
    expect(moveIndex(none, 0, 'next')).toBe(1);
    expect(moveIndex(none, 2, 'next')).toBe(0);
    expect(moveIndex(none, 0, 'prev')).toBe(2);
    expect(moveIndex(none, -1, 'next')).toBe(0);
    expect(moveIndex(none, -1, 'prev')).toBe(2);
  });

  it('goes to first and last', () => {
    expect(moveIndex(none, 1, 'first')).toBe(0);
    expect(moveIndex(none, 1, 'last')).toBe(2);
  });

  it('skips disabled items', () => {
    const disabled = [true, false, true, false, true];
    expect(moveIndex(disabled, -1, 'first')).toBe(1);
    expect(moveIndex(disabled, -1, 'last')).toBe(3);
    expect(moveIndex(disabled, 1, 'next')).toBe(3);
    expect(moveIndex(disabled, 3, 'next')).toBe(1);
    expect(moveIndex(disabled, 1, 'prev')).toBe(3);
  });

  it('returns -1 when nothing is selectable', () => {
    expect(moveIndex([], 0, 'next')).toBe(-1);
    expect(moveIndex([true, true], -1, 'first')).toBe(-1);
    expect(moveIndex([true, true], 0, 'next')).toBe(-1);
  });
});
