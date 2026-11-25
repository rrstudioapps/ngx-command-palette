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
    path: 'recipes',
    loadComponent: () => import('./pages/recipes'),
    title: 'Recipes · ngx-command-palette demo',
    data: {
      commandPalette: {
        label: 'Recipes',
        description: 'Confirmations, prompts, hotkeys, async search',
        keywords: ['examples', 'patterns', 'how to'],
      },
    },
  },
  {
    path: 'playground',
    loadComponent: () => import('./pages/playground'),
    title: 'Playground · ngx-command-palette demo',
    data: {
      commandPalette: {
        label: 'Playground',
        description: 'Change the look live and copy the CSS',
        keywords: ['style', 'theme', 'css', 'variables', 'colors'],
      },
    },
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
