// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

// Guards the search speed with thousands of commands. The limits are generous (about 10 times the
// time measured on a small server) so that a slow CI machine does not make them flaky:
// they only catch a real regression, like the quadratic scoring that was removed in 0.3.0.

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { Command } from './command.model';
import { CommandPaletteService } from './command-palette.service';
import { provideCommandPalette } from './config';

const WORDS = ['project', 'invoice', 'customer', 'settings', 'report', 'billing', 'team', 'export'];

function makeCommands(count: number): Command[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `c${i}`,
    label: `${WORDS[i % WORDS.length]} ${WORDS[(i * 7) % WORDS.length]} number ${i}`,
    description: `Generated command ${i}`,
    keywords: [WORDS[(i * 3) % WORDS.length]],
    run: () => undefined,
  }));
}

function time(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

describe('search performance', () => {
  const COUNT = 5000;
  let service: CommandPaletteService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideCommandPalette()] });
    service = TestBed.inject(CommandPaletteService);
    service.register(makeCommands(COUNT));
    service.open();
  });

  it('lists the first commands of an empty search quickly', () => {
    expect(time(() => service.sections())).toBeLessThan(250);
  });

  it('searches 5000 commands quickly', () => {
    const queries = ['proj', 'inv num 4', 'zzzz', 'billing report', 'ex'];
    const worst = Math.max(
      ...queries.map((q) =>
        time(() => {
          service.setQuery(q);
          service.sections();
        }),
      ),
    );
    expect(worst).toBeLessThan(500);
  });
});
