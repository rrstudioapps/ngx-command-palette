# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com) and the project uses [Semantic Versioning](https://semver.org).

## [0.4.0] - 2026-11-20

### Added

- `hotkey` property on commands: a global key combination (e.g. `'mod+s'`) that runs the command even while the palette is closed. Alt-only combinations are ignored while typing in a text field, because on macOS Alt types special characters. It is shown on the row when `shortcut` is not set.
- `prefixes` option: search modes started by a leading character (e.g. `>` for actions, `/` for routes, or a list of sections). New `CommandPrefix` type and `CommandPaletteService.activePrefix`.
- `pinned` property on commands (boolean, function or signal): pinned commands are listed in a "Pinned" section on top while the search is empty. New `pinned` label and `PINNED_SECTION_ID`.
- `recent.rank: 'frequent'` to order the recents by how often and how recently commands ran (the count halves every 7 days) instead of only by recency. Default unchanged (`'recent'`).
- `prompt` property on action commands: selecting the command opens a second step that asks for a value (the text is passed in `ctx.value`). It shows in the path like a sub-palette, and Back/Backspace leave it. New `prompt` label and `CommandPaletteService.prompt`.

### Fixed

- Light theme: the default color of secondary text (descriptions, hints) is a little darker (`#686872` instead of `#71717a`) so it has at least 4.5:1 contrast on the active row (WCAG AA). It was 4.4:1.
- Highlighted characters no longer get extra spacing when the app has a global style for `mark` (Bootstrap adds a padding).

## [0.3.1] - 2026-11-20

### Changed

- README: refreshed screenshots and demo GIF (now showing a sub-palette), and a shorter, less promotional closing section.

## [0.3.0] - 2026-11-20

### Added

- `maxEmptyResults` option (default 100) to list only the first commands while the search is empty, so the palette opens quickly with thousands of commands.

### Changed

- **Behavior change:** with an empty search at most 100 commands are listed (the rest is found by typing). Set `maxEmptyResults: Infinity` to list them all as before. Apps with fewer than 100 commands are not affected.
- Faster search with thousands of commands (up to about 9 times faster, with the same results): the scoring tables are reused and commands that cannot match are rejected early.

## [0.2.0] - 2026-11-19

### Added

- `filter` option of `provideCommandPalette()` to replace the matching and ranking of local commands.
- `hidden` property on commands (boolean, function or signal) to leave a command out of the list, the search and the recents.
- Sub-palettes: a command with `children` opens a nested list, with a path, a back button, Backspace to go back and screen reader announcements. New `ParentCommand` type, `CommandPaletteService.path` and `back()`, and the `back`, `level` and `submenu` labels.

## [0.1.0] - 2026-11-19

First public release.

### Added

- `<rr-command-palette>` dialog with ⌘K / Ctrl+K toggle (configurable), Esc and click-outside close.
- Fuzzy search with highlighted matches over label, keywords and description.
- Sections, icons (text or template), descriptions, shortcut hints, disabled commands.
- Route and function commands.
- Recent commands in `localStorage`.
- Async `CommandProvider` with debounce, loading state, `AbortSignal` and Observable support.
- `CommandPaletteService`, `injectCommands` and `injectCommandProvider` with automatic cleanup.
- Keyboard navigation, combobox/listbox ARIA pattern, focus trap and restore, live region.
- Light/dark themes with `--rr-cp-*` CSS variables, `prefers-reduced-motion` and `forced-colors` support.
- Custom item and empty-state templates.
