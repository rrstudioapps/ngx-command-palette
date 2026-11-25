// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette demo

import { Component, DOCUMENT, computed, effect, inject, signal } from '@angular/core';
import { CommandPaletteService } from '@rrstudioapps/ngx-command-palette';

import { DemoNote } from '../shared/note';
import { ThemeService } from '../shared/theme';

const ACCENTS = [
  { name: 'Default', value: '' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Violet', value: '#8b7cf6' },
  { name: 'Green', value: '#22b89a' },
  { name: 'Orange', value: '#f08a3c' },
];

const WIDTH = 640;
const RADIUS = 12;

@Component({
  selector: 'demo-playground',
  imports: [DemoNote],
  template: `
    <header class="page-head">
      <p class="eyebrow">Playground</p>
      <h1>Style it live</h1>
      <p class="lead">
        The palette is styled with CSS variables only. Change them here, open the palette to see the
        result, and copy the CSS.
      </p>
      <div class="actions">
        <button type="button" class="primary" (click)="palette.open()">Open the palette</button>
        <button type="button" (click)="reset()">Reset</button>
      </div>
    </header>

    <section class="grid">
      <div class="card controls">
        <fieldset>
          <legend>Accent</legend>
          <div class="swatches">
            @for (a of accents; track a.name) {
              <button
                type="button"
                class="swatch"
                [class.on]="accent() === a.value"
                [style.--swatch]="a.value || 'var(--accent)'"
                [attr.aria-pressed]="accent() === a.value"
                [attr.aria-label]="a.name"
                (click)="accent.set(a.value)"
              ></button>
            }
          </div>
        </fieldset>
        <label class="field">
          <span
            >Width <output>{{ width() }}px</output></span
          >
          <input
            type="range"
            min="440"
            max="820"
            step="10"
            [value]="width()"
            (input)="width.set(+$any($event.target).value)"
          />
        </label>
        <label class="field">
          <span
            >Corner radius <output>{{ radius() }}px</output></span
          >
          <input
            type="range"
            min="0"
            max="28"
            [value]="radius()"
            (input)="radius.set(+$any($event.target).value)"
          />
        </label>
        <label class="row">
          <span>Compact density</span>
          <input
            type="checkbox"
            role="switch"
            [checked]="theme.compact()"
            (change)="theme.compact.set(!theme.compact())"
          />
        </label>
      </div>
      <div class="card">
        <h2>CSS</h2>
        <pre tabindex="0"><code>{{ css() }}</code></pre>
      </div>
    </section>

    <demo-note
      text="Options such as shortcut, prefixes or labels are set once in provideCommandPalette(), so they are fixed per app. Looks are variables, so they can change at runtime."
    />
  `,
})
export default class Playground {
  protected readonly palette = inject(CommandPaletteService);
  protected readonly theme = inject(ThemeService);
  private readonly document = inject(DOCUMENT);
  protected readonly accents = ACCENTS;
  protected readonly accent = signal('');
  protected readonly width = signal(WIDTH);
  protected readonly radius = signal(RADIUS);

  protected readonly css = computed(() => {
    const lines: string[] = [];
    if (this.accent()) {
      lines.push(`  --rr-cp-accent: ${this.accent()};`, `  --rr-cp-highlight: ${this.accent()};`);
    }
    if (this.width() !== WIDTH) lines.push(`  --rr-cp-width: ${this.width()}px;`);
    if (this.radius() !== RADIUS) lines.push(`  --rr-cp-radius: ${this.radius()}px;`);
    if (this.theme.compact()) {
      lines.push(
        '  --rr-cp-input-height: 44px;',
        '  --rr-cp-item-padding: 3px 10px;',
        '  --rr-cp-item-gap: 8px;',
      );
    }
    return lines.length
      ? `.rr-cp {\n${lines.join('\n')}\n}`
      : '/* defaults: nothing to override */';
  });

  constructor() {
    // The demo reads these through --demo-cp-* (see styles.css); removed when you leave the page
    effect((onCleanup) => {
      const style = this.document.documentElement.style;
      const set = (name: string, value: string): void => {
        if (value) style.setProperty(name, value);
        else style.removeProperty(name);
      };
      set('--demo-cp-accent', this.accent());
      set('--demo-cp-width', `${this.width()}px`);
      set('--demo-cp-radius', `${this.radius()}px`);
      onCleanup(() => {
        for (const n of ['accent', 'width', 'radius']) style.removeProperty(`--demo-cp-${n}`);
      });
    });
  }

  protected reset(): void {
    this.accent.set('');
    this.width.set(WIDTH);
    this.radius.set(RADIUS);
    this.theme.compact.set(false);
  }
}
