// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette demo

import { Component, computed, inject, signal } from '@angular/core';
import { type Command, injectCommands } from '@rrstudioapps/ngx-command-palette';

import { IconRegistry } from '../shared/icons';

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
  `,
})
export default class Projects {
  private readonly icons = inject(IconRegistry);
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
    // Il testo digitato diventa il nome, se non è il nome del comando stesso
    const name = query && !/new|proj/i.test(query) ? query : `Untitled project ${this.nextId}`;
    this.projects.update((list) => [{ id: this.nextId++, name, archived: false }, ...list]);
  }

  private archive(id: number): void {
    this.projects.update((list) => list.map((p) => (p.id === id ? { ...p, archived: true } : p)));
  }
}
