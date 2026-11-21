// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

import type { Command } from './command.model';
import type { RecentStorage } from './config';

/** What is saved for a recent command: only serializable fields, never functions. */
export interface RecentEntry {
  readonly id: string;
  readonly label: string;
  readonly group?: string;
  readonly description?: string;
  readonly route?: string | readonly unknown[];
  /** Times executed (used by the `frequent` ranking). */
  readonly count?: number;
  /** When it was last executed, in ms since the epoch. */
  readonly at?: number;
}

/**
 * Recent commands in `localStorage` or a custom storage (most recent first). Every access is guarded:
 * private windows, SSR or blocked storage just mean "no recents".
 */
export class RecentStore {
  constructor(
    private readonly storageKey: string,
    private readonly max: number,
    private readonly storage: RecentStorage | null = defaultStorage(),
    private readonly rank: 'recent' | 'frequent' = 'recent',
  ) {}

  load(): RecentEntry[] {
    if (!this.storage || this.max <= 0) return [];
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return this.order(parsed.filter(isEntry), Date.now()).slice(0, this.max);
    } catch {
      return [];
    }
  }

  /** Records an execution of `command` and returns the new list (most relevant first). */
  add(
    command: Command,
    current: readonly RecentEntry[] = this.load(),
    now = Date.now(),
  ): RecentEntry[] {
    if (this.max <= 0) return [];
    const previous = current.find((e) => e.id === command.id);
    const entry: RecentEntry = {
      id: command.id,
      label: command.label,
      ...(this.rank === 'frequent'
        ? { count: (previous?.count ?? (previous ? 1 : 0)) + 1, at: now }
        : {}),
      ...(command.group ? { group: command.group } : {}),
      ...(command.description ? { description: command.description } : {}),
      ...(command.route !== undefined && isSerializable(command.route)
        ? { route: command.route }
        : {}),
    };
    const next = this.order([entry, ...current.filter((e) => e.id !== command.id)], now).slice(
      0,
      this.max,
    );
    this.save(next);
    return next;
  }

  clear(): void {
    try {
      this.storage?.removeItem(this.storageKey);
    } catch {
      /* storage not available */
    }
  }

  /** `recent`: the given order (newest first). `frequent`: by score, newest first on a tie. */
  private order(entries: RecentEntry[], now: number): RecentEntry[] {
    if (this.rank !== 'frequent') return entries;
    return entries
      .map((entry, index) => ({ entry, index, score: frecency(entry, now) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map((x) => x.entry);
  }

  private save(entries: readonly RecentEntry[]): void {
    try {
      this.storage?.setItem(this.storageKey, JSON.stringify(entries));
    } catch {
      /* quota exceeded or storage blocked: recents stay in memory only */
    }
  }
}

const HALF_LIFE_MS = 7 * 24 * 3600 * 1000;

/** Executions weighted by recency: the weight halves every 7 days. Entries without data count once, now. */
export function frecency(entry: RecentEntry, now: number): number {
  const age = entry.at === undefined ? 0 : Math.max(0, now - entry.at);
  return (entry.count ?? 1) * Math.pow(0.5, age / HALF_LIFE_MS);
}

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function isEntry(value: unknown): value is RecentEntry {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v['id'] === 'string' && typeof v['label'] === 'string';
}

function isSerializable(route: unknown): boolean {
  try {
    JSON.stringify(route);
    return typeof route === 'string' || Array.isArray(route);
  } catch {
    return false;
  }
}
