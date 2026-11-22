// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

// Server-side rendering check in plain Node (no window, no document): imports the built
// library from dist/, renders the palette closed and open, and fails on any error.
// Run `npm run build:lib` first, then `npm run e2e:ssr`.

import '@angular/compiler';
import { Component, inject, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { renderApplication } from '@angular/platform-server';
import {
  CommandPaletteComponent,
  CommandPaletteService,
  provideCommandPalette,
} from '../dist/ngx-command-palette/fesm2022/rrstudioapps-ngx-command-palette.mjs';

if (typeof window !== 'undefined' || typeof document !== 'undefined') {
  throw new Error('This check must run without browser globals');
}

const checks = [];
const check = (name, ok, extra = '') => {
  checks.push(ok);
  console.log(`${ok ? 'ok' : 'FAIL'}: ${name}${ok ? '' : ` ${extra}`}`);
};

function makeApp(open) {
  class App {
    service = inject(CommandPaletteService);
    constructor() {
      this.service.register([
        { id: 'home', label: 'Go home', run: () => undefined },
        { id: 'settings', label: 'Settings', keywords: ['prefs'], run: () => undefined },
      ]);
      if (open) this.service.open();
    }
  }
  Component({
    selector: 'app-root',
    imports: [CommandPaletteComponent],
    template: '<main>page</main><rr-command-palette />',
  })(App);
  return App;
}

async function render(open, extraProviders = []) {
  const App = makeApp(open);
  return renderApplication(
    (context) =>
      bootstrapApplication(
        App,
        {
          providers: [
            provideZonelessChangeDetection(),
            provideRouter([]),
            provideCommandPalette({ recent: { enabled: true }, ...extraProviders }),
          ],
        },
        context,
      ),
    { document: '<!doctype html><html><body><app-root></app-root></body></html>' },
  );
}

try {
  const closed = await render(false);
  check('closed: renders the page', closed.includes('<main>page</main>'));
  check('closed: no dialog in the markup', !closed.includes('role="dialog"'));

  const opened = await render(true);
  check('open: renders the dialog', opened.includes('role="dialog"'), opened.slice(0, 300));
  check('open: renders the commands', opened.includes('Go home') && opened.includes('Settings'));
  check('open: renders the listbox', opened.includes('role="listbox"'));
} catch (e) {
  check('SSR render', false, String(e?.stack ?? e));
}

const passed = checks.filter(Boolean).length;
console.log(`${passed}/${checks.length} checks passed`);
process.exit(passed === checks.length ? 0 : 1);
