// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

// Checks that the snippets of the README "Recipes" section work as written.

import { Component, computed, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { Command } from './command.model';
import { CommandPaletteComponent } from './command-palette.component';
import { CommandPaletteService, injectCommands } from './command-palette.service';
import { provideCommandPalette } from './config';

const text = (el: HTMLElement) => el.textContent ?? '';

describe('README recipes', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('prefix modes: the hints are listed and named as documented', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideCommandPalette({
          showPrefixHints: true,
          prefixes: [
            { prefix: '>', kind: 'action' },
            { prefix: '/', kind: 'route' },
            { prefix: '#', groups: ['Customers'] },
            { prefix: '@', label: 'People' },
          ],
        }),
      ],
    });
    const fixture = TestBed.createComponent(CommandPaletteComponent);
    TestBed.inject(CommandPaletteService).open();
    await fixture.whenStable();
    const hints = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.rr-cp-hint'),
    ).map((h) => (h.textContent ?? '').replace(/\s+/g, ''));
    expect(hints).toEqual(['>Actions', '/Pages', '#Customers', '@People']);
  });

  it('commands from your routes: data, filter, describe and a manual override', () => {
    @Component({ selector: 'rr-page', template: '' })
    class Page {}
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'billing',
            component: Page,
            data: { commandPalette: { label: 'Invoices', keywords: ['pay'] } },
          },
          { path: 'internal', component: Page, data: { commandPalette: false } },
          { path: 'admin', component: Page },
          { path: '', component: Page },
        ]),
        provideCommandPalette({
          routes: {
            group: 'Go to',
            filter: (_route, url) => !url.startsWith('/admin'),
            describe: (_route, url) => (url === '/' ? { label: 'Home', keywords: ['start'] } : {}),
          },
        }),
      ],
    });
    const service = TestBed.inject(CommandPaletteService);
    service.open();
    expect(service.commands().map((c) => [c.id, c.label, c.group])).toEqual([
      ['route:/billing', 'Invoices', 'Go to'],
      ['route:/', 'Home', 'Go to'],
    ]);
  });

  it('labels: translated texts are shown', () => {
    TestBed.configureTestingModule({
      providers: [
        provideCommandPalette({
          labels: { placeholder: 'Befehl eingeben…', empty: 'Keine Ergebnisse' },
        }),
      ],
    });
    const fixture = TestBed.createComponent(CommandPaletteComponent);
    TestBed.inject(CommandPaletteService).open('zzz');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('input')?.getAttribute('placeholder')).toBe('Befehl eingeben…');
    expect(text(el)).toContain('Keine Ergebnisse');
  });

  it('page commands: registered by a component and removed when it is destroyed', () => {
    @Component({ selector: 'rr-invoice', template: '' })
    class InvoicePage {
      readonly invoice = input.required<{ number: string }>();
      readonly sent: string[] = [];
      constructor() {
        injectCommands(
          computed<Command[]>(() => [
            {
              id: 'invoice.send',
              label: `Send ${this.invoice().number}`,
              run: () => void this.sent.push('x'),
            },
          ]),
        );
      }
    }
    const service = TestBed.inject(CommandPaletteService);
    const fixture = TestBed.createComponent(InvoicePage);
    fixture.componentRef.setInput('invoice', { number: 'INV-1' });
    fixture.detectChanges();
    expect(service.commands().map((c) => c.label)).toEqual(['Send INV-1']);
    fixture.componentRef.setInput('invoice', { number: 'INV-2' });
    fixture.detectChanges();
    expect(service.commands().map((c) => c.label)).toEqual(['Send INV-2']);
    fixture.destroy();
    expect(service.commands()).toEqual([]);
  });

  it('button: opens the palette and shows the shortcut label', () => {
    @Component({
      selector: 'rr-host',
      imports: [CommandPaletteComponent],
      template: `<button (click)="palette.open()">
          Search <kbd>{{ cp.shortcutLabel }}</kbd>
        </button>
        <rr-command-palette #cp />`,
    })
    class Host {
      protected readonly palette = TestBed.inject(CommandPaletteService);
    }
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('kbd')?.textContent).toMatch(/^(⌘K|Ctrl\+K)$/);
    el.querySelector('button')?.click();
    expect(TestBed.inject(CommandPaletteService).isOpen()).toBe(true);
  });

  it('permissions: a hidden command leaves the list, the search and the recents', () => {
    const isAdmin = signal(false);
    const service = TestBed.inject(CommandPaletteService);
    service.register([
      { id: 'admin.users', label: 'Manage users', route: '/admin/users', hidden: () => !isAdmin() },
    ]);
    service.open();
    expect(service.sections()).toEqual([]);
    service.setQuery('manage');
    expect(service.sections()).toEqual([]);
    isAdmin.set(true);
    expect(service.sections()[0].items).toHaveLength(1);
  });
});
