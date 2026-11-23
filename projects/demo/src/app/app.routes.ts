// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette demo

import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/overview'),
    title: 'ngx-command-palette · Angular ⌘K command palette',
    data: { commandPalette: { label: 'Overview', keywords: ['home', 'start'] } },
  },
  {
    path: 'projects',
    loadComponent: () => import('./pages/projects'),
    title: 'Projects · ngx-command-palette demo',
    data: { commandPalette: { label: 'Projects', keywords: ['work', 'tasks'] } },
  },
  {
    path: 'customers',
    loadComponent: () => import('./pages/customers'),
    title: 'Customers · ngx-command-palette demo',
    data: { commandPalette: { label: 'Customers', keywords: ['clients', 'accounts'] } },
  },
  {
    path: 'customers/:id',
    loadComponent: () => import('./pages/customers').then((m) => m.CustomerDetail),
    title: 'Customer · ngx-command-palette demo',
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings'),
    title: 'Settings · ngx-command-palette demo',
    data: { commandPalette: { label: 'Settings', keywords: ['preferences', 'options'] } },
  },
  {
    path: 'routes',
    loadComponent: () => import('./pages/routes'),
    title: 'Routes · ngx-command-palette demo',
    data: {
      commandPalette: {
        label: 'How routes become commands',
        description: 'Generated from the router configuration',
        keywords: ['pages', 'router', 'navigation'],
      },
    },
  },
  { path: '**', redirectTo: '' },
];
