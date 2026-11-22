# Contributing

Thanks for your interest! Issues and pull requests are welcome.

## Setup

```bash
npm install
npm start      # demo app with the library sources, http://localhost:4200
```

The demo imports the library from `projects/ngx-command-palette/src`, so changes are live.

## Before opening a pull request

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

For changes to the UI or the keyboard behavior, also run the browser checks (keyboard flows and
axe-core accessibility on the demo, in light and dark). They need a Chromium for `playwright-core`:
`npx playwright-core install chromium`, or `E2E_CHROMIUM=/path/to/chromium`.

```bash
npm run build:demo
npm run e2e
npm run e2e:cross   # also needs Firefox: npx playwright-core install firefox
```

For a change to the library itself, check that it still renders on the server (after `npm run build:lib`):
`npm run e2e:ssr`.

- Keep the library free of runtime dependencies besides Angular. The only exception is `tslib`, which the Angular package format requires; do not add others.
- Add or update unit tests for logic changes (`*.spec.ts` next to the code).
- Keep the palette accessible: check keyboard use and run axe on the demo when you change the template.
- Update `CHANGELOG.md` under an "Unreleased" heading.

## Project layout

- `projects/ngx-command-palette/src/lib/`: the library
  - `fuzzy.ts`, `shortcut.ts`, `list-navigation.ts`, `recent-store.ts`: pure logic, unit tested
  - `command-palette.service.ts`: state (signals), registrations, async providers
  - `command-palette.component.*`: the dialog
- `projects/demo/`: demo application

## Releasing (maintainers)

1. Update the version in `projects/ngx-command-palette/package.json` and `CHANGELOG.md`.
2. Commit, then tag: `git tag v0.1.1 && git push --tags`.
3. The `release` workflow builds, tests and publishes to npm with provenance.
