// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

import type { Route } from '@angular/router';

import type { RouteCommand } from './command.model';
import type { CommandPaletteRouteInfo, CommandPaletteRoutesOptions } from './config';

/**
 * Builds navigation commands from a router configuration. Pure: no router, no injection context.
 *
 * Skipped: redirects, wildcards, secondary outlets, paths with a parameter (`:id`) or a custom
 * `matcher` and everything below them, and routes with `data.commandPalette: false`. A route without a path that only wraps
 * children (a layout) gives no command of its own, but its children are visited. Routes behind
 * `loadChildren` that are not loaded yet are not visible: only the route that owns them is listed.
 */
export function routeCommands(
  routes: readonly Route[],
  options: CommandPaletteRoutesOptions,
  defaultGroup: string,
): RouteCommand[] {
  const found = new Map<string, RouteCommand>();
  visit(routes, '', options, defaultGroup, found);
  return [...found.values()];
}

function visit(
  routes: readonly Route[],
  parentUrl: string,
  options: CommandPaletteRoutesOptions,
  defaultGroup: string,
  found: Map<string, RouteCommand>,
): void {
  for (const route of routes) {
    // A custom matcher has no fixed URL, like a parameter: skip it and everything below it
    if (route.redirectTo !== undefined || route.outlet || route.matcher) continue;
    const path = route.path ?? '';
    if (path === '**' || path.split('/').some((segment) => segment.startsWith(':'))) continue;

    const data = route.data?.['commandPalette'] as false | CommandPaletteRouteInfo | undefined;
    if (data === false) continue;

    const url = joinUrl(parentUrl, path);
    const children = route.children ?? [];
    const title = typeof route.title === 'string' ? route.title : undefined;
    const isLayout = children.length > 0 && !route.component && !route.loadComponent;
    const isWrapper = path === '' && children.length > 0 && !title && !data?.label;

    if (!isLayout && !isWrapper && options.filter?.(route, url) !== false) {
      const base: CommandPaletteRouteInfo = {
        label: title ?? labelFromPath(url),
        ...data,
      };
      const described = options.describe ? options.describe(route, url) : {};
      const id = `route:${url}`;
      if (described && !found.has(id) && base.label) {
        const info = { ...base, ...described };
        found.set(id, {
          id,
          route: url,
          label: info.label ?? base.label,
          group: info.group ?? options.group ?? defaultGroup,
          ...(info.description !== undefined ? { description: info.description } : {}),
          ...(info.icon !== undefined ? { icon: info.icon } : {}),
          ...(info.keywords !== undefined ? { keywords: info.keywords } : {}),
        });
      }
    }
    if (children.length) visit(children, url, options, defaultGroup, found);
  }
}

function joinUrl(parent: string, path: string): string {
  const joined = [parent, path]
    .filter(Boolean)
    .join('/')
    .replace(/\/{2,}/g, '/');
  return joined.startsWith('/') ? joined : `/${joined}`;
}

/** `/user-settings/profile` → `Profile`; the root URL (the home route) → `Home`. */
function labelFromPath(path: string): string {
  const last = path.split('/').filter(Boolean).pop();
  if (!last) return 'Home';
  const words = last.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
