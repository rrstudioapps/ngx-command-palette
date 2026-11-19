// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

export type NavigationAction = 'next' | 'prev' | 'first' | 'last' | 'select' | 'close';

type KeyLike = Pick<
  KeyboardEvent,
  'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'isComposing'
>;

/** Maps a keydown inside the palette to a list action, or `null` to let the input handle it. */
export function keyToAction(event: KeyLike): NavigationAction | null {
  // During IME composition Enter and arrows belong to the text editor
  if (event.isComposing) return null;
  switch (event.key) {
    case 'ArrowDown':
      return 'next';
    case 'ArrowUp':
      return 'prev';
    case 'Home':
      return event.shiftKey ? null : 'first';
    case 'End':
      return event.shiftKey ? null : 'last';
    case 'PageUp':
      return 'first';
    case 'PageDown':
      return 'last';
    case 'Enter':
      return 'select';
    case 'Escape':
      return 'close';
    // Ctrl+N / Ctrl+P as in Emacs and many palettes (not Ctrl+J/K: Ctrl+K toggles the palette)
    case 'n':
      return event.ctrlKey && !event.metaKey && !event.altKey ? 'next' : null;
    case 'p':
      return event.ctrlKey && !event.metaKey && !event.altKey ? 'prev' : null;
    default:
      return null;
  }
}

/**
 * Index of the next selectable item. `disabled[i]` marks rows that cannot be active.
 * Returns -1 when no item is selectable. `next`/`prev` wrap around.
 */
export function moveIndex(
  disabled: readonly boolean[],
  current: number,
  action: 'next' | 'prev' | 'first' | 'last',
): number {
  const count = disabled.length;
  if (count === 0) return -1;
  const findFrom = (start: number, step: 1 | -1, wrap: boolean): number => {
    for (let n = 0, i = start; n < count; n++, i += step) {
      if (wrap) i = (i + count) % count;
      else if (i < 0 || i >= count) return -1;
      if (!disabled[i]) return i;
    }
    return -1;
  };
  switch (action) {
    case 'first':
      return findFrom(0, 1, false);
    case 'last':
      return findFrom(count - 1, -1, false);
    case 'next':
      return current < 0 ? findFrom(0, 1, false) : findFrom(current + 1, 1, true);
    case 'prev':
      return current < 0 ? findFrom(count - 1, -1, false) : findFrom(current - 1, -1, true);
  }
}
