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

import type { Command, CommandResult } from './command.model';
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
  protected readonly labels = this.service.labels;
  private readonly apple = isApplePlatform();
  private readonly shortcuts = (typeof this.config.shortcut === 'string'
    ? [this.config.shortcut]
    : this.config.shortcut
  ).map(parseShortcut);
  private shortcutEnabled(): boolean {
    const enabled = this.config.shortcutEnabled;
    return typeof enabled === 'function' ? enabled() : enabled;
  }
  /** Label of the first shortcut, e.g. `⌘K` or `Ctrl+K`, for a "search" button in your UI. */
  readonly shortcutLabel = this.shortcuts.length
    ? formatShortcut(this.shortcuts[0], this.apple)
    : '';

  /** Keys shown on a row: `shortcut`, or the formatted `hotkey` when there is no `shortcut`. */
  protected keysOf(command: Command): readonly string[] {
    if (command.shortcut?.length) return command.shortcut;
    const hotkey = typeof command.hotkey === 'string' ? command.hotkey : command.hotkey?.[0];
    return hotkey ? [formatShortcut(parseShortcut(hotkey), this.apple)] : [];
  }

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
    if (this.service.loading()) return this.labels().loading;
    const count = this.items().length;
    if (count === 0) return this.labels().empty;
    const path = this.service.path();
    const prompt = this.service.prompt();
    if (prompt) return this.labels().prompt.replace('{name}', prompt.label);
    const { level, levelOne, results, resultsOne } = this.labels();
    const template = path.length
      ? count === 1
        ? (levelOne ?? level)
        : level
      : count === 1
        ? (resultsOne ?? results)
        : results;
    return template
      .replace('{name}', path[path.length - 1]?.label ?? '')
      .replace('{count}', String(count));
  });
  /** Sub-palettes opened plus, last, the command waiting for a value. Shown as the path above the search. */
  protected readonly crumbs = computed<readonly Command[]>(() => {
    const prompt = this.service.prompt();
    return prompt ? [...this.service.path(), prompt] : this.service.path();
  });
  protected readonly placeholder = computed(
    () => this.service.prompt()?.prompt ?? this.labels().placeholder,
  );

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

  protected hasChildren(command: Command): boolean {
    return Array.isArray(command.children);
  }

  protected onBack(levels: number): void {
    this.activeKey.set(null);
    this.service.back(levels);
    this.input()?.nativeElement.focus({ preventScroll: true });
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
    if (
      event.key === 'Backspace' &&
      !event.isComposing &&
      this.service.query() === '' &&
      this.crumbs().length
    ) {
      // Like deleting the "tag" in front of the search text: leave the sub-palette
      event.preventDefault();
      this.activeKey.set(null);
      this.service.back();
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
    // Command hotkeys need a modifier. Alt alone is ignored in a text field: on macOS it types
    // special characters (Alt+T is "†"), so it must not be swallowed there. Ctrl and ⌘ never type.
    const typing = isEditable(event.target);
    const fieldsAllowed = this.config.shortcutInFields || !typing;
    const hotkeyAllowed =
      fieldsAllowed && (event.ctrlKey || event.metaKey || (event.altKey && !typing));
    if (hotkeyAllowed && this.service.runHotkey(event, this.apple)) {
      event.preventDefault();
      return;
    }
    // Shortcuts without Ctrl/⌘/Alt (e.g. "/") never fire while typing in a field; with
    // `shortcutInFields: false` the ones with Ctrl/⌘ do not either
    const hit = this.shortcuts.some(
      (s) =>
        (!typing || (this.config.shortcutInFields && (s.mod || s.ctrl || s.meta || s.alt))) &&
        matchesShortcut(event, s, this.apple),
    );
    // `shortcutEnabled` only stops it from opening: an open palette can always be closed
    if (hit && (this.service.isOpen() || this.shortcutEnabled())) {
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
