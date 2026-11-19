// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

import type { Command } from './command.model';

/** What is saved for a recent command: only serializable fields, never functions. */
export interface RecentEntry {
  readonly id: string;
  readonly label: string;
  readonly group?: string;
  readonly description?: string;
  readonly route?: string | readonly unknown[];
}

/**
 * Recent commands in `localStorage` (most recent first). Every access is guarded:
 * private windows, SSR or blocked storage just mean "no recents".
 */
export class RecentStore {
  constructor(
    private readonly storageKey: string,
    private readonly max: number,
    private readonly storage: Pick<
      Storage,
      'getItem' | 'setItem' | 'removeItem'
    > | null = defaultStorage(),
  ) {}

  load(): RecentEntry[] {
    if (!this.storage || this.max <= 0) return [];
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isEntry).slice(0, this.max);
    } catch {
      return [];
    }
  }

  /** Moves `command` to the top and returns the new list. */
  add(command: Command, current: readonly RecentEntry[] = this.load()): RecentEntry[] {
    if (this.max <= 0) return [];
    const entry: RecentEntry = {
      id: command.id,
      label: command.label,
      ...(command.group ? { group: command.group } : {}),
      ...(command.description ? { description: command.description } : {}),
      ...(command.route !== undefined && isSerializable(command.route)
        ? { route: command.route }
        : {}),
    };
    const next = [entry, ...current.filter((e) => e.id !== command.id)].slice(0, this.max);
    this.save(next);
    return next;
  }

  clear(): void {
    try {
      this.storage?.removeItem(this.storageKey);
    } catch {
      /* storage non disponibile */
    }
  }

  private save(entries: readonly RecentEntry[]): void {
    try {
      this.storage?.setItem(this.storageKey, JSON.stringify(entries));
    } catch {
      /* quota piena o storage bloccato: i recenti restano solo in memoria */
    }
  }
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
