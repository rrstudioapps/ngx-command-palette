// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette demo

import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideCommandPalette } from '@rrstudioapps/ngx-command-palette';

import { routes } from './app.routes';
import { IconRegistry } from './shared/icons';

// Icon of each generated navigation command, looked up by URL
const ROUTE_ICONS: Record<string, string> = {
  '/': 'home',
  '/projects': 'folder',
  '/customers': 'users',
  '/settings': 'settings',
  '/recipes': 'archive',
  '/playground': 'theme',
  '/routes': 'route',
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    provideCommandPalette({
      shortcut: ['mod+k', '/'],
      recent: { max: 4, storageKey: 'rr-cp-demo:recent' },
      debounceMs: 150,
      // Every route becomes a command; label and keywords come from `data.commandPalette` in
      // app.routes.ts. `describe` runs in an injection context, so it can inject the icon registry.
      routes: {
        group: 'Navigation',
        describe: (_route, url) => ({ icon: inject(IconRegistry).map().get(ROUTE_ICONS[url]) }),
      },
      showPrefixHints: true,
      prefixes: [
        { prefix: '>', kind: 'action' },
        { prefix: '@', groups: ['Customers'] },
      ],
    }),
  ],
};
