// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

import type { TemplateRef } from '@angular/core';
import type { NavigationExtras } from '@angular/router';

/** Context passed to a command's `run` function. */
export interface CommandRunContext {
  /** The search text typed when the command was executed. */
  readonly query: string;
}

interface CommandBase {
  /** Unique, stable id. Used for recents and as DOM id suffix. */
  readonly id: string;
  /** Text shown in the list and matched by the fuzzy search. */
  readonly label: string;
  /** Section the command belongs to. Defaults to `labels.defaultGroup`. */
  readonly group?: string;
  /** Secondary text shown below the label. Also searchable, with a lower weight. */
  readonly description?: string;
  /** Text/emoji (or an icon font ligature) or a template rendered before the label. */
  readonly icon?: string | TemplateRef<unknown>;
  /** Keys shown on the right, e.g. `['⌘', 'S']`. Display only: it does not bind anything. */
  readonly shortcut?: readonly string[];
  /** Extra words matched by the search but not shown. */
  readonly keywords?: readonly string[];
  /** A disabled command is shown but cannot be executed or selected. */
  readonly disabled?: boolean;
}

/** A command that navigates to an Angular route. */
export interface RouteCommand extends CommandBase {
  readonly route: string | readonly unknown[];
  readonly navigationExtras?: NavigationExtras;
  readonly run?: never;
}

/** A command that runs a function. */
export interface ActionCommand extends CommandBase {
  readonly run: (context: CommandRunContext) => void | Promise<unknown>;
  readonly route?: never;
}

export type Command = RouteCommand | ActionCommand;

/** Minimal subscribable shape, so the library does not depend on RxJS. */
export interface CommandSubscribable<T> {
  subscribe(observer: {
    next?: (value: T) => void;
    error?: (error: unknown) => void;
    complete?: () => void;
  }): { unsubscribe(): void };
}

/** Source of commands loaded on demand (e.g. a customer search on your API). */
export interface CommandProvider {
  /** Unique id of the provider. */
  readonly id: string;
  /** Section title for the results. */
  readonly group: string;
  /** Minimum query length before `search` is called. Default: 1. */
  readonly minQueryLength?: number;
  /** Debounce in ms. Default: the global `debounceMs`. */
  readonly debounceMs?: number;
  /**
   * Returns the commands for `query`. The `signal` is aborted when the query changes
   * or the palette closes: pass it to `fetch` to cancel the request.
   */
  search(
    query: string,
    signal: AbortSignal,
  ): Promise<readonly Command[]> | CommandSubscribable<readonly Command[]>;
}

/** A piece of a label: `match` is true for characters found by the search. */
export interface HighlightSegment {
  readonly text: string;
  readonly match: boolean;
}

/** A command as shown in the list. */
export interface CommandResult {
  readonly command: Command;
  /** Unique key of the row (section + command id). */
  readonly key: string;
  readonly score: number;
  /** Indices of the label characters matched by the search. */
  readonly indices: readonly number[];
  readonly segments: readonly HighlightSegment[];
}

export interface CommandSection {
  readonly id: string;
  readonly label: string;
  readonly items: readonly CommandResult[];
}
