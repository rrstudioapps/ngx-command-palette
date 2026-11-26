// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

import { Component, InjectionToken, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, type Route, type Routes } from '@angular/router';

import { CommandPaletteService } from './command-palette.service';
import { provideCommandPalette, type CommandPaletteOptions } from './config';
import { routeCommands } from './route-commands';

@Component({ selector: 'rr-test-page', template: '' })
class Page {}

const ids = (routes: Routes, options = {}) =>
  routeCommands(routes, options, 'Pages').map((c) => c.route);

describe('routeCommands', () => {
  it('builds commands from paths, titles and nested children', () => {
    const commands = routeCommands(
      [
        { path: '', component: Page, title: 'Overview' },
        { path: 'user-settings', component: Page },
        { path: 'admin', title: 'Admin', children: [{ path: 'logs', component: Page }] },
      ],
      {},
      'Pages',
    );
    expect(commands.map((c) => [c.id, c.route, c.label, c.group])).toEqual([
      ['route:/', '/', 'Overview', 'Pages'],
      ['route:/user-settings', '/user-settings', 'User settings', 'Pages'],
      ['route:/admin/logs', '/admin/logs', 'Logs', 'Pages'],
    ]);
  });

  it('skips redirects, wildcards, outlets, parameters and what is below them', () => {
    expect(
      ids([
        { path: 'old', redirectTo: 'new' },
        { path: 'new', component: Page },
        { path: 'chat', outlet: 'side', component: Page },
        { path: 'users/:id', component: Page },
        { path: ':slug', children: [{ path: 'edit', component: Page }] },
        { path: '**', component: Page },
      ]),
    ).toEqual(['/new']);
  });

  it('skips routes with a custom matcher and what is below them', () => {
    const matcher = () => null;
    expect(
      ids([
        { matcher, component: Page },
        { path: 'blog', component: Page, children: [{ matcher, component: Page }] },
        { matcher, children: [{ path: 'edit', component: Page }] },
      ]),
    ).toEqual(['/blog']);
  });

  it('labels an empty-path child after its parent, not "Home"', () => {
    const commands = routeCommands(
      [
        {
          path: 'settings',
          children: [
            { path: '', component: Page },
            { path: 'profile', component: Page },
          ],
        },
        { path: '', component: Page },
      ],
      {},
      'Pages',
    );
    expect(commands.map((c) => [c.route, c.label])).toEqual([
      ['/settings', 'Settings'],
      ['/settings/profile', 'Profile'],
      ['/', 'Home'],
    ]);
  });

  it('descends into a layout without listing it', () => {
    expect(
      ids([{ path: '', component: Page, children: [{ path: 'home', component: Page }] }]),
    ).toEqual(['/home']);
  });

  it('lists a lazy route once, without looking inside it', () => {
    expect(ids([{ path: 'shop', loadChildren: () => [] }])).toEqual(['/shop']);
  });

  it('does not evaluate a title given as a resolver', () => {
    const route: Route = { path: 'docs', component: Page, title: () => 'Docs' };
    expect(routeCommands([route], {}, 'Pages')[0].label).toBe('Docs');
  });

  it('honours data.commandPalette: false and an object', () => {
    const commands = routeCommands(
      [
        { path: 'secret', component: Page, data: { commandPalette: false } },
        {
          path: 'billing',
          component: Page,
          data: { commandPalette: { label: 'Invoices', group: 'Money', keywords: ['pay'] } },
        },
      ],
      {},
      'Pages',
    );
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({ label: 'Invoices', group: 'Money', keywords: ['pay'] });
  });

  it('applies group, filter and describe', () => {
    const routes: Routes = [
      { path: 'a', component: Page },
      { path: 'b', component: Page },
      { path: 'c', component: Page },
    ];
    const commands = routeCommands(
      routes,
      {
        group: 'Go to',
        filter: (_route, url) => url !== '/a',
        describe: (_route, url) => (url === '/b' ? null : { description: `at ${url}` }),
      },
      'Pages',
    );
    expect(commands.map((c) => [c.route, c.group, c.description])).toEqual([
      ['/c', 'Go to', 'at /c'],
    ]);
  });
});

describe('routes option', () => {
  function setup(options: CommandPaletteOptions, routes: Routes) {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideCommandPalette(options)],
    });
    return TestBed.inject(CommandPaletteService);
  }
  const routes: Routes = [
    { path: 'home', component: Page, title: 'Home page' },
    { path: 'about', component: Page },
  ];

  it('is off by default', () => {
    const service = setup({}, routes);
    service.open();
    expect(service.commands()).toEqual([]);
  });

  it('adds a command per route when the palette opens', () => {
    const service = setup({ routes: true }, routes);
    expect(service.commands()).toEqual([]);
    service.open();
    expect(service.commands().map((c) => c.label)).toEqual(['Home page', 'About']);
    expect(service.sections().map((s) => s.label)).toEqual(['Pages']);
  });

  it('uses the translated group label', () => {
    const service = setup({ routes: true, labels: { routesGroup: 'Seiten' } }, routes);
    service.open();
    expect(service.sections()[0].label).toBe('Seiten');
  });

  it('lets a registered command win over a generated one (same id or same route)', () => {
    const service = setup({ routes: true }, routes);
    TestBed.runInInjectionContext(() => {
      service.register([
        { id: 'route:/home', label: 'Start', route: '/home' },
        { id: 'to-about', label: 'Who we are', route: '/about' },
      ]);
    });
    service.open();
    expect(service.commands().map((c) => c.label)).toEqual(['Start', 'Who we are']);
  });

  it('sees routes changed with resetConfig on the next open', () => {
    const service = setup({ routes: true }, routes);
    service.open();
    service.close();
    TestBed.inject(Router).resetConfig([{ path: 'new', component: Page }]);
    service.open();
    expect(service.commands().map((c) => c.route)).toEqual(['/new']);
  });

  it('still opens when filter or describe throws, keeping the previous commands', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let fail = false;
    const service = setup(
      {
        routes: {
          describe: () => {
            if (fail) throw new Error('boom');
            return {};
          },
        },
      },
      routes,
    );
    service.open();
    service.close();
    fail = true;
    expect(() => service.open()).not.toThrow();
    expect(service.isOpen()).toBe(true);
    expect(service.commands().map((c) => c.label)).toEqual(['Home page', 'About']);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it('calls filter and describe in an injection context', () => {
    const token = new InjectionToken<string>('label', { factory: () => 'From DI' });
    const service = setup(
      { routes: { describe: () => ({ label: inject(token), keywords: [] }) } },
      routes,
    );
    service.open();
    expect(service.commands().map((c) => c.label)).toEqual(['From DI', 'From DI']);
  });

  it('with a real lazy route: only the owner before loading, see the router config once loaded', async () => {
    const lazy: Routes = [
      { path: 'shop', loadChildren: () => [{ path: 'cart', component: Page }] },
    ];
    const service = setup({ routes: true }, lazy);
    service.open();
    expect(service.commands().map((c) => c.route)).toEqual(['/shop']);
    service.close();
    await TestBed.inject(Router).navigateByUrl('/shop/cart');
    service.open();
    // Loaded children are not part of the public router.config: the owner stays the only entry
    expect(service.commands().map((c) => c.route)).toEqual(['/shop']);
  });

  it('runs a generated command: it navigates and closes the palette', async () => {
    const service = setup({ routes: true }, routes);
    service.open();
    const command = service.commands().find((c) => c.id === 'route:/about');
    expect(command).toBeDefined();
    await service.execute(command!);
    expect(TestBed.inject(Router).url).toBe('/about');
    expect(service.isOpen()).toBe(false);
  });

  it('works without browser globals (SSR)', () => {
    const service = setup({ routes: true }, routes);
    vi.stubGlobal('localStorage', undefined);
    try {
      service.open();
      expect(service.commands().map((c) => c.route)).toEqual(['/home', '/about']);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does nothing without provideRouter()', () => {
    TestBed.configureTestingModule({ providers: [provideCommandPalette({ routes: true })] });
    const service = TestBed.inject(CommandPaletteService);
    service.open();
    expect(service.commands()).toEqual([]);
  });
});
