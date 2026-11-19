# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com) and the project uses [Semantic Versioning](https://semver.org).

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
