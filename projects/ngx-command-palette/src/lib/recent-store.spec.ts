// SPDX-License-Identifier: MIT
// © 2026 rrstudio — ngx-command-palette

import { RecentStore } from './recent-store';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe('RecentStore', () => {
  it('keeps the most recent first, without duplicates, up to max', () => {
    const storage = memoryStorage();
    const store = new RecentStore('k', 2, storage);
    store.add({ id: 'a', label: 'A', run: () => undefined });
    store.add({ id: 'b', label: 'B', route: '/b' });
    store.add({ id: 'a', label: 'A', run: () => undefined });
    store.add({ id: 'c', label: 'C', route: ['/c', 1], group: 'G' });
    expect(store.load()).toEqual([
      { id: 'c', label: 'C', group: 'G', route: ['/c', 1] },
      { id: 'a', label: 'A' },
    ]);
  });

  it('never saves functions', () => {
    const storage = memoryStorage();
    new RecentStore('k', 5, storage).add({ id: 'x', label: 'X', run: () => undefined });
    expect(storage.data.get('k')).toBe('[{"id":"x","label":"X"}]');
  });

  it('survives corrupted or unavailable storage', () => {
    const storage = memoryStorage();
    storage.data.set('k', '{not json');
    expect(new RecentStore('k', 5, storage).load()).toEqual([]);
    storage.data.set('k', '[{"id":1},{"id":"ok","label":"Ok"}]');
    expect(new RecentStore('k', 5, storage).load()).toEqual([{ id: 'ok', label: 'Ok' }]);

    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const store = new RecentStore('k', 5, throwing);
    expect(store.load()).toEqual([]);
    expect(store.add({ id: 'a', label: 'A', route: '/' }, [])).toHaveLength(1);
    expect(() => store.clear()).not.toThrow();
    expect(new RecentStore('k', 5, null).load()).toEqual([]);
  });

  it('clears', () => {
    const storage = memoryStorage();
    const store = new RecentStore('k', 5, storage);
    store.add({ id: 'a', label: 'A', route: '/' });
    store.clear();
    expect(store.load()).toEqual([]);
  });
});
