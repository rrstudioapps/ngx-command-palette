# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com) and the project uses [Semantic Versioning](https://semver.org).

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
