// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

import {
  EnvironmentProviders,
  InjectionToken,
  makeEnvironmentProviders,
  type TemplateRef,
} from '@angular/core';
import type { Route } from '@angular/router';

import type { Command } from './command.model';
import { matchCommand, type FuzzyMatch } from './fuzzy';

export type CommandPaletteTheme = 'light' | 'dark' | 'auto';

/** Vertical position of the window: near the top (`--rr-cp-top`) or centered. */
export type CommandPalettePosition = 'top' | 'center';

/** Why the palette closed, as passed to `onClose`. */
export type CommandPaletteCloseReason = 'escape' | 'overlay' | 'run' | 'toggle' | 'api';

/** How a route shows up in the palette (see the `routes` option and `Route.data.commandPalette`). */
export interface CommandPaletteRouteInfo {
  readonly label?: string;
  readonly group?: string;
  readonly description?: string;
  readonly icon?: string | TemplateRef<unknown>;
  readonly keywords?: readonly string[];
}

/** Options of the `routes` option: commands built from the router configuration. */
export interface CommandPaletteRoutesOptions {
  /** Section of the generated commands. Default: `labels.routesGroup`. */
  readonly group?: string;
  /**
   * Return `false` to leave a route out. Called with the route and its full URL, each time the
   * palette opens and in an injection context, so `inject()` works.
   */
  readonly filter?: (route: Route, url: string) => boolean;
  /** Overrides what is shown for a route; return `null` to leave it out. Same rules as `filter`. */
  readonly describe?: (route: Route, url: string) => CommandPaletteRouteInfo | null;
}

/** Texts of the palette, for translations. */
export interface CommandPaletteLabels {
  readonly placeholder: string;
  readonly dialog: string;
  readonly listbox: string;
  readonly empty: string;
  readonly loading: string;
  readonly recent: string;
  readonly pinned: string;
  /** Section of the commands built from the routes (see the `routes` option). */
  readonly routesGroup: string;
  /** Accessible name of the row of prefix hints (see `showPrefixHints`). */
  readonly prefixHints: string;
  /** Hint name of a prefix with `kind: 'action'` and no `label` or `groups`. */
  readonly prefixActions: string;
  /** Hint name of a prefix with `kind: 'route'` and no `label` or `groups`. */
  readonly prefixPages: string;
  /** Announced when a command asks for a value. `{name}` is the command label. */
  readonly prompt: string;
  readonly defaultGroup: string;
  /** Screen reader announcement, `{count}` is replaced by the number of results. */
  readonly results: string;
  /** Same as `results` for exactly one result. Default: `results` is used. */
  readonly resultsOne?: string;
  readonly closeHint: string;
  /** Label of the button that goes back one level of a sub-palette. */
  readonly back: string;
  /** Screen reader announcement when a sub-palette is opened; `{name}` and `{count}` are replaced. */
  readonly level: string;
  /** Same as `level` for exactly one result. Default: `level` is used. */
  readonly levelOne?: string;
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
  /**
   * Name shown in the prefix hints (see `showPrefixHints`). Default: the `groups` joined by a comma,
   * else `labels.prefixActions` or `labels.prefixPages` for a `kind`, else only the prefix.
   */
  readonly label?: string;
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
  /**
   * Turns the recents on or off at runtime (boolean, function or signal; default `true`). While off the
   * section is hidden, the list in memory is empty and executions are neither recorded nor saved. What
   * is already in the storage is kept (use `clearRecent()` to remove it); turning it on again reloads it.
   * `recent: false` disables the feature for good.
   */
  readonly enabled?: boolean | (() => boolean);
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
  /**
   * Whether the shortcut calls `preventDefault()` on the key event. Set it to `false` to let the key
   * reach the browser or other listeners too. Default: `true`.
   */
  readonly shortcutPreventDefault: boolean;
  /**
   * Closes the palette after a command is executed. A command's own `closeOnRun` wins over this.
   * Commands that open a sub-palette or ask for a value never close it. Default: `true`.
   */
  readonly closeOnSelect: boolean;
  /** Called after the palette opened (not when `open()` is called while it is already open). */
  readonly onOpen?: () => void;
  /** Called after the palette closed, with the reason. */
  readonly onClose?: (reason: CommandPaletteCloseReason) => void;
  /**
   * Called after a command ran (or navigated), also for route commands and when the palette stays open.
   * Not called when the command throws or its promise rejects.
   */
  readonly onRun?: (command: Command) => void;
  /**
   * Where the focus goes when the palette closes. `true` (default) gives it back to the element that
   * had it when the palette opened, which is the accessible behavior. `false` does not move it. A
   * function returns the element to focus instead; if it returns `null`, an element that is no longer
   * in the page or throws, the focus goes back to the element that had it before opening.
   */
  readonly restoreFocus: boolean | (() => HTMLElement | null);
  /** Vertical position of the window. `--rr-cp-top` applies to `top`. Default: `top`. */
  readonly position: CommandPalettePosition;
  /**
   * Order of the sections while the search is empty: section ids (`pinned`, `recent`, `g:<group>`,
   * `p:<provider id>`) or group names. Sections not listed keep their usual order after the listed
   * ones, except Pinned and Recent, which stay on top unless listed. Default: none.
   */
  readonly sectionOrder: readonly string[];
  /** `auto` follows `prefers-color-scheme`. Default: `auto`. */
  readonly theme: CommandPaletteTheme;
  /**
   * Builds a navigation command for every route of the router configuration (`true` for the
   * defaults, or an options object). Commands registered by hand win over generated ones with the
   * same id or route. Routes are read each time the palette opens. Default: `false`.
   */
  readonly routes: boolean | CommandPaletteRoutesOptions;
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
  /**
   * Shows the section headings (Recent, Pinned, groups). With `false` they are visually hidden but the
   * groups keep their accessible name. Default: `true`.
   */
  readonly showSectionLabels: boolean;
  /**
   * Shows a row at the bottom with the search modes of `prefixes` (for example `>` Actions, `@`
   * Customers). Selecting one types its prefix; selecting the active one removes it. Hidden inside
   * a sub-palette and while a command asks for a value, and when there are no prefixes. Default: `false`.
   */
  readonly showPrefixHints: boolean;
  /** Shows the close key hint (`labels.closeHint`, Esc) in the search field. Default: `true`. */
  readonly showCloseHint: boolean;
  /** Highlights the characters matched by the search. Default: `true`. */
  readonly highlightMatches: boolean;
  /**
   * Shows the status line (e.g. "3 results", by default only for screen readers) at the bottom of the
   * window, with the class `rr-cp-status`. It stays an `aria-live` region either way. Default: `false`.
   */
  readonly showStatus: boolean;
  /** The static texts (the defaults plus the `labels` object given, if any). */
  readonly labels: CommandPaletteLabels;
  /**
   * Set when `labels` was given as a function or a signal: read reactively on top of `labels`, so
   * signals read inside it (e.g. the current language) update the open palette.
   */
  readonly labelsSource?: () => Partial<CommandPaletteLabels>;
}

export type CommandPaletteOptions = Partial<Omit<CommandPaletteConfig, 'labels'>> & {
  readonly labels?: Partial<CommandPaletteLabels> | (() => Partial<CommandPaletteLabels>);
};

export const DEFAULT_COMMAND_PALETTE_LABELS: CommandPaletteLabels = {
  placeholder: 'Type a command or search…',
  dialog: 'Command palette',
  listbox: 'Commands',
  empty: 'No results found.',
  loading: 'Loading…',
  recent: 'Recent',
  pinned: 'Pinned',
  routesGroup: 'Pages',
  prefixHints: 'Search modes',
  prefixActions: 'Actions',
  prefixPages: 'Pages',
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
  shortcutPreventDefault: true,
  closeOnSelect: true,
  restoreFocus: true,
  position: 'top',
  sectionOrder: [],
  theme: 'auto',
  routes: false,
  recent: { max: 5, storageKey: 'rr-cp:recent' },
  debounceMs: 200,
  maxResults: 50,
  maxEmptyResults: 100,
  filter: matchCommand,
  prefixes: [],
  showSectionLabels: true,
  showPrefixHints: false,
  showCloseHint: true,
  highlightMatches: true,
  showStatus: false,
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
    labels: {
      ...DEFAULT_COMMAND_PALETTE_LABELS,
      ...(typeof options.labels === 'function' ? undefined : options.labels),
    },
    ...(typeof options.labels === 'function' ? { labelsSource: options.labels } : {}),
  };
}

/** The labels in use: the static ones plus whatever a `labels` function returns right now. */
export function currentLabels(config: CommandPaletteConfig): CommandPaletteLabels {
  return config.labelsSource ? { ...config.labels, ...config.labelsSource() } : config.labels;
}

/** Configures the command palette. Optional: without it the defaults are used. */
export function provideCommandPalette(options: CommandPaletteOptions = {}): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: COMMAND_PALETTE_CONFIG, useValue: resolveConfig(options) },
  ]);
}

/** Reports an error thrown (or a promise rejected) while running a command chosen by the user. */
export function reportRunError(error: unknown): void {
  console.error('ngx-command-palette: running the command failed', error);
}

/**
 * Runs a user callback so that an error it throws is reported but never breaks the palette.
 * Promise rejections of async callbacks are reported too.
 */
export function safeCall<A extends unknown[]>(
  name: string,
  callback: ((...args: A) => unknown) | undefined,
  ...args: A
): void {
  if (!callback) return;
  const report = (error: unknown) =>
    console.error(`ngx-command-palette: the ${name} callback threw`, error);
  try {
    const result = callback(...args);
    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      (result as PromiseLike<unknown>).then(undefined, report);
    }
  } catch (error) {
    report(error);
  }
}
