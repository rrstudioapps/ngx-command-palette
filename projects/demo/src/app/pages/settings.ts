// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette demo

import { Component, computed, inject } from '@angular/core';
import { CommandPaletteService, injectCommands } from '@rrstudioapps/ngx-command-palette';

import { IconRegistry } from '../shared/icons';
import { DemoNote } from '../shared/note';
import { ThemeService } from '../shared/theme';

@Component({
  selector: 'demo-settings',
  imports: [DemoNote],
  template: `
    <header class="page-head">
      <h1>Settings</h1>
      <p class="lead">Everything here can also be done from the palette.</p>
    </header>
    <div class="card settings">
      <label class="row">
        <span>Dark theme</span>
        <input
          type="checkbox"
          role="switch"
          [checked]="theme.theme() === 'dark'"
          (change)="theme.toggle()"
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
      <div class="row">
        <span>Recent commands</span>
        <button type="button" (click)="palette.clearRecent()">Clear</button>
      </div>
    </div>
    <demo-note
      text="Commands can carry keywords (“spacing” finds the density toggle) and a label that follows the current state."
      [code]="snippet"
    />
  `,
})
export default class Settings {
  protected readonly snippet = `{
  id: 'density',
  label: compact() ? 'Use comfortable density' : 'Use compact density',
  keywords: ['spacing', 'layout'],
  run: () => compact.update((v) => !v),
}`;
  protected readonly theme = inject(ThemeService);
  protected readonly palette = inject(CommandPaletteService);
  private readonly icons = inject(IconRegistry);

  constructor() {
    injectCommands(
      computed(() => [
        {
          id: 'settings-density',
          label: this.theme.compact() ? 'Use comfortable density' : 'Use compact density',
          group: 'Preferences',
          icon: this.icons.map().get('density'),
          keywords: ['spacing', 'layout'],
          run: () => this.theme.compact.update((v) => !v),
        },
        {
          id: 'settings-clear-recent',
          label: 'Clear recent commands',
          group: 'Preferences',
          icon: this.icons.map().get('trash'),
          keywords: ['history'],
          run: () => this.palette.clearRecent(),
        },
      ]),
    );
  }
}
