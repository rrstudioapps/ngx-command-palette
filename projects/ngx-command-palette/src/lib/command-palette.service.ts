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
  ActionCommand,
  ParentCommand,
} from './command.model';
import {
  COMMAND_PALETTE_CONFIG,
  type CommandPaletteRecentOptions,
  type CommandPrefix,
} from './config';
import { fuzzyMatch, highlightSegments } from './fuzzy';
import { matchesShortcut, parseShortcut } from './shortcut';
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
export const PINNED_SECTION_ID = 'pinned';

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
        (this.config.recent as CommandPaletteRecentOptions).storage,
        (this.config.recent as CommandPaletteRecentOptions).rank,
      )
    : null;

  private readonly _isOpen = signal(false);
  private readonly _query = signal('');
  private readonly registrations = signal<readonly Registration[]>([]);
  private readonly providers = signal<readonly CommandProvider[]>([]);
  private readonly providerState = signal<ReadonlyMap<string, ProviderState>>(new Map());
  private readonly recents = signal<readonly RecentEntry[]>(this.recentStore?.load() ?? []);
  private readonly pending = new Map<string, PendingRequest>();
  private readonly pathIds = signal<readonly string[]>([]);
  private readonly promptCommand = signal<ActionCommand | null>(null);
  private returnFocus: HTMLElement | null = null;

  /** Whether the palette is open. */
  readonly isOpen = this._isOpen.asReadonly();
  /** The command asking for a value (see `prompt`), while its second step is shown. */
  readonly prompt = this.promptCommand.asReadonly();
  /** Current search text. */
  readonly query = this._query.asReadonly();

  /**
   * Sub-palettes currently open, outermost first (empty at the top level). It follows the registered
   * commands: if a parent is removed or replaced while open, the path shrinks to what still exists.
   */
  readonly path: Signal<readonly ParentCommand[]> = computed(() => {
    const path: ParentCommand[] = [];
    let level: readonly Command[] = this.commands();
    for (const id of this.pathIds()) {
      const parent = level.find((c): c is ParentCommand => c.id === id && isParent(c));
      if (!parent) break;
      path.push(parent);
      level = parent.children;
    }
    return path;
  });

  /** The commands of the level being shown: the top level or the children of the last parent. */
  private readonly levelCommands: Signal<readonly Command[]> = computed(() => {
    const path = this.path();
    return path.length ? path[path.length - 1].children : this.commands();
  });

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

  /** The search mode (see the `prefixes` option) the current search starts with, if any. */
  readonly activePrefix: Signal<CommandPrefix | null> = computed(
    () => this.parseQuery(this._query()).prefix,
  );

  /** Sections shown in the list, already filtered and sorted. */
  readonly sections: Signal<readonly CommandSection[]> = computed(() =>
    this.buildSections(this._query()),
  );

  /** Leaf commands with a `hotkey`, not hidden. */
  private readonly hotkeyCommands = computed(() =>
    descendants(this.commands()).filter((c) => c.hotkey && !isParent(c)),
  );

  /**
   * Runs the command bound to the key event, if any (called by the component for every keydown).
   * Returns true when a command matched, so the caller can `preventDefault()`.
   */
  runHotkey(event: KeyboardEvent, apple: boolean): boolean {
    if (this._isOpen()) return false;
    for (const command of this.hotkeyCommands()) {
      const keys = typeof command.hotkey === 'string' ? [command.hotkey] : (command.hotkey ?? []);
      if (!keys.some((k) => matchesShortcut(event, parseShortcut(k), apple))) continue;
      if (command.disabled) return false;
      void this.execute(command);
      return true;
    }
    return false;
  }

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
    this.pathIds.set([]);
    this.promptCommand.set(null);
    this.setQuery(query);
  }

  /** Closes the palette, cancels pending searches and restores the focus. */
  close(): void {
    if (!this._isOpen()) return;
    this._isOpen.set(false);
    this.cancelAll();
    this._query.set('');
    this.pathIds.set([]);
    this.promptCommand.set(null);
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
   * Goes back `levels` levels of a sub-palette or value step (one by default) and clears the search.
   * Returns `false`, doing nothing, when the top level is already shown.
   */
  back(levels = 1): boolean {
    const path = this.path();
    let remaining = levels;
    if (levels < 1 || !(path.length || this.promptCommand())) return false;
    if (this.promptCommand()) {
      this.promptCommand.set(null);
      remaining--;
    }
    if (remaining > 0) {
      this.pathIds.set(path.slice(0, Math.max(0, path.length - remaining)).map((c) => c.id));
    }
    this.setQuery('');
    return true;
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
    if (this._isOpen() && !this.pathIds().length && !this.promptCommand())
      this.scheduleProvider(provider, this._query());
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
    if (isParent(command)) {
      if (!this.levelCommands().some((c) => c.id === command.id)) {
        throw new Error('ngx-command-palette: only registered commands can have children');
      }
      // Providers search the top level only: drop their requests and results while inside a sub-palette
      this.cancelAll();
      this.providerState.set(new Map());
      this.pathIds.update((ids) => [...ids, command.id]);
      this.setQuery('');
      return;
    }
    let query = this.parseQuery(this._query()).text;
    let value: string | undefined;
    if (!isParent(command) && command.prompt !== undefined) {
      if (this.promptCommand()?.id !== command.id) {
        // First step: ask for the value
        this.cancelAll();
        this.providerState.set(new Map());
        this.promptCommand.set(command as ActionCommand);
        this.setQuery('');
        return;
      }
      query = value = this._query().trim();
      if (!value) return;
    }
    if (this.recentStore) this.recents.set(this.recentStore.add(command, this.recents()));
    this.close();
    if (command.route !== undefined) {
      if (!this.router) throw new Error('ngx-command-palette: route commands need provideRouter()');
      const { route, navigationExtras } = command;
      await (typeof route === 'string'
        ? this.router.navigateByUrl(route, navigationExtras)
        : this.router.navigate(route as unknown[], navigationExtras));
    } else {
      await command.run(value === undefined ? { query } : { query, value });
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

  /** Splits the raw search into the mode it starts with (if any) and the text to search. */
  private parseQuery(raw: string): { prefix: CommandPrefix | null; text: string } {
    const trimmed = raw.trim();
    const prefix =
      this.config.prefixes.find((p) => p.prefix && trimmed.startsWith(p.prefix)) ?? null;
    return { prefix, text: prefix ? trimmed.slice(prefix.prefix.length).trim() : trimmed };
  }

  private buildSections(rawQuery: string): CommandSection[] {
    const defaultGroup = this.config.labels.defaultGroup;
    const prompt = this.promptCommand();
    if (prompt) {
      const items = [toResult(prompt, `x:${prompt.id}`, 0, [])];
      return [{ id: 'prompt', label: prompt.group ?? defaultGroup, items }];
    }
    const { prefix, text: query } = this.parseQuery(rawQuery);
    const levelCommands = this.levelCommands();
    const commands = prefix
      ? levelCommands.filter((c) => inPrefix(c, prefix, defaultGroup))
      : levelCommands;
    const groups = new Map<string, CommandResult[]>();
    const push = (group: string, result: CommandResult) => {
      const list = groups.get(group);
      if (list) list.push(result);
      else groups.set(group, [result]);
    };
    const sections: CommandSection[] = [];

    const topLevel = !this.pathIds().length;
    if (!query) {
      const pinned = prefix
        ? []
        : commands
            .filter((c) => !isHidden(c) && isPinned(c))
            .map((c) => toResult(c, `pin:${c.id}`, 0, []));
      if (pinned.length)
        sections.push({ id: PINNED_SECTION_ID, label: this.config.labels.pinned, items: pinned });
      const pinnedIds = new Set(pinned.map((r) => r.command.id));
      const recent =
        topLevel && !prefix
          ? this.recentResults(commands).filter((r) => !pinnedIds.has(r.command.id))
          : [];
      if (recent.length)
        sections.push({ id: RECENT_SECTION_ID, label: this.config.labels.recent, items: recent });
      let listed = 0;
      for (const command of commands) {
        if (isHidden(command)) continue;
        if (listed++ >= this.config.maxEmptyResults) break;
        const group = command.group ?? defaultGroup;
        push(group, toResult(command, `g:${group}:${command.id}`, 0, []));
      }
    } else {
      const scored: CommandResult[] = [];
      for (const command of commands) {
        if (isHidden(command)) continue;
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
    for (const provider of topLevel ? this.providers() : []) {
      if (prefix && (prefix.kind || (prefix.groups && !prefix.groups.includes(provider.group))))
        continue;
      const state = states.get(provider.id);
      if (!state?.items.length) continue;
      const items = state.items
        .filter((command) => !isHidden(command))
        .map((command) => {
          const match = query ? fuzzyMatch(query, command.label) : null;
          return toResult(
            command,
            `p:${provider.id}:${command.id}`,
            match?.score ?? 0,
            match?.indices ?? [],
          );
        });
      if (items.length) sections.push({ id: `p:${provider.id}`, label: provider.group, items });
    }
    return sections;
  }

  private recentResults(commands: readonly Command[]): CommandResult[] {
    if (!this.recentStore) return [];
    const byId = new Map(descendants(commands).map((c) => [c.id, c]));
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
      if (command && !command.disabled && !isHidden(command)) {
        results.push(toResult(command, `r:${entry.id}`, 0, []));
      }
    }
    return results;
  }

  private scheduleProviders(): void {
    if (this.pathIds().length || this.promptCommand()) return;
    const query = this._query();
    for (const provider of this.providers()) this.scheduleProvider(provider, query);
  }

  private scheduleProvider(provider: CommandProvider, rawQuery: string): void {
    this.cancel(provider.id);
    const { prefix, text: query } = this.parseQuery(rawQuery);
    if (prefix && (prefix.kind || (prefix.groups && !prefix.groups.includes(provider.group)))) {
      this.setProviderState(provider.id, null);
      return;
    }
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

function inPrefix(command: Command, prefix: CommandPrefix, defaultGroup: string): boolean {
  if (prefix.groups && !prefix.groups.includes(command.group ?? defaultGroup)) return false;
  if (prefix.kind === 'route') return command.route !== undefined;
  if (prefix.kind === 'action') return typeof command.run === 'function';
  return true;
}

function isPinned(command: Command): boolean {
  const { pinned } = command;
  return typeof pinned === 'function' ? pinned() : !!pinned;
}

function isParent(command: Command): command is ParentCommand {
  return Array.isArray(command.children);
}

/** The commands and, recursively, the children of those that are not hidden (for the recents). */
function descendants(commands: readonly Command[]): Command[] {
  const all: Command[] = [];
  for (const command of commands) {
    if (isHidden(command)) continue;
    all.push(command);
    if (isParent(command)) all.push(...descendants(command.children));
  }
  return all;
}

/** Reads `hidden` (a boolean, a function or a signal) so that signals are tracked by the caller. */
function isHidden(command: Command): boolean {
  const { hidden } = command;
  return typeof hidden === 'function' ? hidden() : !!hidden;
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
