# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com) and the project uses [Semantic Versioning](https://semver.org).

## [1.1.4] - 2026-11-26

### Fixed

- Opening a sub-palette no longer does nothing after an open parent was removed or replaced; when every open parent is removed, the top level (recents, async providers) is back.
- A `hotkey` on a command with `prompt` opens the palette on its value step (before, nothing happened).
- An invalid `hotkey` (e.g. `'ctrl+'`) is logged once and ignored, instead of breaking every shortcut and the rendering of the list.
- With `shortcutInFields: false`, the palette shortcut closes the open palette again, as documented.
- `routes`: a child with an empty path is labelled after its parent (`/settings` is "Settings", not "Home"), and routes with a custom `matcher` are skipped with everything below them, like parameter routes.
- `routes`: a `filter` or `describe` callback that throws is logged and no longer stops the palette from opening.
- An error or rejected promise from a command run by Enter, click or hotkey is logged with a library message instead of becoming an unhandled rejection.
- Async results, or children of a sub-palette, with the same `id` are listed once (the last wins), so keyboard navigation reaches every row.
- A `$` in a command label (e.g. `$$`, `$&`) is announced as written by screen readers.

### Changed

- The component stylesheet is a few bytes smaller (the current path step shares the rule of the path buttons), back under the 8 kB style budget. No visual change and no change to the CSS variables.

## [1.1.3] - 2026-11-25

### Added

- `funding` field in the package metadata and a `FUNDING.yml` for the repository (Ko-fi). No change to the library code or the API.

### Changed

- The live demo got a new look, aligned with https://rrstudio.app, and more to explore: a Recipes page (confirmation step, value prompt, state-based `hidden`, per-command hotkey, async search), a Playground page to restyle the palette with the CSS variables, a "What this page shows" note on each page and more example commands. Demo only: no change to the library code or the API.

## [1.1.2] - 2026-11-24

### Changed

- The component stylesheet is a little smaller: the path buttons and the hint buttons share their common declarations. No visual change and no change to the API or the CSS variables.
- README: the closing section now just points to the author's site, without mentioning other products.

## [1.1.1] - 2026-11-23

### Changed

- The live demo and the author's other projects moved to https://rrstudio.app: the README and the demo now link to the new address (the old one redirects). No change to the library code or the API.

## [1.1.0] - 2026-11-23

### Added

- `routes` option: builds a navigation command for every route of the router configuration (`routes: true`, or `{ group, filter, describe }`). Per route, `data.commandPalette` can hide it (`false`) or set its label, group, description, icon and keywords. Commands registered by hand with the same id or route replace the generated ones. `filter` and `describe` run in an injection context, so they can `inject()`. Off by default.
- `labels.routesGroup` (default "Pages"), the section of the generated commands.
- `showPrefixHints` option: a row at the bottom that lists the search modes of `prefixes` (`>` Actions, `@` Customers…). Each hint is a button that types its prefix, or removes it when it is the active one. Hidden inside a sub-palette, during a value step and without prefixes. Off by default.
- `label` on a prefix, and the labels `prefixHints`, `prefixActions` and `prefixPages`; the CSS variables `--rr-cp-hints-padding`, `--rr-cp-hints-size`, `--rr-cp-hints-border`, `--rr-cp-hints-gap` and `--rr-cp-hint-radius`.

### Changed

- README and demo no longer claim that the author's dashboard templates ship this palette.

## [1.0.0] - 2026-11-22

First stable release. The public API is now stable and follows [Semantic Versioning](https://semver.org): breaking changes only come with a new major version. The library itself is unchanged since 0.8.0, and nothing needs to change when upgrading from it.

### Changed

- Documented that `tslib` (required by the Angular package format and already a dependency of Angular) is the only runtime dependency besides Angular, in the README and CONTRIBUTING. The package description no longer says "zero dependencies".
- Development tooling only: `npm run e2e:ssr` renders the built library with Angular SSR in plain Node, and `npm run e2e:cross` runs the browser checks in Firefox, on a touch phone and at 200% / 400% zoom. Both run in CI. The published package is otherwise unchanged.

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
