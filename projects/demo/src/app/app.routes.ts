// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette demo

import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/overview'),
    title: 'ngx-command-palette · Angular ⌘K command palette',
  },
  {
    path: 'projects',
    loadComponent: () => import('./pages/projects'),
    title: 'Projects · ngx-command-palette demo',
  },
  {
    path: 'customers',
    loadComponent: () => import('./pages/customers'),
    title: 'Customers · ngx-command-palette demo',
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
  },
  { path: '**', redirectTo: '' },
];
