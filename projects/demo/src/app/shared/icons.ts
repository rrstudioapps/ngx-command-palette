// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette demo

import {
  Component,
  Directive,
  Injectable,
  TemplateRef,
  computed,
  inject,
  input,
  viewChildren,
} from '@angular/core';

/** Marks an SVG icon in the DemoIcons template: `<ng-template demoIcon="home">`. */
@Directive({ selector: 'ng-template[demoIcon]' })
export class DemoIconDef {
  readonly name = input.required<string>({ alias: 'demoIcon' });
  readonly template = inject(TemplateRef);
}

/** Command icons as TemplateRefs: shows `icon: TemplateRef` in the palette. */
@Injectable({ providedIn: 'root' })
export class IconRegistry {
  private source?: () => readonly DemoIconDef[];
  readonly map = computed(
    () => new Map((this.source?.() ?? []).map((d) => [d.name(), d.template])),
  );

  connect(source: () => readonly DemoIconDef[]): void {
    this.source = source;
  }
}

/** Holds the icons; place it once in the root component. */
@Component({
  selector: 'demo-icons',
  imports: [DemoIconDef],
  template: `
    <ng-template demoIcon="home"
      ><svg viewBox="0 0 24 24">
        <path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg
    ></ng-template>
    <ng-template demoIcon="folder"
      ><svg viewBox="0 0 24 24">
        <path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /></svg
    ></ng-template>
    <ng-template demoIcon="users"
      ><svg viewBox="0 0 24 24">
        <circle cx="9" cy="8" r="3.5" />
        <path
          d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"
        /></svg
    ></ng-template>
    <ng-template demoIcon="user"
      ><svg viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" /></svg
    ></ng-template>
    <ng-template demoIcon="settings"
      ><svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" />
        <path
          d="M12 2v3m0 14v3M4.9 4.9l2.1 2.1m10 10 2.1 2.1M2 12h3m14 0h3M4.9 19.1 7 17M17 7l2.1-2.1"
        /></svg
    ></ng-template>
    <ng-template demoIcon="route"
      ><svg viewBox="0 0 24 24">
        <circle cx="6" cy="19" r="2" />
        <circle cx="18" cy="5" r="2" />
        <path d="M8 19h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" /></svg
    ></ng-template>
    <ng-template demoIcon="theme"
      ><svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg
    ></ng-template>
    <ng-template demoIcon="plus"
      ><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg
    ></ng-template>
    <ng-template demoIcon="archive"
      ><svg viewBox="0 0 24 24"><path d="M3 4h18v4H3zM5 8v12h14V8M10 12h4" /></svg
    ></ng-template>
    <ng-template demoIcon="copy"
      ><svg viewBox="0 0 24 24">
        <rect x="9" y="9" width="12" height="12" rx="2" />
        <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></svg
    ></ng-template>
    <ng-template demoIcon="link"
      ><svg viewBox="0 0 24 24">
        <path
          d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"
        /></svg
    ></ng-template>
    <ng-template demoIcon="density"
      ><svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg
    ></ng-template>
    <ng-template demoIcon="trash"
      ><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg
    ></ng-template>
  `,
  styles: `
    :host {
      display: none;
    }
  `,
})
export class DemoIcons {
  readonly defs = viewChildren(DemoIconDef);

  constructor() {
    inject(IconRegistry).connect(this.defs);
  }
}
