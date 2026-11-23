// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette demo

import { Component, inject } from '@angular/core';
import { CommandPaletteService } from '@rrstudioapps/ngx-command-palette';

@Component({
  selector: 'demo-routes',
  template: `
    <header class="page-head">
      <h1>How routes become commands</h1>
      <p class="lead">
        The “Navigation” section of this palette is not written by hand: it is built from the router
        configuration with <code>routes</code>. Add a page to your routes and it shows up.
      </p>
      <div class="actions">
        <button type="button" class="primary" (click)="palette.open('nav')">
          Search the pages
        </button>
      </div>
    </header>

    <section class="grid" aria-label="How it works">
      <article class="card">
        <h2>Routes</h2>
        <pre tabindex="0"><code>{{ routesSnippet }}</code></pre>
      </article>
      <article class="card">
        <h2>Setup</h2>
        <pre tabindex="0"><code>{{ configSnippet }}</code></pre>
      </article>
      <article class="card">
        <h2>What is left out</h2>
        <ul>
          <li>Redirects, <code>**</code> and secondary outlets.</li>
          <li>
            Paths with a parameter, like <code>customers/:id</code>: those come from the async
            customer search instead.
          </li>
          <li>Routes with <code>data.commandPalette: false</code>.</li>
          <li>
            Routes inside a <code>loadChildren</code> that is not loaded yet: register those by
            hand.
          </li>
        </ul>
      </article>
    </section>
  `,
})
export default class Routes {
  protected readonly palette = inject(CommandPaletteService);
  protected readonly routesSnippet = `{
  path: 'customers',
  loadComponent: () => import('./customers'),
  title: 'Customers · demo',
  data: {
    commandPalette: {
      label: 'Customers',
      keywords: ['clients', 'accounts'],
    },
  },
},
{ path: 'admin', component: Admin,
  data: { commandPalette: false } }, // hidden`;
  protected readonly configSnippet = `provideCommandPalette({
  routes: {
    group: 'Navigation',
    // runs in an injection context
    describe: (route, url) => ({
      icon: inject(IconRegistry).map().get(ICONS[url]),
    }),
  },
});`;
}
