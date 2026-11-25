// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette demo

import { Component, computed, inject, signal } from '@angular/core';
import { type Command, injectCommands } from '@rrstudioapps/ngx-command-palette';

import { IconRegistry } from '../shared/icons';
import { DemoNote } from '../shared/note';

interface Project {
  readonly id: number;
  readonly name: string;
  readonly archived: boolean;
}

const NAMES = [
  'Website redesign',
  'Mobile app',
  'Billing migration',
  'Design system',
  'Data warehouse',
];

@Component({
  selector: 'demo-projects',
  imports: [DemoNote],
  template: `
    <header class="page-head">
      <h1>Projects</h1>
      <p class="lead">
        This page registers its own commands with <code>injectCommands(signal)</code>: “New project”
        and one “Archive …” per project. They update with the list and disappear when you leave the
        page.
      </p>
    </header>
    <ul class="list" aria-label="Projects">
      @for (project of projects(); track project.id) {
        <li [class.archived]="project.archived">
          <span>{{ project.name }}</span>
          <span class="tag">{{ project.archived ? 'Archived' : 'Active' }}</span>
        </li>
      }
    </ul>
    <demo-note
      text="The list is a signal, so the commands are a computed signal too: archive a project and its command goes away. A disabled command stays visible but cannot be run."
      [code]="snippet"
    />
  `,
})
export default class Projects {
  private readonly icons = inject(IconRegistry);
  protected readonly snippet = `injectCommands(
  computed(() => projects().map((p) => ({
    id: 'archive-' + p.id,
    label: 'Archive ' + p.name,
    run: () => archive(p.id),
  }))),
);`;
  private nextId = NAMES.length + 1;
  protected readonly projects = signal<Project[]>(
    NAMES.map((name, i) => ({ id: i + 1, name, archived: false })),
  );

  constructor() {
    injectCommands(
      computed<Command[]>(() => {
        const icon = this.icons.map();
        return [
          {
            id: 'project-new',
            label: 'New project',
            group: 'Projects',
            icon: icon.get('plus'),
            keywords: ['create', 'add'],
            run: ({ query }) => this.add(query),
          },
          ...this.projects()
            .filter((p) => !p.archived)
            .map<Command>((p) => ({
              id: `project-archive-${p.id}`,
              label: `Archive ${p.name}`,
              group: 'Projects',
              icon: icon.get('archive'),
              run: () => this.archive(p.id),
            })),
          {
            id: 'project-restore',
            label: 'Restore archived projects',
            group: 'Projects',
            icon: icon.get('folder'),
            keywords: ['unarchive', 'undo'],
            hidden: () => !this.projects().some((p) => p.archived),
            run: () => this.projects.update((l) => l.map((p) => ({ ...p, archived: false }))),
          },
          {
            id: 'project-delete-all',
            label: 'Delete all projects',
            description: 'Disabled commands are shown but cannot be selected',
            group: 'Projects',
            icon: icon.get('trash'),
            disabled: true,
            run: () => undefined,
          },
        ];
      }),
    );
  }

  private add(query: string): void {
    // The typed text becomes the name, unless it is the command name itself
    const name = query && !/new|proj/i.test(query) ? query : `Untitled project ${this.nextId}`;
    this.projects.update((list) => [{ id: this.nextId++, name, archived: false }, ...list]);
  }

  private archive(id: number): void {
    this.projects.update((list) => list.map((p) => (p.id === id ? { ...p, archived: true } : p)));
  }
}
