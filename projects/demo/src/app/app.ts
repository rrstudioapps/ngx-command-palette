// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette demo

import { Component, DOCUMENT, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  type Command,
  CommandEmptyTemplate,
  CommandPaletteComponent,
  CommandPaletteService,
  injectCommandProvider,
  injectCommands,
  isApplePlatform,
  matchesShortcut,
  parseShortcut,
} from '@rrstudioapps/ngx-command-palette';

import { searchCustomers, LINKS } from './shared/data';
import { DemoIcons, IconRegistry } from './shared/icons';
import { ThemeService } from './shared/theme';

const THEME_SHORTCUT = parseShortcut('alt+t');

@Component({
  selector: 'demo-root',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CommandPaletteComponent,
    CommandEmptyTemplate,
    DemoIcons,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class App {
  protected readonly palette = inject(CommandPaletteService);
  protected readonly themeService = inject(ThemeService);
  private readonly icons = inject(IconRegistry);
  private readonly document = inject(DOCUMENT);
  protected readonly apple = isApplePlatform();
  protected readonly links = LINKS;

  constructor() {
    // Global commands as a signal, so the icons (TemplateRefs) show up once their template is ready
    injectCommands(
      computed<Command[]>(() => {
        const icon = this.icons.map();
        return [
          {
            id: 'nav-overview',
            label: 'Overview',
            group: 'Navigation',
            icon: icon.get('home'),
            route: '/',
            keywords: ['home', 'start'],
          },
          {
            id: 'nav-projects',
            label: 'Projects',
            group: 'Navigation',
            icon: icon.get('folder'),
            route: '/projects',
          },
          {
            id: 'nav-customers',
            label: 'Customers',
            group: 'Navigation',
            icon: icon.get('users'),
            route: '/customers',
            keywords: ['clients', 'accounts'],
          },
          {
            id: 'nav-settings',
            label: 'Settings',
            group: 'Navigation',
            icon: icon.get('settings'),
            route: '/settings',
            keywords: ['preferences', 'options'],
          },
          {
            id: 'theme',
            label:
              this.themeService.theme() === 'dark'
                ? 'Switch to light theme'
                : 'Switch to dark theme',
            group: 'Preferences',
            icon: icon.get('theme'),
            keywords: ['dark mode', 'light mode', 'appearance', 'night'],
            shortcut: this.apple ? ['⌥', 'T'] : ['Alt', 'T'],
            run: () => this.themeService.toggle(),
          },
          {
            id: 'appearance',
            label: 'Appearance…',
            description: 'Sub-palette: theme and density',
            group: 'Preferences',
            icon: icon.get('settings'),
            keywords: ['density', 'compact', 'colors'],
            children: [
              {
                id: 'appearance-light',
                label: 'Light theme',
                run: () => this.themeService.theme.set('light'),
              },
              {
                id: 'appearance-dark',
                label: 'Dark theme',
                run: () => this.themeService.theme.set('dark'),
              },
              {
                id: 'appearance-compact',
                label: this.themeService.compact()
                  ? 'Turn compact mode off'
                  : 'Turn compact mode on',
                run: () => this.themeService.compact.update((c) => !c),
              },
            ],
          },
          {
            id: 'copy-install',
            label: 'Copy install command',
            description: 'npm i @rrstudioapps/ngx-command-palette',
            group: 'Library',
            icon: icon.get('copy'),
            keywords: ['npm', 'package'],
            run: () => navigator.clipboard?.writeText('npm i @rrstudioapps/ngx-command-palette'),
          },
          {
            id: 'github',
            label: 'Source code on GitHub',
            group: 'Library',
            icon: icon.get('link'),
            keywords: ['repository', 'docs'],
            run: () => this.go(LINKS.github),
          },
          {
            id: 'npm',
            label: 'Package on npm',
            group: 'Library',
            icon: icon.get('link'),
            run: () => this.go(LINKS.npm),
          },
          {
            id: 'providentia',
            label: 'Providentia dashboard demo',
            description: 'A full Angular admin template',
            group: 'Library',
            icon: icon.get('link'),
            keywords: ['dashboard', 'template'],
            run: () => this.go(LINKS.providentia),
          },
          {
            id: 'all-demos',
            label: 'All rrstudio demos',
            group: 'Library',
            icon: icon.get('link'),
            run: () => this.go(LINKS.demos),
          },
        ];
      }),
    );

    // Async commands: customer search on a fake API with a delay
    injectCommandProvider({
      id: 'customers',
      group: 'Customers',
      minQueryLength: 2,
      search: async (query, signal) => {
        const icon = this.icons.map().get('user');
        const customers = await searchCustomers(query, signal);
        return customers.map((c) => ({
          id: `customer-${c.id}`,
          label: c.name,
          description: `${c.company} · ${c.email}`,
          icon,
          route: ['/customers', c.id],
        }));
      },
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (matchesShortcut(event, THEME_SHORTCUT, this.apple)) {
      event.preventDefault();
      this.themeService.toggle();
    }
  }

  private go(url: string): void {
    this.document.defaultView?.open(url, '_blank', 'noopener');
  }
}
