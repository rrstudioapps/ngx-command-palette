// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CommandPaletteComponent } from './command-palette.component';
import { CommandPaletteService } from './command-palette.service';
import { provideCommandPalette } from './config';
import { CommandEmptyTemplate, CommandItemTemplate } from './templates.directive';

@Component({
  imports: [CommandPaletteComponent],
  template: `<button id="trigger">Open</button><rr-command-palette />`,
})
class Host {}

@Component({
  imports: [CommandPaletteComponent, CommandItemTemplate, CommandEmptyTemplate],
  template: `
    <rr-command-palette>
      <ng-template rrCommandItem let-command let-active="active">
        <span class="custom">{{ command.label }}{{ active ? ' *' : '' }}</span>
      </ng-template>
      <ng-template rrCommandEmpty let-query>Nothing for "{{ query }}"</ng-template>
    </rr-command-palette>
  `,
})
class CustomHost {}

describe('CommandPaletteComponent', () => {
  let fixture: ComponentFixture<unknown>;
  let service: CommandPaletteService;
  const runs: string[] = [];

  async function setup(host: new () => unknown = Host) {
    localStorage.clear();
    runs.length = 0;
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideCommandPalette({ recent: false, theme: 'dark' })],
    });
    service = TestBed.inject(CommandPaletteService);
    service.register([
      { id: 'a', label: 'Alpha', group: 'One', run: () => void runs.push('a') },
      { id: 'b', label: 'Beta', group: 'One', disabled: true, run: () => void runs.push('b') },
      {
        id: 'c',
        label: 'Gamma',
        group: 'Two',
        description: 'Third',
        shortcut: ['G'],
        icon: '★',
        run: () => void runs.push('c'),
      },
    ]);
    fixture = TestBed.createComponent(host);
    await fixture.whenStable();
  }

  const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;
  const input = () => q('.rr-cp-input') as HTMLInputElement;
  const options = () => Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));

  function keydown(target: EventTarget, key: string, init: KeyboardEventInit = {}) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  }

  async function open() {
    service.open();
    await fixture.whenStable();
  }

  afterEach(() => fixture?.destroy());

  it('renders nothing while closed', async () => {
    await setup();
    expect(q('.rr-cp')).toBeNull();
  });

  it('opens with Ctrl+K and focuses the input', async () => {
    await setup();
    const event = keydown(document, 'k', { ctrlKey: true });
    await fixture.whenStable();
    expect(event.defaultPrevented).toBe(true);
    expect(service.isOpen()).toBe(true);
    expect(document.activeElement).toBe(input());
  });

  it('ignores plain-key shortcuts while typing in a field', async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideCommandPalette({ shortcut: ['mod+k', '/'] })],
    });
    service = TestBed.inject(CommandPaletteService);
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const field = document.createElement('input');
    document.body.appendChild(field);
    keydown(field, '/');
    expect(service.isOpen()).toBe(false);
    keydown(field, 'k', { ctrlKey: true });
    expect(service.isOpen()).toBe(true);
    service.close();
    keydown(document.body, '/');
    expect(service.isOpen()).toBe(true);
    field.remove();
  });

  it('has dialog, combobox and listbox semantics', async () => {
    await setup();
    await open();
    const dialog = q('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('Command palette');
    const listbox = q('[role="listbox"]')!;
    expect(input().getAttribute('role')).toBe('combobox');
    expect(input().getAttribute('aria-controls')).toBe(listbox.id);
    const groups = document.querySelectorAll('[role="group"]');
    expect(groups).toHaveLength(2);
    const heading = document.getElementById(groups[0].getAttribute('aria-labelledby')!);
    expect(heading?.textContent).toBe('One');
    expect(options()[1].getAttribute('aria-disabled')).toBe('true');
    expect(q('.rr-cp')!.getAttribute('data-theme')).toBe('dark');
  });

  it('moves the active option with the keyboard, skipping disabled ones', async () => {
    await setup();
    await open();
    const active = () => input().getAttribute('aria-activedescendant');
    expect(active()).toBe(options()[0].id);
    keydown(input(), 'ArrowDown');
    await fixture.whenStable();
    expect(active()).toBe(options()[2].id);
    expect(options()[2].getAttribute('aria-selected')).toBe('true');
    keydown(input(), 'ArrowDown');
    await fixture.whenStable();
    expect(active()).toBe(options()[0].id);
    keydown(input(), 'End');
    await fixture.whenStable();
    expect(active()).toBe(options()[2].id);
    keydown(input(), 'Home');
    await fixture.whenStable();
    expect(active()).toBe(options()[0].id);
  });

  it('executes the active option with Enter', async () => {
    await setup();
    await open();
    keydown(input(), 'ArrowUp');
    keydown(input(), 'Enter');
    await fixture.whenStable();
    expect(runs).toEqual(['c']);
    expect(service.isOpen()).toBe(false);
  });

  it('filters while typing, highlights matches and resets the active option', async () => {
    await setup();
    await open();
    keydown(input(), 'ArrowDown');
    input().value = 'gm';
    input().dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(options().map((o) => o.querySelector('.rr-cp-label')!.textContent!.trim())).toEqual([
      'Gamma',
    ]);
    expect(Array.from(document.querySelectorAll('mark')).map((m) => m.textContent)).toEqual([
      'G',
      'm',
    ]);
    expect(input().getAttribute('aria-activedescendant')).toBe(options()[0].id);
    expect(q('.rr-cp-sr-only')!.textContent).toBe('1 results');
  });

  it('shows the empty state', async () => {
    await setup();
    service.open('zzz');
    await fixture.whenStable();
    expect(q('.rr-cp-empty')!.textContent!.trim()).toBe('No results found.');
    expect(input().hasAttribute('aria-activedescendant')).toBe(false);
  });

  it('closes with Escape and restores focus', async () => {
    await setup();
    const trigger = q('#trigger')!;
    trigger.focus();
    await open();
    keydown(input(), 'Escape');
    await fixture.whenStable();
    expect(service.isOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on a click outside the dialog but not inside', async () => {
    await setup();
    await open();
    q('.rr-cp-dialog')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(service.isOpen()).toBe(true);
    q('.rr-cp')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(service.isOpen()).toBe(false);
  });

  it('executes on click and ignores disabled options', async () => {
    await setup();
    await open();
    options()[1].click();
    expect(runs).toEqual([]);
    options()[0].click();
    await fixture.whenStable();
    expect(runs).toEqual(['a']);
  });

  it('keeps Tab inside the dialog', async () => {
    await setup();
    await open();
    const event = keydown(input(), 'Tab');
    expect(event.defaultPrevented).toBe(true);
    q('#trigger')!.focus();
    expect(document.activeElement).toBe(input());
  });

  it('renders icon, description and shortcut', async () => {
    await setup();
    await open();
    const gamma = options()[2];
    expect(gamma.querySelector('.rr-cp-icon')!.textContent!.trim()).toBe('★');
    expect(gamma.querySelector('.rr-cp-description')!.textContent).toBe('Third');
    expect(gamma.querySelector('kbd')!.textContent).toBe('G');
  });

  it('uses custom item and empty templates', async () => {
    await setup(CustomHost);
    await open();
    expect(options()[0].querySelector('.custom')!.textContent).toBe('Alpha *');
    service.setQuery('zzz');
    await fixture.whenStable();
    expect(q('.rr-cp-empty')!.textContent!.trim()).toBe('Nothing for "zzz"');
  });

  it('toggles closed with the shortcut while open', async () => {
    await setup();
    await open();
    keydown(document, 'k', { ctrlKey: true });
    await fixture.whenStable();
    expect(service.isOpen()).toBe(false);
  });

  it('ignores a held-down shortcut and IME composition', async () => {
    await setup();
    keydown(document, 'k', { ctrlKey: true, repeat: true });
    keydown(document, 'k', { ctrlKey: true, isComposing: true });
    expect(service.isOpen()).toBe(false);
  });

  it('does nothing on Enter when there are no results', async () => {
    await setup();
    await open();
    service.setQuery('zzz');
    await fixture.whenStable();
    const event = keydown(input(), 'Enter');
    await fixture.whenStable();
    expect(event.defaultPrevented).toBe(true);
    expect(runs).toEqual([]);
    expect(service.isOpen()).toBe(true);
  });

  it('announces the number of results and the empty state', async () => {
    await setup();
    await open();
    const live = () => q('[aria-live="polite"]')!.textContent!.trim();
    expect(live()).toBe('3 results');
    service.setQuery('zzz');
    await fixture.whenStable();
    expect(live()).toBe('No results found.');
  });

  it('brings the focus back to the input when it leaves the dialog', async () => {
    await setup();
    await open();
    q('#trigger')!.focus();
    await fixture.whenStable();
    expect(document.activeElement).toBe(input());
  });

  it('keeps the dialog usable with no commands at all', async () => {
    await setup();
    service.close();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideCommandPalette({ recent: false })],
    });
    service = TestBed.inject(CommandPaletteService);
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    await open();
    expect(options()).toHaveLength(0);
    expect(q('.rr-cp-empty')).not.toBeNull();
    keydown(input(), 'ArrowDown');
    keydown(input(), 'Enter');
    expect(service.isOpen()).toBe(true);
  });
});
