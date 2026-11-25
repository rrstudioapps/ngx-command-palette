// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette demo

import { Component, input } from '@angular/core';

/** "What this page shows": a short explanation with the code behind it. */
@Component({
  selector: 'demo-note',
  template: `
    <aside class="note" [attr.aria-label]="'What this page shows'">
      <p class="eyebrow">What this page shows</p>
      <p>{{ text() }}</p>
      @if (code(); as snippet) {
        <pre tabindex="0"><code>{{ snippet }}</code></pre>
      }
    </aside>
  `,
})
export class DemoNote {
  readonly text = input.required<string>();
  readonly code = input<string>();
}
