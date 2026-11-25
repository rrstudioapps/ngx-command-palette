// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette demo

import { Component, computed, inject, signal } from '@angular/core';
import {
  type Command,
  CommandPaletteService,
  injectCommandProvider,
  injectCommands,
} from '@rrstudioapps/ngx-command-palette';

import { IconRegistry } from '../shared/icons';
import { DemoNote } from '../shared/note';

const DOCS = [
  { slug: 'prefixes', title: 'Prefix modes', text: 'Restrict the search with > or @' },
  { slug: 'subpalettes', title: 'Sub-palettes', text: 'Commands with children' },
  { slug: 'providers', title: 'Async providers', text: 'Results loaded on demand' },
  { slug: 'theming', title: 'Theming', text: 'CSS variables, light and dark' },
  { slug: 'a11y', title: 'Accessibility', text: 'Combobox and listbox semantics' },
];

interface Recipe {
  readonly title: string;
  readonly text: string;
  /** Text typed in the palette by the "Try it" button. */
  readonly query: string;
  readonly code: string;
}

const RECIPES: readonly Recipe[] = [
  {
    title: 'Confirm a destructive action',
    text: 'A command with children opens a sub-palette: use it as a confirmation step.',
    query: 'delete',
    code: `{
  id: 'delete', label: 'Delete workspace…',
  children: [
    { id: 'yes', label: 'Yes, delete it', run: () => api.remove() },
    { id: 'no', label: 'Cancel', run: () => {} },
  ],
}`,
  },
  {
    title: 'Ask for a value',
    text: 'The prompt option turns the next Enter into a text field; the value reaches run().',
    query: 'rename',
    code: `{
  id: 'rename', label: 'Rename workspace…',
  prompt: 'New name',
  run: ({ value }) => workspace.rename(value),
}`,
  },
  {
    title: 'Hide a command by state',
    text: 'The hidden option can be a function: the command appears and disappears with your state, no new list needed.',
    query: 'sign',
    code: `{ id: 'in', label: 'Sign in', hidden: () => auth.signedIn(), run: () => auth.signIn() },
{ id: 'out', label: 'Sign out', hidden: () => !auth.signedIn(), run: () => auth.signOut() }`,
  },
  {
    title: 'Bind a key to one command',
    text: 'Press Alt+B with the palette closed. The shortcut is shown next to the command.',
    query: 'banner',
    code: `{ id: 'banner', label: 'Toggle banner', hotkey: 'alt+b', run: () => ui.toggleBanner() }`,
  },
  {
    title: 'Search on your API',
    text: 'A provider loads results while the user types, with debounce and cancellation (type two letters).',
    query: 'pre',
    code: `injectCommandProvider({
  id: 'docs', group: 'Docs', minQueryLength: 2,
  search: async (query, signal) => {
    const hits = await fetch(\`/api/docs?q=\${query}\`, { signal }).then((r) => r.json());
    return hits.map((h) => ({ id: h.id, label: h.title, route: h.url }));
  },
})`,
  },
];

@Component({
  selector: 'demo-recipes',
  imports: [DemoNote],
  template: `
    <header class="page-head">
      <p class="eyebrow">Recipes</p>
      <h1>Patterns you will need</h1>
      <p class="lead">
        Each card registers real commands on this page. Press the button to open the palette with
        the right query, then run the command: the result shows up below.
      </p>
    </header>

    @if (banner()) {
      <p class="card banner" role="status">Banner on. Press Alt+B again to hide it.</p>
    }

    <section class="grid" aria-label="Recipes">
      @for (recipe of recipes; track recipe.title) {
        <article class="card">
          <h2>{{ recipe.title }}</h2>
          <p class="muted">{{ recipe.text }}</p>
          <pre tabindex="0"><code>{{ recipe.code }}</code></pre>
          <div class="actions">
            <button type="button" (click)="palette.open(recipe.query)">
              Try it: “{{ recipe.query }}”
            </button>
          </div>
        </article>
      }
    </section>

    <section class="card result" aria-live="polite">
      <p class="eyebrow">Last result</p>
      <p>{{ log() }}</p>
    </section>

    <demo-note
      text="Everything above is registered by this page with injectCommands and injectCommandProvider, and removed when you leave it."
    />
  `,
})
export default class Recipes {
  protected readonly palette = inject(CommandPaletteService);
  private readonly icons = inject(IconRegistry);
  protected readonly recipes = RECIPES;
  protected readonly log = signal('Nothing yet. Run one of the commands.');
  protected readonly banner = signal(false);
  private readonly signedIn = signal(true);
  private readonly workspace = signal('Acme');

  constructor() {
    injectCommands(
      computed<Command[]>(() => {
        const icon = this.icons.map();
        const name = this.workspace();
        return [
          {
            id: 'recipe-delete',
            label: 'Delete workspace…',
            description: 'Confirmation step as a sub-palette',
            group: 'Recipes',
            icon: icon.get('trash'),
            keywords: ['remove', 'confirm'],
            children: [
              {
                id: 'recipe-delete-yes',
                label: `Yes, delete “${name}”`,
                run: () => this.say(`“${name}” deleted (not really).`),
              },
              { id: 'recipe-delete-no', label: 'Cancel', run: () => this.say('Cancelled.') },
            ],
          },
          {
            id: 'recipe-rename',
            label: 'Rename workspace…',
            description: `Now: ${name}`,
            group: 'Recipes',
            icon: icon.get('settings'),
            prompt: 'New name',
            run: ({ value }) => {
              const next = value?.trim();
              if (!next) return;
              this.workspace.set(next);
              this.say(`Workspace renamed to “${next}”.`);
            },
          },
          {
            id: 'recipe-signin',
            label: 'Sign in',
            group: 'Recipes',
            icon: icon.get('user'),
            hidden: () => this.signedIn(),
            run: () => this.setSignedIn(true),
          },
          {
            id: 'recipe-signout',
            label: 'Sign out',
            group: 'Recipes',
            icon: icon.get('user'),
            hidden: () => !this.signedIn(),
            run: () => this.setSignedIn(false),
          },
          {
            id: 'recipe-banner',
            label: this.banner() ? 'Hide banner' : 'Show banner',
            group: 'Recipes',
            icon: icon.get('link'),
            hotkey: 'alt+b',
            run: () => {
              this.banner.update((v) => !v);
              this.say(this.banner() ? 'Banner shown.' : 'Banner hidden.');
            },
          },
        ];
      }),
    );

    injectCommandProvider({
      id: 'recipe-docs',
      group: 'Docs',
      minQueryLength: 2,
      search: async (query, signal) => {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, 350);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
        const q = query.toLowerCase();
        return DOCS.filter((d) => d.title.toLowerCase().includes(q)).map((d) => ({
          id: `doc-${d.slug}`,
          label: d.title,
          description: d.text,
          run: () => this.say(`Would open the “${d.title}” docs.`),
        }));
      },
    });
  }

  private setSignedIn(value: boolean): void {
    this.signedIn.set(value);
    this.say(
      value ? 'Signed in. “Sign out” is now available.' : 'Signed out. “Sign in” is now available.',
    );
  }

  private say(message: string): void {
    this.log.set(message);
  }
}
