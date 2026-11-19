// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette demo

/** Dati finti della demo: niente rete, tutto generato in modo deterministico. */

export interface Customer {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly company: string;
  readonly plan: 'Free' | 'Pro' | 'Business';
}

const FIRST = [
  'Ada',
  'Alan',
  'Grace',
  'Linus',
  'Margaret',
  'Dennis',
  'Barbara',
  'Ken',
  'Radia',
  'Tim',
  'Hedy',
  'John',
  'Frances',
  'Edsger',
  'Katherine',
  'Donald',
  'Sophie',
  'Guido',
  'Anita',
  'Bjarne',
];
const LAST = [
  'Lovelace',
  'Turing',
  'Hopper',
  'Torvalds',
  'Hamilton',
  'Ritchie',
  'Liskov',
  'Thompson',
  'Perlman',
  'Berners-Lee',
  'Lamarr',
  'McCarthy',
  'Allen',
  'Dijkstra',
  'Johnson',
  'Knuth',
  'Wilson',
  'van Rossum',
  'Borg',
  'Stroustrup',
];
const COMPANIES = [
  'Northwind',
  'Globex',
  'Initech',
  'Umbrella',
  'Hooli',
  'Stark Labs',
  'Wayne Tech',
  'Acme',
  'Vandelay',
  'Soylent',
];
const PLANS = ['Free', 'Pro', 'Business'] as const;

export const CUSTOMERS: readonly Customer[] = Array.from({ length: 200 }, (_, i) => {
  const first = FIRST[i % FIRST.length];
  const last = LAST[(i * 7) % LAST.length];
  const company = COMPANIES[(i * 3) % COMPANIES.length];
  return {
    id: i + 1,
    name: `${first} ${last}`,
    email:
      `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '') +
      `${i + 1}@${company.toLowerCase().replace(/\s/g, '')}.test`,
    company,
    plan: PLANS[(i * 5) % 3],
  };
});

/** Finta API: risponde dopo `delay` ms e rispetta l'AbortSignal come farebbe fetch. */
export function searchCustomers(
  query: string,
  signal: AbortSignal,
  delay = 450,
): Promise<Customer[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const q = query.toLowerCase();
      resolve(
        CUSTOMERS.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.email.includes(q) ||
            c.company.toLowerCase().includes(q),
        ).slice(0, 6),
      );
    }, delay);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

export const LINKS = {
  github: 'https://github.com/rrstudioapps/ngx-command-palette',
  npm: 'https://www.npmjs.com/package/@rrstudioapps/ngx-command-palette',
  demos: 'https://demo.rr-dev.eu/',
  providentia: 'https://demo.rr-dev.eu/providentia/overview',
};
