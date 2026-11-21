// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';

import type { Command } from './command.model';
import { matchCommand, type FuzzyMatch } from './fuzzy';

export type CommandPaletteTheme = 'light' | 'dark' | 'auto';

/** Texts of the palette, for translations. */
export interface CommandPaletteLabels {
  readonly placeholder: string;
  readonly dialog: string;
  readonly listbox: string;
  readonly empty: string;
  readonly loading: string;
  readonly recent: string;
  readonly pinned: string;
  /** Announced when a command asks for a value. `{name}` is the command label. */
  readonly prompt: string;
  readonly defaultGroup: string;
  /** Screen reader announcement, `{count}` is replaced by the number of results. */
  readonly results: string;
  readonly closeHint: string;
  /** Label of the button that goes back one level of a sub-palette. */
  readonly back: string;
  /** Screen reader announcement when a sub-palette is opened; `{name}` and `{count}` are replaced. */
  readonly level: string;
  /** Screen reader hint added to a command that opens a sub-palette. */
  readonly submenu: string;
}

/**
 * Decides whether `command` matches the search text and how well. Return `null` to hide the
 * command. A higher `score` ranks first; `indices` are the label characters to highlight.
 */
export type CommandFilter = (query: string, command: Command) => FuzzyMatch | null;

/**
 * A mode entered by starting the search with `prefix` (e.g. `>` for actions). The prefix is removed from
 * the search text and only the commands that satisfy every given condition are listed.
 */
export interface CommandPrefix {
  /** Text the search must start with, e.g. `>` or `/`. */
  readonly prefix: string;
  /** Only commands (and async providers) of these sections. */
  readonly groups?: readonly string[];
  /** Only route commands or only commands that run a function. */
  readonly kind?: 'route' | 'action';
}

export interface CommandPaletteRecentOptions {
  /** Max number of recents shown. Default: 5. */
  readonly max?: number;
  /**
   * `recent` (default) lists the last executed commands. `frequent` ranks them by how often and how
   * recently they were executed (the count halves every 7 days), and drops the lowest ranked one
   * when the list is full.
   */
  readonly rank?: 'recent' | 'frequent';
  /** Storage key. Default: `rr-cp:recent`. */
  readonly storageKey?: string;
  /**
   * Where recents are saved. Default: `localStorage` (none during SSR or when it is blocked). Pass
   * `sessionStorage` or any object with the same three synchronous methods, e.g. an in-memory one.
   * Errors thrown by it are swallowed: recents just stay in memory.
   */
  readonly storage?: RecentStorage | null;
}

/** Minimal synchronous storage for recent commands. `localStorage` and `sessionStorage` fit. */
export type RecentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface CommandPaletteConfig {
  /** Shortcut(s) that toggle the palette. Default: `mod+k` (⌘K on macOS, Ctrl+K elsewhere). */
  readonly shortcut: string | readonly string[];
  /**
   * Whether shortcuts that use Ctrl/⌘ still fire while typing in an input, textarea, select or
   * contenteditable (this also applies to command `hotkey`s). Default: `true`.
   */
  readonly shortcutInFields: boolean;
  /**
   * Turns the shortcut off while `false`: it no longer opens the palette (an open palette can still be
   * closed with it), but `open()` keeps working. A function or a signal is read on every key press.
   * Default: `true`.
   */
  readonly shortcutEnabled: boolean | (() => boolean);
  /** `auto` follows `prefers-color-scheme`. Default: `auto`. */
  readonly theme: CommandPaletteTheme;
  /** "Recent" section shown with an empty query; `false` disables it. */
  readonly recent: CommandPaletteRecentOptions | false;
  /** Debounce for async providers, in ms. Default: 200. */
  readonly debounceMs: number;
  /** Max results of local commands for a non-empty query. Default: 50. */
  readonly maxResults: number;
  /**
   * Max commands listed when the search is empty (the "Recent" section is not counted). The rest is
   * still found by searching. Default: 100. Drawing every row slows down the opening when there are
   * thousands of commands; use `Infinity` to list them all.
   */
  readonly maxEmptyResults: number;
  /** Matching and ranking of local commands for a non-empty query. Default: the built-in fuzzy search. */
  readonly filter: CommandFilter;
  /** Search modes triggered by a leading character, e.g. `[{ prefix: '>', kind: 'action' }]`. Default: none. */
  readonly prefixes: readonly CommandPrefix[];
  readonly labels: CommandPaletteLabels;
}

export type CommandPaletteOptions = Partial<Omit<CommandPaletteConfig, 'labels'>> & {
  readonly labels?: Partial<CommandPaletteLabels>;
};

export const DEFAULT_COMMAND_PALETTE_LABELS: CommandPaletteLabels = {
  placeholder: 'Type a command or search…',
  dialog: 'Command palette',
  listbox: 'Commands',
  empty: 'No results found.',
  loading: 'Loading…',
  recent: 'Recent',
  pinned: 'Pinned',
  prompt: '{name}: type a value and press Enter',
  defaultGroup: 'Commands',
  results: '{count} results',
  closeHint: 'Esc',
  back: 'Back',
  level: '{name}: {count} results',
  submenu: 'opens a sub-palette',
};

export const DEFAULT_COMMAND_PALETTE_CONFIG: CommandPaletteConfig = {
  shortcut: 'mod+k',
  shortcutInFields: true,
  shortcutEnabled: true,
  theme: 'auto',
  recent: { max: 5, storageKey: 'rr-cp:recent' },
  debounceMs: 200,
  maxResults: 50,
  maxEmptyResults: 100,
  filter: matchCommand,
  prefixes: [],
  labels: DEFAULT_COMMAND_PALETTE_LABELS,
};

export const COMMAND_PALETTE_CONFIG = new InjectionToken<CommandPaletteConfig>(
  'COMMAND_PALETTE_CONFIG',
  {
    providedIn: 'root',
    factory: () => DEFAULT_COMMAND_PALETTE_CONFIG,
  },
);

/** Merges options with the defaults. */
export function resolveConfig(options: CommandPaletteOptions = {}): CommandPaletteConfig {
  return {
    ...DEFAULT_COMMAND_PALETTE_CONFIG,
    ...options,
    recent:
      options.recent === false
        ? false
        : {
            ...(DEFAULT_COMMAND_PALETTE_CONFIG.recent as CommandPaletteRecentOptions),
            ...options.recent,
          },
    labels: { ...DEFAULT_COMMAND_PALETTE_LABELS, ...options.labels },
  };
}

/** Configures the command palette. Optional: without it the defaults are used. */
export function provideCommandPalette(options: CommandPaletteOptions = {}): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: COMMAND_PALETTE_CONFIG, useValue: resolveConfig(options) },
  ]);
}
