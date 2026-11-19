// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette demo

import { Component, computed, input, numberAttribute } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CUSTOMERS } from '../shared/data';

@Component({
  selector: 'demo-customers',
  imports: [RouterLink],
  template: `
    <header class="page-head">
      <h1>Customers</h1>
      <p class="lead">
        200 fake customers. Search them from the palette (2+ characters): results come from a
        <code>CommandProvider</code> with debounce, loading state and request cancellation.
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
          @for (c of first; track c.id) {
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
  `,
})
export default class Customers {
  protected readonly first = CUSTOMERS.slice(0, 12);
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
