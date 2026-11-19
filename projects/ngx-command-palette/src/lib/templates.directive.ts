// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

import { Directive, TemplateRef, inject } from '@angular/core';

import type { Command, CommandResult, HighlightSegment } from './command.model';

export interface CommandItemContext {
  /** The command. */
  readonly $implicit: Command;
  readonly result: CommandResult;
  /** Label split into matched / unmatched parts. */
  readonly segments: readonly HighlightSegment[];
  /** True for the row selected with the keyboard or the mouse. */
  readonly active: boolean;
  readonly query: string;
}

export interface CommandEmptyContext {
  /** The search text. */
  readonly $implicit: string;
}

/**
 * Custom template for each row:
 * `<ng-template rrCommandItem let-command let-segments="segments">…</ng-template>`
 */
@Directive({ selector: 'ng-template[rrCommandItem]' })
export class CommandItemTemplate {
  readonly template = inject<TemplateRef<CommandItemContext>>(TemplateRef);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- firma richiesta da Angular
  static ngTemplateContextGuard(
    _dir: CommandItemTemplate,
    ctx: unknown,
  ): ctx is CommandItemContext {
    return true;
  }
}

/** Custom empty state: `<ng-template rrCommandEmpty let-query>…</ng-template>` */
@Directive({ selector: 'ng-template[rrCommandEmpty]' })
export class CommandEmptyTemplate {
  readonly template = inject<TemplateRef<CommandEmptyContext>>(TemplateRef);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- firma richiesta da Angular
  static ngTemplateContextGuard(
    _dir: CommandEmptyTemplate,
    ctx: unknown,
  ): ctx is CommandEmptyContext {
    return true;
  }
}
