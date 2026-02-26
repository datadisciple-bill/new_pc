import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { isCacheValid, formatCacheAge, loadCachedOptions, saveCachedOptions } from './cache';
import type { CachedOptions } from './cache';

function makeCachedOptions(overrides?: Partial<CachedOptions>): CachedOptions {
  return {
    cachedAt: Date.now(),
    metros: [],
    deviceTypes: [],
    serviceProfiles: [],
    routerPackages: [],
    eiaLocations: [],
    ...overrides,
  };
}

// Minimal in-memory IndexedDB fake for jsdom
function createFakeIndexedDB() {
  const stores = new Map<string, Map<string, unknown>>();

  const fakeDB: Partial<IDBDatabase> = {
    objectStoreNames: {
      contains: (name: string) => stores.has(name),
      length: stores.size,
    } as DOMStringList,
    createObjectStore: (name: string) => {
      stores.set(name, new Map());
      return {} as IDBObjectStore;
    },
    transaction: (storeName: string | string[]) => {
      const name = Array.isArray(storeName) ? storeName[0] : storeName;
      const store = stores.get(name) ?? new Map();
      if (!stores.has(name)) stores.set(name, store);

      const objectStore: Partial<IDBObjectStore> = {
        get: (key: IDBValidKey) => {
          const result = store.get(String(key)) ?? undefined;
          const request = { result } as IDBRequest;
          setTimeout(() => request.onsuccess?.({} as Event), 0);
          return request;
        },
        put: (value: unknown, key?: IDBValidKey) => {
          store.set(String(key), value);
          const request = {} as IDBRequest;
          setTimeout(() => request.onsuccess?.({} as Event), 0);
          return request;
        },
      };

      return {
        objectStore: () => objectStore as IDBObjectStore,
      } as unknown as IDBTransaction;
    },
  };

  const fakeIndexedDB = {
    open: (_name: string, _version?: number) => {
      const request = { result: fakeDB } as IDBOpenDBRequest;
      setTimeout(() => {
        request.onupgradeneeded?.({} as IDBVersionChangeEvent);
        request.onsuccess?.({} as Event);
      }, 0);
      return request;
    },
  };

  return fakeIndexedDB as unknown as IDBFactory;
}

describe('cache', () => {
  describe('isCacheValid', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('returns true for fresh cache', () => {
      const cache = makeCachedOptions({ cachedAt: Date.now() });
      expect(isCacheValid(cache)).toBe(true);
    });

    it('returns true for cache under 24 hours old', () => {
      const cache = makeCachedOptions({ cachedAt: Date.now() - 23 * 60 * 60 * 1000 });
      expect(isCacheValid(cache)).toBe(true);
    });

    it('returns false for expired cache (>24h)', () => {
      const cache = makeCachedOptions({ cachedAt: Date.now() - 25 * 60 * 60 * 1000 });
      expect(isCacheValid(cache)).toBe(false);
    });
  });

  describe('formatCacheAge', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('returns "less than 1 hour ago" for recent cache', () => {
      const cache = makeCachedOptions({ cachedAt: Date.now() - 30 * 60 * 1000 });
      expect(formatCacheAge(cache)).toBe('less than 1 hour ago');
    });

    it('returns "1 hour ago" for 1-hour-old cache', () => {
      const cache = makeCachedOptions({ cachedAt: Date.now() - 90 * 60 * 1000 });
      expect(formatCacheAge(cache)).toBe('1 hour ago');
    });

    it('returns "3 hours ago" for 3-hour-old cache', () => {
      const cache = makeCachedOptions({ cachedAt: Date.now() - 3 * 60 * 60 * 1000 });
      expect(formatCacheAge(cache)).toBe('3 hours ago');
    });

    it('returns "1 day ago" for 1-day-old cache', () => {
      const cache = makeCachedOptions({ cachedAt: Date.now() - 30 * 60 * 60 * 1000 });
      expect(formatCacheAge(cache)).toBe('1 day ago');
    });

    it('returns "2 days ago" for 2-day-old cache', () => {
      const cache = makeCachedOptions({ cachedAt: Date.now() - 50 * 60 * 60 * 1000 });
      expect(formatCacheAge(cache)).toBe('2 days ago');
    });
  });

  describe('IndexedDB round-trip', () => {
    beforeEach(() => {
      // Install fake IndexedDB on globalThis
      (globalThis as Record<string, unknown>).indexedDB = createFakeIndexedDB();
    });

    afterEach(() => {
      delete (globalThis as Record<string, unknown>).indexedDB;
    });

    it('returns null when cache is empty', async () => {
      const result = await loadCachedOptions();
      expect(result).toBeNull();
    });

    it('round-trips save and load', async () => {
      const options = makeCachedOptions({ cachedAt: 1000 });
      await saveCachedOptions(options);
      const loaded = await loadCachedOptions();
      expect(loaded).toEqual(options);
    });
  });
});
