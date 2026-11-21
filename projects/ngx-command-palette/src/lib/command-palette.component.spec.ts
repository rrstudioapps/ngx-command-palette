// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
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

  it('runs command hotkeys, but not Alt-only ones while typing in a field', async () => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideCommandPalette()] });
    service = TestBed.inject(CommandPaletteService);
    const hits: string[] = [];
    service.register([
      { id: 'a', label: 'A', hotkey: 'alt+t', run: () => void hits.push('alt') },
      { id: 'b', label: 'B', hotkey: 'ctrl+s', run: () => void hits.push('ctrl') },
    ]);
    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const field = document.createElement('input');
    document.body.appendChild(field);
    keydown(field, 't', { altKey: true });
    expect(hits).toEqual([]);
    keydown(field, 's', { ctrlKey: true });
    expect(hits).toEqual(['ctrl']);
    keydown(document.body, 't', { altKey: true });
    expect(hits).toEqual(['ctrl', 'alt']);
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

  describe('sub-palettes', () => {
    async function setupTree() {
      await setup();
      service.register([
        {
          id: 'theme',
          label: 'Theme',
          group: 'Two',
          children: [
            { id: 'dark', label: 'Dark', run: () => void runs.push('dark') },
            { id: 'light', label: 'Light', run: () => void runs.push('light') },
            {
              id: 'colors',
              label: 'Colors',
              children: [{ id: 'red', label: 'Red', run: () => void runs.push('red') }],
            },
          ],
        },
      ]);
      await open();
    }
    const live = () => q('[aria-live="polite"]')!.textContent!.trim();
    const labelsShown = () => options().map((o) => q('#' + o.id + ' .rr-cp-label')!.textContent);

    async function enter(query: string) {
      service.setQuery(query);
      await fixture.whenStable();
      keydown(input(), 'Enter');
      await fixture.whenStable();
    }

    it('marks the parents with a chevron and a hint for screen readers', async () => {
      await setupTree();
      const theme = options()[3];
      expect(theme.querySelector('.rr-cp-chevron')).not.toBeNull();
      expect(theme.textContent).toContain('opens a sub-palette');
      expect(options()[0].querySelector('.rr-cp-chevron')).toBeNull();
    });

    it('opens a level with Enter, shows the path and announces it', async () => {
      await setupTree();
      expect(q('.rr-cp-path')).toBeNull();
      await enter('theme');
      expect(service.isOpen()).toBe(true);
      expect(q('.rr-cp-path-current')!.textContent!.trim()).toBe('Theme');
      expect(q('.rr-cp-path-current')!.getAttribute('aria-current')).toBe('page');
      expect(labelsShown()).toEqual(['Dark', 'Light', 'Colors']);
      expect(input().value).toBe('');
      expect(document.activeElement).toBe(input());
      expect(live()).toBe('Theme: 3 results');
    });

    it('opens a level with a click', async () => {
      await setupTree();
      service.setQuery('theme');
      await fixture.whenStable();
      options()[0].click();
      await fixture.whenStable();
      expect(labelsShown()).toEqual(['Dark', 'Light', 'Colors']);
    });

    it('runs a child and closes everything', async () => {
      await setupTree();
      await enter('theme');
      await enter('dark');
      expect(runs).toEqual(['dark']);
      expect(service.isOpen()).toBe(false);
      await open();
      expect(q('.rr-cp-path')).toBeNull();
    });

    it('goes back with Backspace only when the search is empty', async () => {
      await setupTree();
      await enter('theme');
      service.setQuery('da');
      await fixture.whenStable();
      const kept = keydown(input(), 'Backspace');
      expect(kept.defaultPrevented).toBe(false);
      expect(service.path()).toHaveLength(1);
      service.setQuery('');
      await fixture.whenStable();
      const left = keydown(input(), 'Backspace');
      await fixture.whenStable();
      expect(left.defaultPrevented).toBe(true);
      expect(q('.rr-cp-path')).toBeNull();
      expect(options()).toHaveLength(4);
      // At the top level Backspace is just a key
      expect(keydown(input(), 'Backspace').defaultPrevented).toBe(false);
    });

    it('closes everything with Escape and reopens at the top level', async () => {
      await setupTree();
      await enter('theme');
      keydown(input(), 'Escape');
      await fixture.whenStable();
      expect(service.isOpen()).toBe(false);
      await open();
      expect(q('.rr-cp-path')).toBeNull();
      expect(options()).toHaveLength(4);
    });

    it('goes back with the buttons of the path and keeps the focus in the search field', async () => {
      await setupTree();
      await enter('theme');
      await enter('colors');
      expect(labelsShown()).toEqual(['Red']);
      expect(live()).toBe('Colors: 1 results');
      (q('.rr-cp-path-step') as HTMLElement).click();
      await fixture.whenStable();
      expect(service.path().map((p) => p.id)).toEqual(['theme']);
      expect(document.activeElement).toBe(input());
      (q('.rr-cp-path-back') as HTMLElement).click();
      await fixture.whenStable();
      expect(q('.rr-cp-path')).toBeNull();
      expect(document.activeElement).toBe(input());
      expect(q('.rr-cp-path-back')).toBeNull();
    });
  });

  describe('prompt', () => {
    it('shows the step, runs with the typed value on Enter and leaves it with Backspace', async () => {
      await setup();
      const values: (string | undefined)[] = [];
      service.register([
        { id: 'p', label: 'Go to user', prompt: 'User id…', run: (c) => void values.push(c.value) },
      ]);
      service.open('go');
      fixture.detectChanges();
      keydown(input(), 'Enter');
      fixture.detectChanges();
      expect(input().placeholder).toBe('User id…');
      expect(q('.rr-cp-path-current')?.textContent).toContain('Go to user');
      keydown(input(), 'Backspace');
      fixture.detectChanges();
      expect(input().placeholder).not.toBe('User id…');
      expect(q('.rr-cp-path-back')).toBeNull();
      service.setQuery('go');
      fixture.detectChanges();
      keydown(input(), 'Enter');
      fixture.detectChanges();
      keydown(input(), 'Enter');
      expect(values).toEqual([]);
      input().value = '7';
      input().dispatchEvent(new Event('input'));
      fixture.detectChanges();
      keydown(input(), 'Enter');
      await fixture.whenStable();
      expect(values).toEqual(['7']);
      expect(service.isOpen()).toBe(false);
    });
  });

  describe('shortcut options', () => {
    async function create(options: Parameters<typeof provideCommandPalette>[0]) {
      localStorage.clear();
      TestBed.configureTestingModule({
        providers: [provideRouter([]), provideCommandPalette({ recent: false, ...options })],
      });
      service = TestBed.inject(CommandPaletteService);
      fixture = TestBed.createComponent(Host);
      await fixture.whenStable();
    }
    const field = (tag = 'input') => {
      const el = document.createElement(tag);
      document.body.appendChild(el);
      return el;
    };

    it('`shortcut: []` turns the shortcut off, open() still works', async () => {
      await create({ shortcut: [] });
      keydown(document.body, 'k', { ctrlKey: true });
      expect(service.isOpen()).toBe(false);
      service.open();
      expect(service.isOpen()).toBe(true);
      const cp = fixture.debugElement.query(By.directive(CommandPaletteComponent));
      expect(cp.componentInstance.shortcutLabel).toBe('');
    });

    it('shortcutInFields defaults to true: Ctrl+K opens from a field', async () => {
      await create({});
      const el = field();
      keydown(el, 'k', { ctrlKey: true });
      expect(service.isOpen()).toBe(true);
      el.remove();
    });

    it.each(['input', 'textarea', 'select', 'div'])(
      'shortcutInFields: false ignores Ctrl+K in <%s>',
      async (tag) => {
        await create({ shortcutInFields: false });
        const el = field(tag);
        if (tag === 'div') {
          el.setAttribute('contenteditable', 'true');
          // jsdom/happy-dom may not compute isContentEditable: define it
          Object.defineProperty(el, 'isContentEditable', { value: true });
        }
        keydown(el, 'k', { ctrlKey: true });
        expect(service.isOpen()).toBe(false);
        keydown(document.body, 'k', { ctrlKey: true });
        expect(service.isOpen()).toBe(true);
        el.remove();
      },
    );

    it('shortcutInFields: false also stops command hotkeys in a field, not outside', async () => {
      await create({ shortcutInFields: false });
      const hits: string[] = [];
      service.register([{ id: 'a', label: 'A', hotkey: 'ctrl+s', run: () => void hits.push('a') }]);
      const el = field();
      keydown(el, 's', { ctrlKey: true });
      expect(hits).toEqual([]);
      keydown(document.body, 's', { ctrlKey: true });
      expect(hits).toEqual(['a']);
      el.remove();
    });

    it('shortcutInFields: false leaves Esc and typing in the palette input alone', async () => {
      await create({ shortcutInFields: false });
      service.open();
      await fixture.whenStable();
      keydown(input(), 'Escape');
      expect(service.isOpen()).toBe(false);
    });

    it('shortcutEnabled: false does not open and does not swallow the key', async () => {
      await create({ shortcutEnabled: false });
      const event = keydown(document.body, 'k', { ctrlKey: true });
      expect(service.isOpen()).toBe(false);
      expect(event.defaultPrevented).toBe(false);
      service.open();
      expect(service.isOpen()).toBe(true);
    });

    it('shortcutEnabled follows a signal, also while the palette is open', async () => {
      const enabled = signal(true);
      await create({ shortcutEnabled: enabled });
      keydown(document.body, 'k', { ctrlKey: true });
      expect(service.isOpen()).toBe(true);
      // switched off while open: it can still close, then it no longer opens
      enabled.set(false);
      keydown(document.body, 'k', { ctrlKey: true });
      expect(service.isOpen()).toBe(false);
      keydown(document.body, 'k', { ctrlKey: true });
      expect(service.isOpen()).toBe(false);
      enabled.set(true);
      keydown(document.body, 'k', { ctrlKey: true });
      expect(service.isOpen()).toBe(true);
    });

    it('shortcutEnabled accepts a plain function', async () => {
      let on = false;
      await create({ shortcutEnabled: () => on });
      keydown(document.body, 'k', { ctrlKey: true });
      expect(service.isOpen()).toBe(false);
      on = true;
      keydown(document.body, 'k', { ctrlKey: true });
      expect(service.isOpen()).toBe(true);
    });
  });

  describe('dynamic labels', () => {
    const lang = signal<'en' | 'it'>('en');
    async function create() {
      lang.set('en');
      localStorage.clear();
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          provideCommandPalette({
            labels: () =>
              lang() === 'it'
                ? {
                    placeholder: 'Cerca…',
                    dialog: 'Palette comandi',
                    listbox: 'Risultati',
                    empty: 'Nessun risultato',
                    results: '{count} risultati',
                    recent: 'Recenti',
                    closeHint: 'Esc IT',
                  }
                : {},
          }),
        ],
      });
      service = TestBed.inject(CommandPaletteService);
      service.register([
        { id: 'a', label: 'Alpha', run: () => undefined },
        { id: 'b', label: 'Beta', run: () => undefined },
      ]);
      fixture = TestBed.createComponent(Host);
      await fixture.whenStable();
    }
    const status = () => q('[aria-live]')!.textContent!.trim();

    it('updates an open palette: placeholder, aria labels, status and hints', async () => {
      await create();
      await open();
      expect(input().placeholder).toBe('Type a command or search…');
      expect(status()).toBe('2 results');
      lang.set('it');
      await fixture.whenStable();
      expect(input().placeholder).toBe('Cerca…');
      expect(q('[role="dialog"]')!.getAttribute('aria-label')).toBe('Palette comandi');
      expect(q('[role="listbox"]')!.getAttribute('aria-label')).toBe('Risultati');
      expect(q('.rr-cp-esc')!.textContent).toBe('Esc IT');
      expect(status()).toBe('2 risultati');
      input().value = 'zzz';
      input().dispatchEvent(new Event('input'));
      await fixture.whenStable();
      expect(status()).toBe('Nessun risultato');
    });

    it('applies a change made while closed the next time it opens, and back again', async () => {
      await create();
      lang.set('it');
      await open();
      expect(input().placeholder).toBe('Cerca…');
      service.close();
      lang.set('en');
      await open();
      expect(input().placeholder).toBe('Type a command or search…');
      expect(status()).toBe('2 results');
    });

    it('translates the Recent heading of an open palette', async () => {
      await create();
      await service.execute(service.commands()[0]);
      await open();
      expect(q('.rr-cp-group-label')!.textContent).toBe('Recent');
      lang.set('it');
      await fixture.whenStable();
      expect(q('.rr-cp-group-label')!.textContent).toBe('Recenti');
    });
  });

  describe('display options', () => {
    async function create(
      options: Parameters<typeof provideCommandPalette>[0],
      commands: Parameters<CommandPaletteService['register']>[0] = [
        { id: 'a', label: 'Alpha', group: 'One', run: () => undefined },
        { id: 'b', label: 'Beta', group: 'Two', run: () => undefined },
      ],
    ) {
      localStorage.clear();
      TestBed.configureTestingModule({
        providers: [provideRouter([]), provideCommandPalette({ recent: false, ...options })],
      });
      service = TestBed.inject(CommandPaletteService);
      service.register(commands);
      fixture = TestBed.createComponent(Host);
      await fixture.whenStable();
      await open();
    }
    const status = () => q('[aria-live]')!;
    const heading = () => q('.rr-cp-group-label')!;
    const hidden = (el: HTMLElement) => el.classList.contains('rr-cp-sr-only');

    it('has the current look by default', async () => {
      await create({});
      expect(q('.rr-cp-esc')).not.toBeNull();
      expect(hidden(heading())).toBe(false);
      expect(hidden(status())).toBe(true);
      expect(status().classList.contains('rr-cp-status')).toBe(false);
    });

    it('showSectionLabels: false hides the headings visually, groups keep their name', async () => {
      await create({ showSectionLabels: false });
      expect(hidden(heading())).toBe(true);
      const group = q('[role="group"]')!;
      const labelledBy = group.getAttribute('aria-labelledby')!;
      expect(document.getElementById(labelledBy)!.textContent).toBe('One');
    });

    it('showCloseHint: false removes the Esc key', async () => {
      await create({ showCloseHint: false });
      expect(q('.rr-cp-esc')).toBeNull();
    });

    it('highlightMatches: false renders no <mark>, the text stays whole', async () => {
      await create({ highlightMatches: false });
      input().value = 'alp';
      input().dispatchEvent(new Event('input'));
      await fixture.whenStable();
      expect(document.querySelectorAll('.rr-cp-match').length).toBe(0);
      expect(q('.rr-cp-label')!.textContent).toBe('Alpha');
    });

    it('highlights by default', async () => {
      await create({});
      input().value = 'alp';
      input().dispatchEvent(new Event('input'));
      await fixture.whenStable();
      expect(document.querySelectorAll('.rr-cp-match').length).toBeGreaterThan(0);
    });

    it('showStatus: true shows the status line and keeps it aria-live', async () => {
      await create({ showStatus: true });
      const el = status();
      expect(el.classList.contains('rr-cp-status')).toBe(true);
      expect(hidden(el)).toBe(false);
      expect(el.getAttribute('aria-live')).toBe('polite');
      expect(el.textContent!.trim()).toBe('2 results');
    });

    it('resultsOne is used for a single result, results otherwise', async () => {
      await create({ labels: { results: '{count} items', resultsOne: 'one item' } });
      expect(status().textContent!.trim()).toBe('2 items');
      input().value = 'alp';
      input().dispatchEvent(new Event('input'));
      await fixture.whenStable();
      expect(status().textContent!.trim()).toBe('one item');
    });

    it('resultsOne replaces {count}, and without it results is used', async () => {
      await create({ labels: { resultsOne: '{count} result' } });
      input().value = 'alp';
      input().dispatchEvent(new Event('input'));
      await fixture.whenStable();
      expect(status().textContent!.trim()).toBe('1 result');
    });

    it('without resultsOne a single result uses results', async () => {
      await create({});
      input().value = 'alp';
      input().dispatchEvent(new Event('input'));
      await fixture.whenStable();
      expect(status().textContent!.trim()).toBe('1 results');
    });

    it('levelOne is used inside a sub-palette with a single result', async () => {
      await create(
        { labels: { levelOne: '{name}: only {count}', level: '{name}: {count} many' } },
        [
          {
            id: 'p',
            label: 'Theme',
            children: [{ id: 'c', label: 'Dark', run: () => undefined }],
          },
          {
            id: 'q',
            label: 'Colors',
            children: [
              { id: 'r', label: 'Red', run: () => undefined },
              { id: 's', label: 'Blue', run: () => undefined },
            ],
          },
        ],
      );
      await service.execute(service.commands()[0]);
      await fixture.whenStable();
      expect(status().textContent!.trim()).toBe('Theme: only 1');
      service.back();
      await service.execute(service.commands()[1]);
      await fixture.whenStable();
      expect(status().textContent!.trim()).toBe('Colors: 2 many');
    });
  });

  describe('behavior options', () => {
    async function create(options: Parameters<typeof provideCommandPalette>[0]) {
      localStorage.clear();
      TestBed.configureTestingModule({
        providers: [provideRouter([]), provideCommandPalette({ recent: false, ...options })],
      });
      service = TestBed.inject(CommandPaletteService);
      service.register([{ id: 'a', label: 'Alpha', run: () => undefined }]);
      fixture = TestBed.createComponent(Host);
      await fixture.whenStable();
    }

    it('passes the reason of each way of closing to onClose', async () => {
      const onClose = vi.fn();
      await create({ onClose });
      await open();
      keydown(input(), 'Escape');
      expect(onClose).toHaveBeenLastCalledWith('escape');
      await open();
      q('.rr-cp')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      expect(onClose).toHaveBeenLastCalledWith('overlay');
      keydown(document.body, 'k', { ctrlKey: true });
      expect(service.isOpen()).toBe(true);
      keydown(document.body, 'k', { ctrlKey: true });
      expect(onClose).toHaveBeenLastCalledWith('toggle');
      await open();
      options()[0].click();
      expect(onClose).toHaveBeenLastCalledWith('run');
      expect(onClose).toHaveBeenCalledTimes(4);
    });

    it('closeOnSelect: false keeps the window and the focus in the field after a click', async () => {
      await create({ closeOnSelect: false });
      await open();
      options()[0].click();
      await fixture.whenStable();
      expect(service.isOpen()).toBe(true);
      expect(document.activeElement).toBe(input());
    });

    it('shortcutPreventDefault: false leaves the key event alone', async () => {
      await create({ shortcutPreventDefault: false });
      const event = keydown(document.body, 'k', { ctrlKey: true });
      expect(service.isOpen()).toBe(true);
      expect(event.defaultPrevented).toBe(false);
    });

    it('the shortcut prevents the default by default', async () => {
      await create({});
      expect(keydown(document.body, 'k', { ctrlKey: true }).defaultPrevented).toBe(true);
    });

    it('position: center adds a modifier class and top does not', async () => {
      await create({ position: 'center' });
      await open();
      expect(q('.rr-cp')!.classList.contains('rr-cp-center')).toBe(true);
    });

    it('position: top (default) has no modifier class', async () => {
      await create({});
      await open();
      expect(q('.rr-cp')!.classList.contains('rr-cp-center')).toBe(false);
    });
  });
});
