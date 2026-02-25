import type { Metro, DeviceType, ServiceProfile, RouterPackage, EIALocation } from '@/types/equinix';

const DB_NAME = 'equinix-pricing-cache';
const DB_VERSION = 1;
const STORE_NAME = 'apiCache';
const CACHE_KEY = 'options';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CachedOptions {
  cachedAt: number;
  metros: Metro[];
  deviceTypes: DeviceType[];
  serviceProfiles: ServiceProfile[];
  routerPackages: RouterPackage[];
  eiaLocations: EIALocation[];
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadCachedOptions(): Promise<CachedOptions | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(CACHE_KEY);
      request.onsuccess = () => {
        const data = request.result as CachedOptions | undefined;
        resolve(data ?? null);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveCachedOptions(options: CachedOptions): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(options, CACHE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Silently fail — app still works with mock data
  }
}

export function isCacheValid(cache: CachedOptions): boolean {
  return Date.now() - cache.cachedAt < CACHE_TTL_MS;
}

export function formatCacheAge(cache: CachedOptions): string {
  const ageMs = Date.now() - cache.cachedAt;
  const hours = Math.floor(ageMs / (60 * 60 * 1000));
  if (hours < 1) return 'less than 1 hour ago';
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
