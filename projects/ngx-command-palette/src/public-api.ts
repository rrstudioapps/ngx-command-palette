// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

/*
 * Public API of @rrstudioapps/ngx-command-palette
 */

export type {
  ActionCommand,
  Command,
  CommandProvider,
  CommandResult,
  CommandRunContext,
  CommandSection,
  CommandSubscribable,
  HighlightSegment,
  RouteCommand,
} from './lib/command.model';
export {
  COMMAND_PALETTE_CONFIG,
  DEFAULT_COMMAND_PALETTE_CONFIG,
  DEFAULT_COMMAND_PALETTE_LABELS,
  provideCommandPalette,
  type CommandPaletteConfig,
  type CommandPaletteLabels,
  type CommandPaletteOptions,
  type CommandPaletteRecentOptions,
  type CommandPaletteTheme,
} from './lib/config';
export {
  CommandPaletteService,
  RECENT_SECTION_ID,
  injectCommandProvider,
  injectCommands,
} from './lib/command-palette.service';
export { CommandPaletteComponent } from './lib/command-palette.component';
export {
  CommandEmptyTemplate,
  CommandItemTemplate,
  type CommandEmptyContext,
  type CommandItemContext,
} from './lib/templates.directive';
export { fuzzyMatch, highlightSegments, matchCommand, type FuzzyMatch } from './lib/fuzzy';
export {
  formatShortcut,
  isApplePlatform,
  matchesShortcut,
  parseShortcut,
  type ParsedShortcut,
} from './lib/shortcut';
