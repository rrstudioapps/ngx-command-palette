// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  TemplateRef,
  ViewEncapsulation,
  afterRenderEffect,
  computed,
  contentChild,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

import type { CommandResult } from './command.model';
import { CommandPaletteService } from './command-palette.service';
import { COMMAND_PALETTE_CONFIG, type CommandPaletteTheme } from './config';
import { keyToAction, moveIndex } from './list-navigation';
import { formatShortcut, isApplePlatform, matchesShortcut, parseShortcut } from './shortcut';
import { CommandEmptyTemplate, CommandItemTemplate } from './templates.directive';

let nextId = 0;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The command palette dialog. Place it once, usually in the root component template.
 * It listens to the global shortcut and renders nothing while closed.
 */
@Component({
  selector: 'rr-command-palette',
  imports: [NgTemplateOutlet],
  templateUrl: './command-palette.component.html',
  styleUrl: './command-palette.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'rr-cp-host',
    '(document:keydown)': 'onDocumentKeydown($event)',
    '(document:focusin)': 'onDocumentFocusin($event)',
  },
})
export class CommandPaletteComponent {
  protected readonly service = inject(CommandPaletteService);
  protected readonly config = inject(COMMAND_PALETTE_CONFIG);
  private readonly document = inject(DOCUMENT);

  /** Overrides the `theme` of `provideCommandPalette()`, e.g. to follow your app's theme toggle. */
  readonly theme = input<CommandPaletteTheme | undefined>(undefined);

  protected readonly itemTemplate = contentChild(CommandItemTemplate);
  protected readonly emptyTemplate = contentChild(CommandEmptyTemplate);
  private readonly input = viewChild<ElementRef<HTMLInputElement>>('input');
  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');

  protected readonly uid = `rr-cp-${nextId++}`;
  protected readonly labels = this.config.labels;
  private readonly apple = isApplePlatform();
  private readonly shortcuts = (typeof this.config.shortcut === 'string'
    ? [this.config.shortcut]
    : this.config.shortcut
  ).map(parseShortcut);
  /** Label of the first shortcut, e.g. `⌘K` or `Ctrl+K`, for a "search" button in your UI. */
  readonly shortcutLabel = this.shortcuts.length
    ? formatShortcut(this.shortcuts[0], this.apple)
    : '';

  private readonly prefersDark = signal(false);
  protected readonly resolvedTheme = computed(() => {
    const theme = this.theme() ?? this.config.theme;
    return theme === 'auto' ? (this.prefersDark() ? 'dark' : 'light') : theme;
  });

  /** Sections with the flat index of each row (used for ids and keyboard navigation). */
  protected readonly view = computed(() => {
    let index = 0;
    return this.service.sections().map((section, sectionIndex) => ({
      section,
      headingId: `${this.uid}-group-${sectionIndex}`,
      rows: section.items.map((item) => ({ item, index: index++ })),
    }));
  });
  protected readonly items = computed<readonly CommandResult[]>(() =>
    this.service.sections().flatMap((s) => s.items),
  );
  private readonly activeKey = signal<string | null>(null);
  protected readonly activeIndex = computed(() => {
    const items = this.items();
    const key = this.activeKey();
    const found = key === null ? -1 : items.findIndex((i) => i.key === key);
    if (found >= 0 && !items[found].command.disabled) return found;
    return moveIndex(
      items.map((i) => !!i.command.disabled),
      -1,
      'first',
    );
  });
  protected readonly activeDescendant = computed(() => {
    const index = this.activeIndex();
    return index >= 0 ? this.optionId(index) : null;
  });
  protected readonly status = computed(() => {
    if (this.service.loading()) return this.labels.loading;
    const count = this.items().length;
    return count === 0 ? this.labels.empty : this.labels.results.replace('{count}', String(count));
  });

  constructor() {
    const view = this.document.defaultView;
    const media = view?.matchMedia?.('(prefers-color-scheme: dark)');
    if (media) {
      this.prefersDark.set(media.matches);
      const listener = (e: MediaQueryListEvent) => this.prefersDark.set(e.matches);
      media.addEventListener?.('change', listener);
      inject(DestroyRef).onDestroy(() => media.removeEventListener?.('change', listener));
    }

    // Focus the search field as soon as the dialog appears
    afterRenderEffect(() => {
      const input = this.input()?.nativeElement;
      if (input && this.document.activeElement !== input) input.focus({ preventScroll: true });
    });
    // Keep the active row visible during keyboard navigation
    afterRenderEffect(() => {
      const id = this.activeDescendant();
      if (!id) return;
      const option = this.document.getElementById(id);
      option?.scrollIntoView?.({ block: 'nearest' });
    });
  }

  protected optionId(index: number): string {
    return `${this.uid}-option-${index}`;
  }

  protected isTemplate(icon: unknown): icon is TemplateRef<unknown> {
    return icon instanceof TemplateRef;
  }

  protected onInput(event: Event): void {
    this.activeKey.set(null);
    this.service.setQuery((event.target as HTMLInputElement).value);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      this.trapTab(event);
      return;
    }
    const action = keyToAction(event);
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    const items = this.items();
    switch (action) {
      case 'close':
        this.service.close();
        return;
      case 'select': {
        const item = items[this.activeIndex()];
        if (item) void this.service.execute(item.command);
        return;
      }
      default: {
        const next = moveIndex(
          items.map((i) => !!i.command.disabled),
          this.activeIndex(),
          action,
        );
        if (next >= 0) this.activeKey.set(items[next].key);
      }
    }
  }

  protected onPointerMove(item: CommandResult): void {
    if (!item.command.disabled && this.activeKey() !== item.key) this.activeKey.set(item.key);
  }

  protected onSelect(item: CommandResult): void {
    void this.service.execute(item.command);
  }

  protected onOverlayDown(event: MouseEvent): void {
    // Only a click on the backdrop, not inside the dialog
    if (event.target === event.currentTarget) this.service.close();
  }

  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (event.repeat || event.isComposing) return;
    // Shortcuts without Ctrl/⌘/Alt (e.g. "/") do not fire while typing in a field
    const typing = isEditable(event.target);
    const hit = this.shortcuts.some(
      (s) =>
        (!typing || s.mod || s.ctrl || s.meta || s.alt) && matchesShortcut(event, s, this.apple),
    );
    if (hit) {
      event.preventDefault();
      this.activeKey.set(null);
      this.service.toggle();
    }
  }

  protected onDocumentFocusin(event: FocusEvent): void {
    if (!this.service.isOpen()) return;
    const dialog = this.dialog()?.nativeElement;
    // Focus trap: if focus leaves the dialog (e.g. an iframe click or a scripted focus) it returns to the input
    if (dialog && event.target instanceof Node && !dialog.contains(event.target)) {
      this.input()?.nativeElement.focus({ preventScroll: true });
    }
  }

  private trapTab(event: KeyboardEvent): void {
    const dialog = this.dialog()?.nativeElement;
    if (!dialog) return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length <= 1) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = this.document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
}
