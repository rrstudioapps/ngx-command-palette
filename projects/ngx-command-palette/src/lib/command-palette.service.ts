// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

import {
  DestroyRef,
  DOCUMENT,
  Injectable,
  Signal,
  assertInInjectionContext,
  computed,
  inject,
  isSignal,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import type {
  Command,
  CommandProvider,
  CommandResult,
  CommandSection,
  CommandSubscribable,
} from './command.model';
import { COMMAND_PALETTE_CONFIG, type CommandPaletteRecentOptions } from './config';
import { fuzzyMatch, highlightSegments } from './fuzzy';
import { RecentStore, type RecentEntry } from './recent-store';

interface Registration {
  readonly source: () => readonly Command[];
}

interface ProviderState {
  readonly items: readonly Command[];
  readonly loading: boolean;
  readonly error?: unknown;
}

/** In-flight provider request: debounce timer, abort controller and subscription. */
interface PendingRequest {
  timer?: ReturnType<typeof setTimeout>;
  controller?: AbortController;
  subscription?: { unsubscribe(): void };
}

export const RECENT_SECTION_ID = 'recent';

/**
 * State of the command palette. Register commands from any component: they are removed
 * automatically when that component is destroyed.
 */
@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private readonly config = inject(COMMAND_PALETTE_CONFIG);
  private readonly router = inject(Router, { optional: true });
  private readonly document = inject(DOCUMENT);

  private readonly recentStore = this.config.recent
    ? new RecentStore(
        (this.config.recent as CommandPaletteRecentOptions).storageKey ?? 'rr-cp:recent',
        (this.config.recent as CommandPaletteRecentOptions).max ?? 5,
      )
    : null;

  private readonly _isOpen = signal(false);
  private readonly _query = signal('');
  private readonly registrations = signal<readonly Registration[]>([]);
  private readonly providers = signal<readonly CommandProvider[]>([]);
  private readonly providerState = signal<ReadonlyMap<string, ProviderState>>(new Map());
  private readonly recents = signal<readonly RecentEntry[]>(this.recentStore?.load() ?? []);
  private readonly pending = new Map<string, PendingRequest>();
  private returnFocus: HTMLElement | null = null;

  /** Whether the palette is open. */
  readonly isOpen = this._isOpen.asReadonly();
  /** Current search text. */
  readonly query = this._query.asReadonly();

  /** All registered (synchronous) commands. When two share an id, the last registered wins. */
  readonly commands: Signal<readonly Command[]> = computed(() => {
    const byId = new Map<string, Command>();
    for (const registration of this.registrations()) {
      for (const command of registration.source()) {
        byId.delete(command.id);
        byId.set(command.id, command);
      }
    }
    return [...byId.values()];
  });

  /** True while at least one async provider is waiting for results. */
  readonly loading = computed(() => [...this.providerState().values()].some((s) => s.loading));

  /** Sections shown in the list, already filtered and sorted. */
  readonly sections: Signal<readonly CommandSection[]> = computed(() =>
    this.buildSections(this._query().trim()),
  );

  /** Opens the palette, optionally with an initial query. */
  open(query = ''): void {
    if (!this._isOpen()) {
      const active = this.document.activeElement;
      // No instanceof HTMLElement: the class does not exist during SSR
      this.returnFocus =
        active &&
        active !== this.document.body &&
        typeof (active as HTMLElement).focus === 'function'
          ? (active as HTMLElement)
          : null;
    }
    this._isOpen.set(true);
    this.setQuery(query);
  }

  /** Closes the palette, cancels pending searches and restores the focus. */
  close(): void {
    if (!this._isOpen()) return;
    this._isOpen.set(false);
    this.cancelAll();
    this._query.set('');
    this.providerState.set(new Map());
    const target = this.returnFocus;
    this.returnFocus = null;
    if (target?.isConnected) target.focus({ preventScroll: true });
  }

  toggle(): void {
    if (this._isOpen()) this.close();
    else this.open();
  }

  /** Updates the search text and schedules the async providers. */
  setQuery(query: string): void {
    this._query.set(query);
    if (this._isOpen()) this.scheduleProviders();
  }

  /**
   * Registers commands (an array or a signal of arrays). Called in an injection context
   * (constructor, field initializer) they are removed when that context is destroyed.
   * Returns a function that removes them earlier.
   */
  register(
    commands: readonly Command[] | Signal<readonly Command[]>,
    destroyRef?: DestroyRef,
  ): () => void {
    const registration: Registration = { source: isSignal(commands) ? commands : () => commands };
    this.registrations.update((list) => [...list, registration]);
    const remove = () =>
      this.registrations.update((list) => list.filter((r) => r !== registration));
    return this.bindToDestroy(remove, destroyRef);
  }

  /** Registers an async provider. Same lifetime rules as {@link register}. */
  registerProvider(provider: CommandProvider, destroyRef?: DestroyRef): () => void {
    this.providers.update((list) => [...list.filter((p) => p.id !== provider.id), provider]);
    if (this._isOpen()) this.scheduleProvider(provider, this._query());
    const remove = () => {
      if (!this.providers().includes(provider)) return;
      this.cancel(provider.id);
      this.providers.update((list) => list.filter((p) => p !== provider));
      this.providerState.update((map) => {
        const next = new Map(map);
        next.delete(provider.id);
        return next;
      });
    };
    return this.bindToDestroy(remove, destroyRef);
  }

  /** Executes a command: saves it in the recents, closes the palette, then navigates or runs it. */
  async execute(command: Command): Promise<void> {
    if (command.disabled) return;
    const query = this._query();
    if (this.recentStore) this.recents.set(this.recentStore.add(command, this.recents()));
    this.close();
    if (command.route !== undefined) {
      if (!this.router) throw new Error('ngx-command-palette: route commands need provideRouter()');
      const { route, navigationExtras } = command;
      await (typeof route === 'string'
        ? this.router.navigateByUrl(route, navigationExtras)
        : this.router.navigate(route as unknown[], navigationExtras));
    } else {
      await command.run({ query });
    }
  }

  /** Removes all recents. */
  clearRecent(): void {
    this.recentStore?.clear();
    this.recents.set([]);
  }

  // ---- internals ----

  private bindToDestroy(remove: () => void, destroyRef?: DestroyRef): () => void {
    const ref = destroyRef ?? currentDestroyRef();
    const unsubscribe = ref?.onDestroy(remove);
    return () => {
      unsubscribe?.();
      remove();
    };
  }

  private buildSections(query: string): CommandSection[] {
    const defaultGroup = this.config.labels.defaultGroup;
    const commands = this.commands();
    const groups = new Map<string, CommandResult[]>();
    const push = (group: string, result: CommandResult) => {
      const list = groups.get(group);
      if (list) list.push(result);
      else groups.set(group, [result]);
    };
    const sections: CommandSection[] = [];

    if (!query) {
      const recent = this.recentResults(commands);
      if (recent.length)
        sections.push({ id: RECENT_SECTION_ID, label: this.config.labels.recent, items: recent });
      for (const command of commands) {
        const group = command.group ?? defaultGroup;
        push(group, toResult(command, `g:${group}:${command.id}`, 0, []));
      }
    } else {
      const scored: CommandResult[] = [];
      for (const command of commands) {
        const match = this.config.filter(query, command);
        if (!match) continue;
        const group = command.group ?? defaultGroup;
        scored.push(toResult(command, `g:${group}:${command.id}`, match.score, match.indices));
      }
      // Stable sort: equal scores keep the registration order
      scored.sort((a, b) => b.score - a.score);
      for (const result of scored.slice(0, this.config.maxResults)) {
        push(result.command.group ?? defaultGroup, result);
      }
    }
    for (const [label, items] of groups) sections.push({ id: `g:${label}`, label, items });

    // Async results: server order, highlighted when the label matches
    const states = this.providerState();
    for (const provider of this.providers()) {
      const state = states.get(provider.id);
      if (!state?.items.length) continue;
      const items = state.items.map((command) => {
        const match = query ? fuzzyMatch(query, command.label) : null;
        return toResult(
          command,
          `p:${provider.id}:${command.id}`,
          match?.score ?? 0,
          match?.indices ?? [],
        );
      });
      sections.push({ id: `p:${provider.id}`, label: provider.group, items });
    }
    return sections;
  }

  private recentResults(commands: readonly Command[]): CommandResult[] {
    if (!this.recentStore) return [];
    const byId = new Map(commands.map((c) => [c.id, c]));
    const results: CommandResult[] = [];
    for (const entry of this.recents()) {
      // Still registered, or rebuilt from the saved route (e.g. a customer from an API)
      const command: Command | undefined =
        byId.get(entry.id) ??
        (entry.route !== undefined
          ? {
              id: entry.id,
              label: entry.label,
              route: entry.route,
              ...(entry.group ? { group: entry.group } : {}),
              ...(entry.description ? { description: entry.description } : {}),
            }
          : undefined);
      if (command && !command.disabled) results.push(toResult(command, `r:${entry.id}`, 0, []));
    }
    return results;
  }

  private scheduleProviders(): void {
    const query = this._query();
    for (const provider of this.providers()) this.scheduleProvider(provider, query);
  }

  private scheduleProvider(provider: CommandProvider, rawQuery: string): void {
    this.cancel(provider.id);
    const query = rawQuery.trim();
    if (query.length < (provider.minQueryLength ?? 1)) {
      this.setProviderState(provider.id, null);
      return;
    }
    const previous = this.providerState().get(provider.id);
    this.setProviderState(provider.id, { items: previous?.items ?? [], loading: true });
    const request: PendingRequest = {};
    this.pending.set(provider.id, request);
    request.timer = setTimeout(() => {
      request.timer = undefined;
      const controller = new AbortController();
      request.controller = controller;
      const done = (state: ProviderState) => {
        if (!controller.signal.aborted && this.pending.get(provider.id) === request) {
          this.setProviderState(provider.id, state);
        }
      };
      let result: ReturnType<CommandProvider['search']>;
      try {
        result = provider.search(query, controller.signal);
      } catch (error) {
        done({ items: [], loading: false, error });
        return;
      }
      if (isSubscribable(result)) {
        request.subscription = result.subscribe({
          next: (items) => done({ items, loading: false }),
          error: (error) => done({ items: [], loading: false, error }),
          complete: () => {
            const state = this.providerState().get(provider.id);
            if (state?.loading) done({ items: state.items, loading: false });
          },
        });
      } else {
        Promise.resolve(result).then(
          (items) => done({ items, loading: false }),
          (error: unknown) => done({ items: [], loading: false, error }),
        );
      }
    }, provider.debounceMs ?? this.config.debounceMs);
  }

  private setProviderState(id: string, state: ProviderState | null): void {
    this.providerState.update((map) => {
      const next = new Map(map);
      if (state) next.set(id, state);
      else next.delete(id);
      return next;
    });
  }

  private cancel(id: string): void {
    const request = this.pending.get(id);
    if (!request) return;
    this.pending.delete(id);
    if (request.timer) clearTimeout(request.timer);
    request.controller?.abort();
    request.subscription?.unsubscribe();
  }

  private cancelAll(): void {
    for (const id of [...this.pending.keys()]) this.cancel(id);
  }
}

function toResult(
  command: Command,
  key: string,
  score: number,
  indices: readonly number[],
): CommandResult {
  return { command, key, score, indices, segments: highlightSegments(command.label, indices) };
}

function isSubscribable<T>(value: unknown): value is CommandSubscribable<T> {
  return !!value && typeof (value as { subscribe?: unknown }).subscribe === 'function';
}

function currentDestroyRef(): DestroyRef | null {
  try {
    return inject(DestroyRef, { optional: true });
  } catch {
    // Outside an injection context: removal stays manual
    return null;
  }
}

/**
 * Registers commands for the lifetime of the current component/service.
 * Must be called in an injection context.
 */
export function injectCommands(
  commands: readonly Command[] | Signal<readonly Command[]>,
): () => void {
  assertInInjectionContext(injectCommands);
  return inject(CommandPaletteService).register(commands, inject(DestroyRef));
}

/** Registers an async provider for the lifetime of the current component/service. */
export function injectCommandProvider(provider: CommandProvider): () => void {
  assertInInjectionContext(injectCommandProvider);
  return inject(CommandPaletteService).registerProvider(provider, inject(DestroyRef));
}
