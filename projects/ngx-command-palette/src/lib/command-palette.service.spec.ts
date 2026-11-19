// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import type { Command, CommandProvider } from './command.model';
import {
  CommandPaletteService,
  injectCommandProvider,
  injectCommands,
} from './command-palette.service';
import { provideCommandPalette } from './config';

const noop = () => undefined;

function setup(options: Parameters<typeof provideCommandPalette>[0] = {}) {
  localStorage.clear();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideCommandPalette({ debounceMs: 100, ...options })],
  });
  return TestBed.inject(CommandPaletteService);
}

function labels(service: CommandPaletteService) {
  return service.sections().map((s) => [s.label, s.items.map((i) => i.command.label)]);
}

describe('CommandPaletteService', () => {
  afterEach(() => vi.useRealTimers());

  it('opens, closes and toggles; closing resets the query', () => {
    const service = setup();
    service.open('abc');
    expect(service.isOpen()).toBe(true);
    expect(service.query()).toBe('abc');
    service.close();
    expect(service.isOpen()).toBe(false);
    expect(service.query()).toBe('');
    service.toggle();
    expect(service.isOpen()).toBe(true);
  });

  it('groups commands by section in registration order', () => {
    const service = setup();
    service.register([
      { id: 'home', label: 'Home', group: 'Navigation', route: '/' },
      { id: 'theme', label: 'Toggle theme', run: noop },
      { id: 'set', label: 'Settings', group: 'Navigation', route: '/settings' },
    ]);
    expect(labels(service)).toEqual([
      ['Navigation', ['Home', 'Settings']],
      ['Commands', ['Toggle theme']],
    ]);
  });

  it('filters and sorts by score with a query', () => {
    const service = setup();
    service.register([
      { id: 'a', label: 'Reset password', run: noop },
      { id: 'b', label: 'Settings', run: noop },
      { id: 'c', label: 'Open billing', run: noop },
    ]);
    service.open('set');
    expect(labels(service)).toEqual([['Commands', ['Settings', 'Reset password']]]);
    expect(service.sections()[0].items[0].segments[0]).toEqual({ text: 'Set', match: true });
  });

  it('respects maxResults', () => {
    const service = setup({ maxResults: 2 });
    service.register(['aa', 'ab', 'ac'].map((label) => ({ id: label, label, run: noop })));
    service.open('a');
    expect(service.sections()[0].items).toHaveLength(2);
  });

  it('accepts a signal and updates when it changes', () => {
    const service = setup();
    const list = signal<Command[]>([{ id: 'x', label: 'X', run: noop }]);
    service.register(list);
    expect(service.commands().map((c) => c.id)).toEqual(['x']);
    list.set([{ id: 'y', label: 'Y', run: noop }]);
    expect(service.commands().map((c) => c.id)).toEqual(['y']);
  });

  it('lets the last registration win for duplicated ids', () => {
    const service = setup();
    service.register([{ id: 'x', label: 'First', run: noop }]);
    service.register([{ id: 'x', label: 'Second', run: noop }]);
    expect(service.commands().map((c) => c.label)).toEqual(['Second']);
  });

  it('unregisters with the returned function', () => {
    const service = setup();
    const remove = service.register([{ id: 'x', label: 'X', run: noop }]);
    remove();
    expect(service.commands()).toEqual([]);
  });

  it('removes commands and providers when the component is destroyed', () => {
    const service = setup();
    @Component({ template: '' })
    class Page {
      constructor() {
        injectCommands([{ id: 'page', label: 'Page command', run: noop }]);
        injectCommandProvider({ id: 'p', group: 'P', search: async () => [] });
        // register() called in the constructor is bound to destroy as well
        TestBedService.register([{ id: 'ctor', label: 'Ctor', run: noop }]);
      }
    }
    const TestBedService = service;
    const fixture = TestBed.createComponent(Page);
    expect(service.commands().map((c) => c.id)).toEqual(['page', 'ctor']);
    fixture.destroy();
    expect(service.commands()).toEqual([]);
  });

  it('runs action commands with the query and closes', async () => {
    const service = setup();
    const run = vi.fn();
    service.register([{ id: 'x', label: 'X', run }]);
    service.open('x');
    await service.execute(service.commands()[0]);
    expect(run).toHaveBeenCalledWith({ query: 'x' });
    expect(service.isOpen()).toBe(false);
  });

  it('navigates route commands', async () => {
    const service = setup();
    const router = TestBed.inject(Router);
    const byUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await service.execute({ id: 'a', label: 'A', route: '/a?x=1' });
    await service.execute({
      id: 'b',
      label: 'B',
      route: ['/b', 2],
      navigationExtras: { fragment: 'top' },
    });
    expect(byUrl).toHaveBeenCalledWith('/a?x=1', undefined);
    expect(nav).toHaveBeenCalledWith(['/b', 2], { fragment: 'top' });
  });

  it('does not execute disabled commands', async () => {
    const service = setup();
    const run = vi.fn();
    service.open();
    await service.execute({ id: 'x', label: 'X', disabled: true, run });
    expect(run).not.toHaveBeenCalled();
    expect(service.isOpen()).toBe(true);
  });

  it('shows recents with an empty query, rebuilding route commands that are gone', async () => {
    const service = setup();
    const remove = service.register([
      { id: 'a', label: 'Alpha', run: noop },
      { id: 'b', label: 'Beta', run: noop },
    ]);
    await service.execute(service.commands()[1]);
    // an async result with a route is not registered but stays in recents
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await service.execute({
      id: 'customer-1',
      label: 'Ada Lovelace',
      group: 'Customers',
      route: '/c/1',
    });
    expect(labels(service)[0]).toEqual(['Recent', ['Ada Lovelace', 'Beta']]);
    expect(JSON.parse(localStorage.getItem('rr-cp:recent')!)).toHaveLength(2);

    remove();
    // Beta (an action) is no longer registered and cannot be rebuilt: it disappears
    expect(labels(service)[0]).toEqual(['Recent', ['Ada Lovelace']]);
    service.clearRecent();
    expect(service.sections()).toEqual([]);
  });

  it('can disable recents', async () => {
    const service = setup({ recent: false });
    service.register([{ id: 'a', label: 'Alpha', run: noop }]);
    await service.execute(service.commands()[0]);
    expect(labels(service)).toEqual([['Commands', ['Alpha']]]);
    expect(localStorage.getItem('rr-cp:recent')).toBeNull();
  });

  it('restores focus on close', () => {
    const service = setup();
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    service.open();
    (document.activeElement as HTMLElement).blur();
    service.close();
    expect(document.activeElement).toBe(button);
    button.remove();
  });

  describe('hidden commands', () => {
    it('are not listed or searched, unlike disabled ones', () => {
      const service = setup({ recent: false });
      service.register([
        { id: 'a', label: 'Alpha', run: noop },
        { id: 'b', label: 'Alpha secret', hidden: true, run: noop },
        { id: 'c', label: 'Alpha locked', disabled: true, run: noop },
      ]);
      service.open();
      expect(labels(service)).toEqual([['Commands', ['Alpha', 'Alpha locked']]]);
      service.setQuery('alpha');
      expect(labels(service)[0][1]).toEqual(['Alpha', 'Alpha locked']);
      // Still registered: only the list hides it
      expect(service.commands().map((c) => c.id)).toEqual(['a', 'b', 'c']);
    });

    it('follow a signal or a function, updating the list', () => {
      const service = setup({ recent: false });
      const loggedIn = signal(false);
      const flag = signal(false);
      service.register([
        { id: 'a', label: 'Alpha', run: noop },
        { id: 'b', label: 'Account', hidden: () => !loggedIn(), run: noop },
        { id: 'c', label: 'Admin', hidden: flag, run: noop },
      ]);
      service.open();
      const visible = () => labels(service)[0][1];
      expect(visible()).toEqual(['Alpha', 'Admin']);
      loggedIn.set(true);
      expect(visible()).toEqual(['Alpha', 'Account', 'Admin']);
      flag.set(true);
      expect(visible()).toEqual(['Alpha', 'Account']);
      loggedIn.set(false);
      expect(visible()).toEqual(['Alpha']);
      flag.set(false);
      expect(visible()).toEqual(['Alpha', 'Admin']);
    });

    it('are left out of the recents until they are visible again', async () => {
      const service = setup();
      const hidden = signal(false);
      const command: Command = { id: 'a', label: 'Alpha', hidden, run: noop };
      service.register([command]);
      await service.execute(command);
      service.open();
      expect(service.sections()[0].label).toBe('Recent');
      hidden.set(true);
      expect(service.sections()).toEqual([]);
      hidden.set(false);
      expect(service.sections()[0].label).toBe('Recent');
    });

    it('are removed from provider results, and an empty section is not shown', async () => {
      vi.useFakeTimers();
      const service = setup();
      service.registerProvider({
        id: 'p',
        group: 'Remote',
        search: async () =>
          [
            { id: 'r1', label: 'Visible', route: '/1' },
            { id: 'r2', label: 'Hidden', hidden: true, route: '/2' },
          ] as Command[],
      });
      service.registerProvider({
        id: 'q',
        group: 'Only hidden',
        search: async () => [{ id: 'r3', label: 'Nope', hidden: true, route: '/3' }] as Command[],
      });
      service.open('x');
      await vi.advanceTimersByTimeAsync(100);
      expect(labels(service)).toEqual([['Remote', ['Visible']]]);
    });
  });

  describe('sub-palettes', () => {
    const tree = (): Command[] => [
      {
        id: 'theme',
        label: 'Theme',
        children: [
          { id: 'dark', label: 'Dark', run: noop },
          { id: 'light', label: 'Light', run: noop },
          { id: 'colors', label: 'Colors', children: [{ id: 'red', label: 'Red', run: noop }] },
        ],
      },
      { id: 'home', label: 'Home', route: '/' },
    ];
    const ids = (service: CommandPaletteService) => service.path().map((p) => p.id);

    it('opens the children of a parent without closing, and clears the search', async () => {
      const service = setup();
      service.register(tree());
      service.open('the');
      await service.execute(service.commands()[0]);
      expect(service.isOpen()).toBe(true);
      expect(service.query()).toBe('');
      expect(ids(service)).toEqual(['theme']);
      expect(labels(service)).toEqual([['Commands', ['Dark', 'Light', 'Colors']]]);
    });

    it('searches only inside the current level', async () => {
      const service = setup();
      service.register(tree());
      service.open();
      await service.execute(service.commands()[0]);
      service.setQuery('home');
      expect(service.sections()).toEqual([]);
      service.setQuery('da');
      expect(labels(service)).toEqual([['Commands', ['Dark']]]);
    });

    it('goes back one or more levels and clears the search', async () => {
      const service = setup();
      service.register(tree());
      service.open();
      const theme = service.commands()[0];
      await service.execute(theme);
      await service.execute(theme.children![2]);
      expect(ids(service)).toEqual(['theme', 'colors']);
      expect(labels(service)).toEqual([['Commands', ['Red']]]);
      service.setQuery('r');
      expect(service.back()).toBe(true);
      expect(ids(service)).toEqual(['theme']);
      expect(service.query()).toBe('');
      await service.execute(theme.children![2]);
      expect(service.back(2)).toBe(true);
      expect(ids(service)).toEqual([]);
      expect(labels(service)[0][1]).toEqual(['Theme', 'Home']);
      expect(service.back()).toBe(false);
      expect(service.back(0)).toBe(false);
    });

    it('starts at the top level every time it opens', async () => {
      const service = setup();
      service.register(tree());
      service.open();
      await service.execute(service.commands()[0]);
      service.close();
      expect(ids(service)).toEqual([]);
      service.open();
      await service.execute(service.commands()[0]);
      service.open('x');
      expect(ids(service)).toEqual([]);
    });

    it('does not enter a disabled parent', async () => {
      const service = setup();
      service.register([{ id: 'p', label: 'P', disabled: true, children: [] }]);
      service.open();
      await service.execute(service.commands()[0]);
      expect(ids(service)).toEqual([]);
    });

    it('applies hidden to the children', async () => {
      const service = setup();
      service.register([
        {
          id: 'p',
          label: 'P',
          children: [
            { id: 'a', label: 'A', run: noop },
            { id: 'b', label: 'B', hidden: true, run: noop },
          ],
        },
      ]);
      service.open();
      await service.execute(service.commands()[0]);
      expect(labels(service)).toEqual([['Commands', ['A']]]);
    });

    it('follows the registered commands: removing the parent closes its level', async () => {
      const service = setup();
      const remove = service.register(tree());
      service.open();
      await service.execute(service.commands()[0]);
      expect(ids(service)).toEqual(['theme']);
      remove();
      expect(ids(service)).toEqual([]);
      expect(service.sections()).toEqual([]);
    });

    it('does not save parents in the recents, but shows the saved children at the top level', async () => {
      const service = setup();
      service.register(tree());
      service.open();
      const theme = service.commands()[0];
      await service.execute(theme);
      expect(labels(service)[0][0]).toBe('Commands');
      await service.execute(theme.children![0]);
      expect(service.isOpen()).toBe(false);
      service.open();
      expect(labels(service)).toEqual([
        ['Recent', ['Dark']],
        ['Commands', ['Theme', 'Home']],
      ]);
    });

    it('hides the recents of a hidden parent and shows no recents inside a level', async () => {
      const service = setup();
      const hidden = signal(false);
      const list: Command[] = [
        { id: 'p', label: 'P', hidden, children: [{ id: 'a', label: 'A', run: noop }] },
        { id: 'z', label: 'Z', run: noop },
      ];
      service.register(list);
      await service.execute(list[0].children![0]);
      service.open();
      expect(service.sections()[0].label).toBe('Recent');
      hidden.set(true);
      expect(labels(service)).toEqual([['Commands', ['Z']]]);
      hidden.set(false);
      await service.execute(list[0]);
      expect(labels(service)).toEqual([['Commands', ['A']]]);
    });

    it('pauses the async providers inside a level and resumes them at the top level', async () => {
      vi.useFakeTimers();
      const service = setup();
      service.register(tree());
      const search = vi.fn(async () => [{ id: 'r', label: 'Remote', route: '/r' }] as Command[]);
      service.registerProvider({ id: 'p', group: 'Remote', search });
      service.open('a');
      await service.execute(service.commands()[0]);
      service.setQuery('da');
      await vi.advanceTimersByTimeAsync(500);
      expect(search).not.toHaveBeenCalled();
      expect(service.loading()).toBe(false);
      expect(labels(service)).toEqual([['Commands', ['Dark']]]);
      service.back();
      service.setQuery('re');
      await vi.advanceTimersByTimeAsync(100);
      expect(search).toHaveBeenCalledTimes(1);
      expect(labels(service)).toContainEqual(['Remote', ['Remote']]);
    });

    it('explains that only registered commands can have children', async () => {
      const service = setup();
      const fromApi: Command = { id: 'x', label: 'X', children: [] };
      await expect(service.execute(fromApi)).rejects.toThrow('registered commands');
    });
  });

  describe('custom filter', () => {
    const commands: Command[] = [
      { id: 'a', label: 'Open settings', run: noop },
      { id: 'b', label: 'Settings of the app', run: noop },
      { id: 'c', label: 'Billing', keywords: ['settings'], run: noop },
    ];

    it('replaces the built-in search: only what the filter accepts is shown', () => {
      const filter = vi.fn((query: string, command: Command) =>
        command.label.toLowerCase().startsWith(query.toLowerCase())
          ? { score: 1, indices: Array.from({ length: query.length }, (_, i) => i) }
          : null,
      );
      const service = setup({ filter });
      service.register(commands);
      service.open('set');
      expect(labels(service)).toEqual([['Commands', ['Settings of the app']]]);
      expect(filter).toHaveBeenCalledWith('set', commands[0]);
      const [item] = service.sections()[0].items;
      expect(item.indices).toEqual([0, 1, 2]);
      expect(item.segments).toEqual([
        { text: 'Set', match: true },
        { text: 'tings of the app', match: false },
      ]);
    });

    it('ranks by the score it returns, keeping registration order on ties', () => {
      const scores: Record<string, number> = { a: 1, b: 3, c: 3 };
      const service = setup({
        filter: (_query, command) => ({ score: scores[command.id], indices: [] }),
      });
      service.register(commands);
      service.open('x');
      expect(labels(service)).toEqual([
        ['Commands', ['Settings of the app', 'Billing', 'Open settings']],
      ]);
    });

    it('still applies maxResults and is not used with an empty query', () => {
      const filter = vi.fn(() => ({ score: 1, indices: [] }));
      const service = setup({ filter, maxResults: 2, recent: false });
      service.register(commands);
      service.open();
      expect(filter).not.toHaveBeenCalled();
      expect(service.sections()[0].items).toHaveLength(3);
      service.setQuery('x');
      expect(service.sections()[0].items).toHaveLength(2);
    });

    it('does not filter async provider results', async () => {
      vi.useFakeTimers();
      const service = setup({ filter: () => null });
      service.registerProvider({
        id: 'p',
        group: 'Remote',
        search: async () => [{ id: 'r', label: 'Remote item', route: '/r' }],
      });
      service.open('zzz');
      await vi.advanceTimersByTimeAsync(100);
      expect(labels(service)).toEqual([['Remote', ['Remote item']]]);
    });

    it('uses the built-in fuzzy search by default', () => {
      const service = setup();
      service.register(commands);
      service.open('billing');
      expect(labels(service)).toEqual([['Commands', ['Billing']]]);
      service.setQuery('settings');
      expect(service.sections()[0].items.map((i) => i.command.id)).toContain('c');
    });
  });

  describe('edge cases', () => {
    it('handles zero commands', () => {
      const service = setup();
      expect(service.sections()).toEqual([]);
      service.open('anything');
      expect(service.sections()).toEqual([]);
    });

    it('updates the list when commands are added or removed while open', () => {
      const service = setup();
      service.open();
      const remove = service.register([{ id: 'a', label: 'Alpha', run: noop }]);
      expect(labels(service)).toEqual([['Commands', ['Alpha']]]);
      remove();
      expect(labels(service)).toEqual([]);
    });

    it('hides recents while searching and drops the ones that became disabled', async () => {
      const service = setup();
      const list = signal<Command[]>([
        { id: 'a', label: 'Alpha', run: noop },
        { id: 'b', label: 'Beta', run: noop },
      ]);
      service.register(list);
      await service.execute(list()[0]);
      service.open();
      expect(service.sections()[0].label).toBe('Recent');
      service.setQuery('be');
      expect(service.sections().map((s) => s.label)).not.toContain('Recent');
      service.setQuery('');
      list.set([
        { id: 'a', label: 'Alpha', disabled: true, run: noop },
        { id: 'b', label: 'Beta', run: noop },
      ]);
      expect(service.sections().map((s) => s.label)).not.toContain('Recent');
    });

    it('caps the recents at max, most recent first', async () => {
      const service = setup({ recent: { max: 2 } });
      const commands: Command[] = ['a', 'b', 'c'].map((id) => ({
        id,
        label: id.toUpperCase(),
        run: noop,
      }));
      service.register(commands);
      for (const command of commands) await service.execute(command);
      service.open();
      expect(labels(service)[0]).toEqual(['Recent', ['C', 'B']]);
    });

    it('closes before running a command and propagates its errors', async () => {
      const service = setup();
      service.open();
      const failing: Command = {
        id: 'x',
        label: 'X',
        run: () => {
          throw new Error('boom');
        },
      };
      await expect(service.execute(failing)).rejects.toThrow('boom');
      expect(service.isOpen()).toBe(false);
    });

    it('closing twice and toggling stay consistent', () => {
      const service = setup();
      service.close();
      service.open('a');
      service.open('b');
      expect(service.query()).toBe('b');
      service.close();
      service.close();
      expect(service.isOpen()).toBe(false);
    });

    it('copes with thousands of commands and still respects maxResults', () => {
      const service = setup({ maxResults: 20, recent: false });
      service.register(
        Array.from({ length: 5000 }, (_, i) => ({
          id: `c${i}`,
          label: `Command number ${i}`,
          run: noop,
        })),
      );
      service.open('4999');
      const items = service.sections().flatMap((s) => s.items);
      expect(items.length).toBeGreaterThan(0);
      expect(items.length).toBeLessThanOrEqual(20);
      expect(items[0].command.id).toBe('c4999');
    });

    it('works when localStorage is not available (e.g. SSR)', async () => {
      TestBed.configureTestingModule({ providers: [provideRouter([]), provideCommandPalette()] });
      vi.stubGlobal('localStorage', undefined);
      try {
        const service = TestBed.inject(CommandPaletteService);
        const command: Command = { id: 'a', label: 'Alpha', run: noop };
        service.register([command]);
        await service.execute(command);
        service.open();
        // Nothing can be saved, so recents live in memory only; nothing throws
        expect(labels(service)).toEqual([
          ['Recent', ['Alpha']],
          ['Commands', ['Alpha']],
        ]);
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  describe('async providers', () => {
    function provider(
      impl: CommandProvider['search'],
      extra: Partial<CommandProvider> = {},
    ): CommandProvider {
      return { id: 'customers', group: 'Customers', search: impl, ...extra };
    }

    it('debounces, sets loading and shows results', async () => {
      vi.useFakeTimers();
      const service = setup();
      const search = vi.fn(async (q: string) => [
        { id: `c-${q}`, label: `Customer ${q}`, route: '/c' } as Command,
      ]);
      service.registerProvider(provider(search));
      service.open();
      service.setQuery('a');
      service.setQuery('ad');
      expect(service.loading()).toBe(true);
      await vi.advanceTimersByTimeAsync(99);
      expect(search).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(search).toHaveBeenCalledTimes(1);
      expect(search.mock.calls[0][0]).toBe('ad');
      expect(service.loading()).toBe(false);
      expect(labels(service)).toEqual([['Customers', ['Customer ad']]]);
    });

    it('respects minQueryLength and its own debounce', async () => {
      vi.useFakeTimers();
      const service = setup();
      const search = vi.fn(async () => []);
      service.registerProvider(provider(search, { minQueryLength: 3, debounceMs: 10 }));
      service.open('ab');
      await vi.advanceTimersByTimeAsync(50);
      expect(search).not.toHaveBeenCalled();
      expect(service.loading()).toBe(false);
      service.setQuery('abc');
      await vi.advanceTimersByTimeAsync(10);
      expect(search).toHaveBeenCalledTimes(1);
    });

    it('aborts the previous request and ignores its late result', async () => {
      vi.useFakeTimers();
      const service = setup();
      const signals: AbortSignal[] = [];
      const resolvers: ((v: Command[]) => void)[] = [];
      service.registerProvider(
        provider((_q, signal) => {
          signals.push(signal);
          return new Promise<Command[]>((resolve) => resolvers.push(resolve));
        }),
      );
      service.open('one');
      await vi.advanceTimersByTimeAsync(100);
      service.setQuery('two');
      expect(signals[0].aborted).toBe(true);
      await vi.advanceTimersByTimeAsync(100);
      resolvers[1]([{ id: 'new', label: 'New', route: '/' }]);
      resolvers[0]([{ id: 'old', label: 'Old', route: '/' }]);
      await vi.advanceTimersByTimeAsync(0);
      expect(labels(service)).toEqual([['Customers', ['New']]]);
    });

    it('supports observables and errors', async () => {
      vi.useFakeTimers();
      const service = setup();
      const unsubscribe = vi.fn();
      service.registerProvider(
        provider(() => ({
          subscribe(observer) {
            observer.next?.([{ id: 'o', label: 'From observable', route: '/' }]);
            return { unsubscribe };
          },
        })),
      );
      service.registerProvider({
        id: 'broken',
        group: 'Broken',
        search: () => Promise.reject(new Error('API down')),
      });
      service.open('o');
      await vi.advanceTimersByTimeAsync(100);
      expect(labels(service)).toEqual([['Customers', ['From observable']]]);
      expect(service.loading()).toBe(false);
      service.close();
      expect(unsubscribe).toHaveBeenCalled();
    });

    it('cancels everything on close', async () => {
      vi.useFakeTimers();
      const service = setup();
      const search = vi.fn(async () => []);
      service.registerProvider(provider(search));
      service.open('a');
      service.close();
      await vi.advanceTimersByTimeAsync(500);
      expect(search).not.toHaveBeenCalled();
      expect(service.loading()).toBe(false);
    });

    it('survives a provider that throws synchronously', async () => {
      vi.useFakeTimers();
      const service = setup();
      service.registerProvider(
        provider(() => {
          throw new Error('boom');
        }),
      );
      service.open('a');
      await vi.advanceTimersByTimeAsync(100);
      expect(service.loading()).toBe(false);
      expect(service.sections()).toEqual([]);
    });

    it('searches as soon as it is registered while the palette is open', async () => {
      vi.useFakeTimers();
      const service = setup();
      const search = vi.fn(async () => [{ id: 'c1', label: 'Customer', route: '/c' }] as Command[]);
      service.open('cu');
      service.registerProvider(provider(search));
      await vi.advanceTimersByTimeAsync(100);
      expect(search).toHaveBeenCalledTimes(1);
      expect(labels(service)).toEqual([['Customers', ['Customer']]]);
    });

    it('removing a provider drops its results and cancels its request', async () => {
      vi.useFakeTimers();
      const service = setup();
      const search = vi.fn(async () => [{ id: 'c1', label: 'Customer', route: '/c' }] as Command[]);
      const remove = service.registerProvider(provider(search));
      service.open('cu');
      await vi.advanceTimersByTimeAsync(100);
      expect(labels(service)).toEqual([['Customers', ['Customer']]]);
      remove();
      expect(service.sections()).toEqual([]);
      expect(service.loading()).toBe(false);
      service.setQuery('cus');
      await vi.advanceTimersByTimeAsync(500);
      expect(search).toHaveBeenCalledTimes(1);
    });

    it('a provider registered again with the same id replaces the old one', async () => {
      vi.useFakeTimers();
      const service = setup();
      const first = vi.fn(async () => [] as Command[]);
      const second = vi.fn(async () => [] as Command[]);
      service.registerProvider(provider(first));
      service.registerProvider(provider(second));
      service.open('a');
      await vi.advanceTimersByTimeAsync(100);
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });

    it('does not apply maxResults to provider results', async () => {
      vi.useFakeTimers();
      const service = setup({ maxResults: 1 });
      const items = Array.from({ length: 5 }, (_, i) => ({
        id: `c${i}`,
        label: `Customer ${i}`,
        route: '/c',
      })) as Command[];
      service.registerProvider(provider(async () => items));
      service.open('cu');
      await vi.advanceTimersByTimeAsync(100);
      expect(service.sections()[0].items).toHaveLength(5);
    });
  });
});
