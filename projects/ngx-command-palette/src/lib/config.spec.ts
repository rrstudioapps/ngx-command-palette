// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

import { TestBed } from '@angular/core/testing';

import {
  COMMAND_PALETTE_CONFIG,
  DEFAULT_COMMAND_PALETTE_CONFIG,
  DEFAULT_COMMAND_PALETTE_LABELS,
  provideCommandPalette,
  resolveConfig,
} from './config';

describe('resolveConfig', () => {
  it('returns the defaults without options', () => {
    expect(resolveConfig()).toEqual(DEFAULT_COMMAND_PALETTE_CONFIG);
  });

  it('overrides top-level options and keeps the other defaults', () => {
    const config = resolveConfig({ debounceMs: 50, theme: 'dark', shortcut: ['mod+k', '/'] });
    expect(config.debounceMs).toBe(50);
    expect(config.theme).toBe('dark');
    expect(config.shortcut).toEqual(['mod+k', '/']);
    expect(config.maxResults).toBe(DEFAULT_COMMAND_PALETTE_CONFIG.maxResults);
  });

  it('merges partial labels with the default ones', () => {
    const { labels } = resolveConfig({ labels: { empty: 'Nada', recent: 'Recientes' } });
    expect(labels.empty).toBe('Nada');
    expect(labels.recent).toBe('Recientes');
    expect(labels.placeholder).toBe(DEFAULT_COMMAND_PALETTE_LABELS.placeholder);
  });

  it('merges partial recent options and can disable recents', () => {
    expect(resolveConfig({ recent: { max: 2 } }).recent).toEqual({
      max: 2,
      storageKey: 'rr-cp:recent',
    });
    expect(resolveConfig({ recent: { storageKey: 'k' } }).recent).toEqual({
      max: 5,
      storageKey: 'k',
    });
    expect(resolveConfig({ recent: false }).recent).toBe(false);
  });

  it('does not change the shared defaults', () => {
    resolveConfig({ labels: { empty: 'x' }, recent: { max: 1 } });
    expect(DEFAULT_COMMAND_PALETTE_LABELS.empty).toBe('No results found.');
    expect(DEFAULT_COMMAND_PALETTE_CONFIG.recent).toEqual({ max: 5, storageKey: 'rr-cp:recent' });
  });
});

describe('provideCommandPalette', () => {
  it('provides the defaults when it is not used', () => {
    expect(TestBed.inject(COMMAND_PALETTE_CONFIG)).toEqual(DEFAULT_COMMAND_PALETTE_CONFIG);
  });

  it('provides the resolved config', () => {
    TestBed.configureTestingModule({ providers: [provideCommandPalette({ maxResults: 7 })] });
    const config = TestBed.inject(COMMAND_PALETTE_CONFIG);
    expect(config.maxResults).toBe(7);
    expect(config.labels).toEqual(DEFAULT_COMMAND_PALETTE_LABELS);
  });
});
