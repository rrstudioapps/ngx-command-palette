// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette demo

import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  CommandPaletteService,
  formatShortcut,
  isApplePlatform,
  parseShortcut,
} from '@rrstudioapps/ngx-command-palette';

import { LINKS } from '../shared/data';

@Component({
  selector: 'demo-overview',
  imports: [RouterLink],
  template: `
    <header class="page-head">
      <p class="eyebrow">ngx-command-palette</p>
      <h1>A ⌘K command palette for Angular</h1>
      <p class="lead">
        Fuzzy search, sections, recents, async results and full keyboard support. Standalone,
        signals, zoneless, no dependencies besides Angular.
      </p>
      <div class="actions">
        <button type="button" class="primary" (click)="palette.open()">
          Open the palette <kbd>{{ shortcut }}</kbd>
        </button>
        <a class="button" [href]="links.github" rel="noopener">GitHub</a>
        <a class="button" [href]="links.npm" rel="noopener">npm</a>
      </div>
    </header>

    <section class="grid" aria-label="Things to try">
      <article class="card">
        <h2>Try these</h2>
        <ul>
          <li>Type <code>dk</code>: fuzzy matches “Switch to <b>d</b>ar<b>k</b> theme”.</li>
          <li>Type <code>ada</code>: customers come from a fake API with a 450&nbsp;ms delay.</li>
          <li>Open <em>Projects</em>: page commands appear, and leave when you go away.</li>
          <li>
            Start with <code>&gt;</code> to list actions only, or <code>@</code> for customers.
          </li>
          <li>
            Press <kbd>Alt</kbd> <kbd>T</kbd> with the palette closed: a command can bind its own
            key.
          </li>
          <li>Pick <em>Open customer by id…</em>: it asks for a value, then runs.</li>
          <li>
            The <em>Navigation</em> section is generated from the routes:
            <a routerLink="/routes">see how</a>.
          </li>
          <li>Run a command, then reopen: it shows up under <em>Recent</em>.</li>
          <li>
            Use <kbd>↑</kbd> <kbd>↓</kbd> <kbd>Home</kbd> <kbd>End</kbd> <kbd>Enter</kbd>
            <kbd>Esc</kbd>.
          </li>
        </ul>
      </article>
      <article class="card">
        <h2>Five lines to start</h2>
        <pre tabindex="0"><code>{{ snippet }}</code></pre>
      </article>
    </section>

    <p class="more">Also by rrstudio: <a [href]="links.demos">Angular dashboard templates</a>.</p>
  `,
})
export default class Overview {
  protected readonly palette = inject(CommandPaletteService);
  protected readonly shortcut = formatShortcut(parseShortcut('mod+k'), isApplePlatform());
  protected readonly links = LINKS;
  protected readonly snippet = `// app.config.ts
providers: [provideCommandPalette()]

// app.ts
injectCommands([
  { id: 'settings', label: 'Settings', route: '/settings' },
  { id: 'logout', label: 'Log out', run: () => auth.logout() },
]);

// app.html
<rr-command-palette />`;
}
