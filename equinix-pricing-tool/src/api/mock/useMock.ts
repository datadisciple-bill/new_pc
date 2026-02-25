import { hasDefaultPricing } from '@/data/defaultPricing';

/**
 * Controls whether mock/default data functions are used for API calls.
 *
 * When defaults.json has been loaded (via the fetch-api-data script), the
 * mock pricing functions serve prices from that file — so "mock" mode with
 * default pricing loaded effectively serves real API-sourced data without
 * requiring end-user authentication.
 *
 * Returns false only when VITE_USE_MOCK is explicitly set to 'false',
 * meaning the app should call the live Equinix API directly (requires auth).
 */
export function useMockData(): boolean {
  return import.meta.env.VITE_USE_MOCK !== 'false';
}

/** True when defaults.json pricing data has been loaded into memory. */
export function hasApiData(): boolean {
  return hasDefaultPricing();
}
