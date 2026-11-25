// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette demo

import { Component, computed, inject, input, numberAttribute, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { type Command, injectCommands } from '@rrstudioapps/ngx-command-palette';

import { CUSTOMERS, type Customer } from '../shared/data';
import { IconRegistry } from '../shared/icons';
import { DemoNote } from '../shared/note';

@Component({
  selector: 'demo-customers',
  imports: [RouterLink, DemoNote],
  template: `
    <header class="page-head">
      <h1>Customers</h1>
      <p class="lead">
        200 fake customers. Search them from the palette (2+ characters): results come from a
        <code>CommandProvider</code> with debounce, loading state and request cancellation. Showing:
        <strong>{{ plan() }}</strong> plan.
      </p>
    </header>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Company</th>
            <th scope="col">Plan</th>
          </tr>
        </thead>
        <tbody>
          @for (c of shown(); track c.id) {
            <tr>
              <td>
                <a [routerLink]="['/customers', c.id]">{{ c.name }}</a>
              </td>
              <td>{{ c.company }}</td>
              <td>{{ c.plan }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <demo-note
      text="Two sources at once: the table is filtered by commands registered here (try “plan”), while the search results come from a provider registered by the app shell."
      [code]="snippet"
    />
  `,
})
export default class Customers {
  private readonly icons = inject(IconRegistry);
  protected readonly plan = signal<Customer['plan'] | 'All'>('All');
  protected readonly shown = computed(() =>
    CUSTOMERS.filter((c) => this.plan() === 'All' || c.plan === this.plan()).slice(0, 12),
  );
  protected readonly snippet = `{
  id: 'plan', label: 'Filter by plan…',
  children: ['All', 'Free', 'Pro', 'Business'].map((plan) => ({
    id: 'plan-' + plan, label: plan, run: () => filter.set(plan),
  })),
}`;

  constructor() {
    injectCommands(
      computed<Command[]>(() => [
        {
          id: 'customers-plan',
          label: 'Filter by plan…',
          description: `Now: ${this.plan()}`,
          group: 'Customers',
          icon: this.icons.map().get('users'),
          keywords: ['free', 'pro', 'business', 'subscription'],
          children: (['All', 'Free', 'Pro', 'Business'] as const).map((plan) => ({
            id: `customers-plan-${plan}`,
            label: plan === 'All' ? 'All plans' : `${plan} plan`,
            run: () => this.plan.set(plan),
          })),
        },
        {
          id: 'customers-copy-emails',
          label: 'Copy emails of the listed customers',
          group: 'Customers',
          icon: this.icons.map().get('copy'),
          keywords: ['export', 'mailing'],
          run: () =>
            navigator.clipboard?.writeText(
              this.shown()
                .map((c) => c.email)
                .join(', '),
            ),
        },
      ]),
    );
  }
}

@Component({
  selector: 'demo-customer',
  imports: [RouterLink],
  template: `
    @if (customer(); as c) {
      <header class="page-head">
        <p class="eyebrow"><a routerLink="/customers">Customers</a></p>
        <h1>{{ c.name }}</h1>
        <p class="lead">{{ c.company }} · {{ c.plan }} plan</p>
      </header>
      <dl class="card details">
        <dt>Email</dt>
        <dd>{{ c.email }}</dd>
        <dt>Customer id</dt>
        <dd>#{{ c.id }}</dd>
      </dl>
      <p class="muted">
        Reopen the palette: this customer is now under “Recent”, even though it came from the async
        search.
      </p>
    } @else {
      <h1>Customer not found</h1>
    }
  `,
})
export class CustomerDetail {
  readonly id = input(0, { transform: numberAttribute });
  protected readonly customer = computed(() => CUSTOMERS.find((c) => c.id === this.id()));
}
