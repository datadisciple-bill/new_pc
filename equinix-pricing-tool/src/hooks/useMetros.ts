import { useState, useEffect, useCallback, useMemo } from 'react';
import { useConfigStore } from '@/store/configStore';
import { fetchMetros } from '@/api/fabric';
import type { Metro } from '@/types/equinix';

export function useMetros() {
  const { metros: cachedMetros, metrosLoaded } = useConfigStore((s) => s.cache);
  const sortedMetros = useMemo(
    () => [...cachedMetros].sort((a, b) => a.code.localeCompare(b.code)),
    [cachedMetros]
  );
  const selectedMetros = useConfigStore((s) => s.project.metros);
  const addMetro = useConfigStore((s) => s.addMetro);
  const removeMetro = useConfigStore((s) => s.removeMetro);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!metrosLoaded) {
      setIsLoading(true);
      fetchMetros()
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load metros'))
        .finally(() => setIsLoading(false));
    }
  }, [metrosLoaded]);

  const toggleMetro = useCallback(
    (metro: Metro) => {
      const isSelected = selectedMetros.some((m) => m.metroCode === metro.code);
      if (isSelected) {
        removeMetro(metro.code);
      } else {
        addMetro(metro);
      }
    },
    [selectedMetros, addMetro, removeMetro]
  );

  const isSelected = useCallback(
    (metroCode: string) => selectedMetros.some((m) => m.metroCode === metroCode),
    [selectedMetros]
  );

  const metroHasServices = useCallback(
    (metroCode: string) => {
      const metro = selectedMetros.find((m) => m.metroCode === metroCode);
      return (metro?.services.length ?? 0) > 0;
    },
    [selectedMetros]
  );

  return {
    allMetros: sortedMetros,
    selectedMetros,
    isLoading,
    error,
    toggleMetro,
    isSelected,
    metroHasServices,
  };
}
