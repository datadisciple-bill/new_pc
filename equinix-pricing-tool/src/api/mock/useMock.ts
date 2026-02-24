// Toggle mock data on/off. In dev, default to mock unless env var set.
export function useMockData(): boolean {
  return import.meta.env.VITE_USE_MOCK !== 'false';
}
