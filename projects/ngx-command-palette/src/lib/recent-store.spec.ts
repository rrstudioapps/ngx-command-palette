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

  it('stores nothing when max is 0 or negative', () => {
    const storage = memoryStorage();
    const store = new RecentStore('k', 0, storage);
    expect(store.add({ id: 'a', label: 'A', route: '/' }, [])).toEqual([]);
    expect(storage.data.has('k')).toBe(false);
    storage.data.set('k', '[{"id":"a","label":"A"}]');
    expect(store.load()).toEqual([]);
    expect(new RecentStore('k', -1, storage).load()).toEqual([]);
  });

  it('truncates a saved list that is longer than max', () => {
    const storage = memoryStorage();
    storage.data.set('k', '[{"id":"a","label":"A"},{"id":"b","label":"B"},{"id":"c","label":"C"}]');
    expect(new RecentStore('k', 2, storage).load().map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('ignores a saved value that is not a list', () => {
    const storage = memoryStorage();
    storage.data.set('k', '{"id":"a","label":"A"}');
    expect(new RecentStore('k', 5, storage).load()).toEqual([]);
    storage.data.set('k', '"text"');
    expect(new RecentStore('k', 5, storage).load()).toEqual([]);
    storage.data.set('k', 'null');
    expect(new RecentStore('k', 5, storage).load()).toEqual([]);
  });

  it('does not save routes that cannot be serialized', () => {
    const storage = memoryStorage();
    const circular: unknown[] = ['/c'];
    circular.push(circular);
    const store = new RecentStore('k', 5, storage);
    expect(store.add({ id: 'c', label: 'C', route: circular }, [])).toEqual([
      { id: 'c', label: 'C' },
    ]);
  });

  it('saves optional fields only when they are set', () => {
    const storage = memoryStorage();
    const store = new RecentStore('k', 5, storage);
    store.add({ id: 'a', label: 'A', description: 'Desc', group: '', route: '/a' }, []);
    expect(store.load()).toEqual([{ id: 'a', label: 'A', description: 'Desc', route: '/a' }]);
  });

  it('keeps the entries it is given instead of reading the storage again', () => {
    const storage = memoryStorage();
    storage.data.set('k', '[{"id":"old","label":"Old"}]');
    const store = new RecentStore('k', 5, storage);
    const next = store.add({ id: 'new', label: 'New', route: '/n' }, []);
    expect(next.map((e) => e.id)).toEqual(['new']);
  });

  describe('frequent ranking', () => {
    const DAY = 24 * 3600 * 1000;
    const cmd = (id: string) => ({ id, label: id.toUpperCase(), route: `/${id}` });

    it('ranks by how often a command ran, not only by when', () => {
      const store = new RecentStore('k', 5, memoryStorage(), 'frequent');
      let list = store.add(cmd('a'), [], 1000);
      list = store.add(cmd('a'), list, 2000);
      list = store.add(cmd('b'), list, 3000);
      expect(list.map((e) => e.id)).toEqual(['a', 'b']);
      expect(list[0].count).toBe(2);
    });

    it('lets old executions fade (half-life 7 days)', () => {
      const store = new RecentStore('k', 5, memoryStorage(), 'frequent');
      let list = store.add(cmd('a'), [], 0);
      list = store.add(cmd('a'), list, 1);
      list = store.add(cmd('b'), list, 21 * DAY);
      expect(list.map((e) => e.id)).toEqual(['b', 'a']);
    });

    it('drops the lowest ranked entry when full, not the oldest', () => {
      const store = new RecentStore('k', 2, memoryStorage(), 'frequent');
      let list = store.add(cmd('a'), [], 1000);
      list = store.add(cmd('a'), list, 1001);
      list = store.add(cmd('a'), list, 1002);
      list = store.add(cmd('b'), list, 1003);
      list = store.add(cmd('c'), list, 1004);
      expect(list.map((e) => e.id)).toEqual(['a', 'c']);
    });

    it('does not store counters in the default mode', () => {
      const store = new RecentStore('k', 5, memoryStorage());
      expect(store.add(cmd('a'), [])[0]).toEqual({ id: 'a', label: 'A', route: '/a' });
    });
  });
});
