// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette demo

import { DOCUMENT, Injectable, effect, inject, signal } from '@angular/core';

export type DemoTheme = 'light' | 'dark';

/** Demo theme: follows the system until the user changes it (for this visit only). */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly theme = signal<DemoTheme>(
    this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light',
  );
  readonly compact = signal(false);

  constructor() {
    effect(() => {
      const root = this.document.documentElement;
      root.dataset['theme'] = this.theme();
      root.classList.toggle('compact', this.compact());
    });
  }

  toggle(): void {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }
}
