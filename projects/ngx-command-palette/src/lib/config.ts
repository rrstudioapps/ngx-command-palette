// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';

export type CommandPaletteTheme = 'light' | 'dark' | 'auto';

/** Texts of the palette, for translations. */
export interface CommandPaletteLabels {
  readonly placeholder: string;
  readonly dialog: string;
  readonly listbox: string;
  readonly empty: string;
  readonly loading: string;
  readonly recent: string;
  readonly defaultGroup: string;
  /** Screen reader announcement, `{count}` is replaced by the number of results. */
  readonly results: string;
  readonly closeHint: string;
}

export interface CommandPaletteRecentOptions {
  /** Max number of recents shown. Default: 5. */
  readonly max?: number;
  /** localStorage key. Default: `rr-cp:recent`. */
  readonly storageKey?: string;
}

export interface CommandPaletteConfig {
  /** Shortcut(s) that toggle the palette. Default: `mod+k` (⌘K on macOS, Ctrl+K elsewhere). */
  readonly shortcut: string | readonly string[];
  /** `auto` follows `prefers-color-scheme`. Default: `auto`. */
  readonly theme: CommandPaletteTheme;
  /** "Recent" section shown with an empty query; `false` disables it. */
  readonly recent: CommandPaletteRecentOptions | false;
  /** Debounce for async providers, in ms. Default: 200. */
  readonly debounceMs: number;
  /** Max results of local commands for a non-empty query. Default: 50. */
  readonly maxResults: number;
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
  defaultGroup: 'Commands',
  results: '{count} results',
  closeHint: 'Esc',
};

export const DEFAULT_COMMAND_PALETTE_CONFIG: CommandPaletteConfig = {
  shortcut: 'mod+k',
  theme: 'auto',
  recent: { max: 5, storageKey: 'rr-cp:recent' },
  debounceMs: 200,
  maxResults: 50,
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
