// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette demo

import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideCommandPalette } from '@rrstudioapps/ngx-command-palette';

import { routes } from './app.routes';

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
      prefixes: [
        { prefix: '>', kind: 'action' },
        { prefix: '@', groups: ['Customers'] },
      ],
    }),
  ],
};
