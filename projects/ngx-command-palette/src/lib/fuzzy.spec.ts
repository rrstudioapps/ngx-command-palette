// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

import type { Command } from './command.model';
import { fuzzyMatch, highlightSegments, matchCommand } from './fuzzy';

describe('fuzzyMatch', () => {
  it('matches an empty query with score 0', () => {
    expect(fuzzyMatch('', 'Anything')).toEqual({ score: 0, indices: [] });
  });

  it('returns null when characters are missing or out of order', () => {
    expect(fuzzyMatch('xyz', 'Open settings')).toBeNull();
    expect(fuzzyMatch('tes', 'set')).toBeNull();
    expect(fuzzyMatch('longer than text', 'short')).toBeNull();
  });

  it('is case and accent insensitive', () => {
    expect(fuzzyMatch('CAFE', 'Café menu')?.indices).toEqual([0, 1, 2, 3]);
    expect(fuzzyMatch('città', 'Citta')).not.toBeNull();
  });

  it('ignores spaces in the query', () => {
    expect(fuzzyMatch('new proj', 'New project')?.indices).toEqual([0, 1, 2, 4, 5, 6, 7]);
  });

  it('prefers word starts over scattered letters', () => {
    // "gs" deve prendere le iniziali di "Go to Settings", non la "s" di "Go" o altre
    expect(fuzzyMatch('gs', 'Go to Settings')?.indices).toEqual([0, 6]);
    expect(fuzzyMatch('np', 'New project')?.indices).toEqual([0, 4]);
  });

  it('recognizes camelCase boundaries', () => {
    expect(fuzzyMatch('tb', 'toggleBold')?.indices).toEqual([0, 6]);
  });

  it('ranks consecutive and prefix matches higher', () => {
    const prefix = fuzzyMatch('set', 'Settings')!.score;
    const inner = fuzzyMatch('set', 'Reset password')!.score;
    const scattered = fuzzyMatch('set', 'Sales report table')!.score;
    expect(prefix).toBeGreaterThan(inner);
    expect(inner).toBeGreaterThan(scattered);
  });

  it('prefers the shorter text for equal matches', () => {
    expect(fuzzyMatch('home', 'Home')!.score).toBeGreaterThan(
      fuzzyMatch('home', 'Home page')!.score,
    );
  });

  it('finds the best alignment, not the first one', () => {
    // la prima "a" è in "Data", ma il match migliore è l'inizio di "Analytics"
    expect(fuzzyMatch('an', 'Data Analytics')?.indices).toEqual([5, 6]);
  });
});

describe('highlightSegments', () => {
  it('splits text into matched and unmatched parts', () => {
    expect(highlightSegments('Settings', [0, 1, 2])).toEqual([
      { text: 'Set', match: true },
      { text: 'tings', match: false },
    ]);
    expect(highlightSegments('abc', [1])).toEqual([
      { text: 'a', match: false },
      { text: 'b', match: true },
      { text: 'c', match: false },
    ]);
  });

  it('returns the whole text when nothing matched', () => {
    expect(highlightSegments('abc', [])).toEqual([{ text: 'abc', match: false }]);
    expect(highlightSegments('', [])).toEqual([]);
  });
});

describe('matchCommand', () => {
  const command: Command = {
    id: 'theme',
    label: 'Toggle theme',
    description: 'Switch between light and dark',
    keywords: ['appearance', 'night'],
    run: () => undefined,
  };

  it('matches the label with highlight indices', () => {
    expect(matchCommand('tog', command)?.indices).toEqual([0, 1, 2]);
  });

  it('matches keywords without label highlight', () => {
    const m = matchCommand('night', command);
    expect(m).not.toBeNull();
    expect(m?.indices).toEqual([]);
  });

  it('matches the description with a lower weight than the label', () => {
    const viaDescription = matchCommand('light', command)!;
    const viaLabel = matchCommand('light', { ...command, label: 'Light mode' })!;
    expect(viaDescription.score).toBeLessThan(viaLabel.score);
  });

  it('ignores scattered letters in description and keywords', () => {
    const install: Command = {
      id: 'i',
      label: 'Copy install command',
      description: 'npm i @rrstudioapps/ngx-command-palette',
      run: () => undefined,
    };
    expect(matchCommand('set', install)).toBeNull();
    expect(matchCommand('npm', install)).not.toBeNull();
    expect(matchCommand('ngx', install)).not.toBeNull();
  });

  it('returns null when nothing matches', () => {
    expect(matchCommand('zzz', command)).toBeNull();
  });
});
