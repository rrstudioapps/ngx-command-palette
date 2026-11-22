# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com) and the project uses [Semantic Versioning](https://semver.org).

## [Unreleased]

### Changed

- Development tooling only: `npm run e2e:ssr` renders the built library with Angular SSR in plain Node, and `npm run e2e:cross` runs the browser checks in Firefox, on a touch phone and at 200% / 400% zoom. Both run in CI. The published package is unchanged.
- Documented that `tslib` (required by the Angular package format and already a dependency of Angular) is the only runtime dependency besides Angular, in the README and CONTRIBUTING. The package description no longer says "zero dependencies".
- Peer dependency range narrowed to Angular 22 (`^22.0.0`), the only major the library is tested against. It may be widened again in a minor release once other versions are tested.

## [0.8.0] - 2026-11-21

### Added

- Behavior options: `closeOnSelect` (default `true`; `false` keeps the palette open after a command runs), `Command.closeOnRun` (per-command override, in both directions; sub-palette parents are not affected) and `shortcutPreventDefault` (default `true`). With `closeOnSelect: false`, a command with `prompt` returns to the list after it runs.
- Event callbacks `onOpen()`, `onClose(reason)` (`'escape' | 'overlay' | 'run' | 'toggle' | 'api'`) and `onRun(command)` (after the command ran or navigated, not when it fails). An error or rejected promise from a callback is reported with `console.error` and never breaks the palette. New exported types `CommandPaletteCloseReason` and `CommandPalettePosition`; `CommandPaletteService.closeWith(reason)`.
- `restoreFocus: boolean | (() => HTMLElement | null)` (default `true`): `false` does not move the focus when the palette closes; a function returns the element to focus, with a fallback to the element that had the focus before opening when it returns `null`, a detached element or throws.
- `position: 'top' | 'center'` (default `'top'`).
- `sectionOrder`: order of the sections while the search is empty, by section id or group name.
- CSS variables for every border, size, spacing and font value that was still fixed: `--rr-cp-gutter`, `--rr-cp-border-width`, `--rr-cp-line-height`, `--rr-cp-search-border`, `--rr-cp-status-border`, `--rr-cp-group-gap`, `--rr-cp-group-border`, `--rr-cp-group-label-*`, `--rr-cp-item-min-height`, `--rr-cp-item-disabled-opacity`, `--rr-cp-icon-size`, `--rr-cp-search-icon-size`, `--rr-cp-back-icon-size`, `--rr-cp-kbd-*`, `--rr-cp-path-*`, `--rr-cp-focus-outline`, `--rr-cp-focus-offset`, `--rr-cp-empty-padding` and `--rr-cp-spinner-*`. Defaults are today's values, so nothing changes unless you set them. The README lists all of them and notes that `inherit` does not work in a CSS variable.

## [0.7.1] - 2026-11-21

### Changed

- Development tooling only: `typescript-eslint` 8.73.0 and `eslint` 10.15.0, which resolve the `minimatch` advisory reported by `npm audit`. The published package is unchanged.

## [0.7.0] - 2026-11-21

### Added

- Display options: `showSectionLabels` (headings stay available to assistive technology when hidden), `showCloseHint`, `highlightMatches` (all default `true`) and `showStatus` (default `false`; shows the status line with the class `rr-cp-status`, still `aria-live`).
- `labels.resultsOne` and `labels.levelOne`: texts for exactly one result, `{count}` and `{name}` replaced. Without them `results` and `level` are used, so nothing changes by default.
- CSS variables for layout and weight: `--rr-cp-search-padding`, `--rr-cp-search-gap`, `--rr-cp-input-height`, `--rr-cp-input-font-size`, `--rr-cp-input-focus-outline`, `--rr-cp-list-padding`, `--rr-cp-item-padding`, `--rr-cp-item-gap`, `--rr-cp-label-weight`, `--rr-cp-match-weight`, `--rr-cp-description-size`, `--rr-cp-description-color`, `--rr-cp-description-opacity`, `--rr-cp-item-active-fg`, `--rr-cp-item-active-shadow`, `--rr-cp-status-padding`, `--rr-cp-status-size`. Their defaults are today's values and live as `var()` fallbacks, so they also work when set on `:root` or `body`.

### Fixed

- The search field now resets `box-shadow`, `border-radius` and `appearance` and has a higher specificity, so global app rules such as `input { box-shadow: … }` or `input[type='text'] { border: … }` no longer change it.

## [0.6.0] - 2026-11-21

### Added

- `labels` accepts a function or a signal returning `Partial<CommandPaletteLabels>`, read reactively: a language change updates the placeholder, status and screen reader texts, section headings (Recent, Pinned) and default group of the open palette. A static object works as before. New `CommandPaletteService.labels` signal and `CommandPaletteConfig.labelsSource`.
- `recent.enabled` option (boolean, function or signal, default `true`): turning it off hides the Recent section, empties the list in memory and stops recording and saving, keeping what is already stored (`clearRecent()` removes it); turning it on reloads the list from the storage. When it starts off nothing is read from the storage. `recent: false` still disables recents for good.

## [0.5.0] - 2026-11-21

### Added

- `shortcutInFields` option (default `true`): with `false`, Ctrl/⌘ shortcuts (the palette's and command `hotkey`s) do not fire while typing in an input, textarea, select or contenteditable.
- `shortcutEnabled` option (boolean, function or signal, default `true`): while `false` the shortcut does not open the palette and the key is left to the page. An open palette can still be closed with it, and `open()` keeps working.
- `recent.storage` option: where recents are saved, any object with synchronous `getItem`, `setItem` and `removeItem` (`localStorage` by default; `sessionStorage` or an in-memory store also fit). New `RecentStorage` type. Errors and missing storage (SSR) are still swallowed.
- Tests and docs for `shortcut: []`, which already turned the shortcut off.

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
