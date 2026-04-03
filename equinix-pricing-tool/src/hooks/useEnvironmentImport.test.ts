import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConfigStore } from '@/store/configStore';

vi.mock('@/api/fabric', () => ({
  fetchPorts: vi.fn(),
  fetchConnections: vi.fn(),
  fetchRouters: vi.fn(),
  fetchMetros: vi.fn(),
}));

vi.mock('@/api/networkEdge', () => ({
  fetchDevices: vi.fn(),
}));

import { useEnvironmentImport } from './useEnvironmentImport';
import { fetchPorts, fetchConnections, fetchRouters, fetchMetros } from '@/api/fabric';
import { fetchDevices } from '@/api/networkEdge';
import { mockPorts, mockRouters, mockConnections } from '@/api/mock/fabricMock';
import { mockDevices } from '@/api/mock/networkEdgeMock';

describe('useEnvironmentImport', () => {
  beforeEach(() => {
    useConfigStore.getState().loadProject({
      id: 'test', name: 'Test', metros: [], connections: [],
      textBoxes: [], localSites: [], annotationMarkers: [], networks: [],
    });
    vi.clearAllMocks();
  });

  it('starts in idle phase', () => {
    const { result } = renderHook(() => useEnvironmentImport());
    expect(result.current.phase).toBe('idle');
    expect(result.current.inventory).toBeNull();
  });

  it('fetches inventory and transitions to selecting', async () => {
    const ports = mockPorts().filter((p) => p.state === 'ACTIVE');
    const routers = mockRouters();
    const conns = mockConnections().filter((c) => c.state === 'ACTIVE');
    const devices = mockDevices().filter((d) => d.status === 'PROVISIONED');

    (fetchPorts as ReturnType<typeof vi.fn>).mockResolvedValue(ports);
    (fetchConnections as ReturnType<typeof vi.fn>).mockResolvedValue(conns);
    (fetchRouters as ReturnType<typeof vi.fn>).mockResolvedValue(routers);
    (fetchDevices as ReturnType<typeof vi.fn>).mockResolvedValue(devices);
    (fetchMetros as ReturnType<typeof vi.fn>).mockResolvedValue([
      { code: 'DA', name: 'Dallas', region: 'AMER', connectedMetros: [] },
      { code: 'SV', name: 'Silicon Valley', region: 'AMER', connectedMetros: [] },
      { code: 'LD', name: 'London', region: 'EMEA', connectedMetros: [] },
      { code: 'SG', name: 'Singapore', region: 'APAC', connectedMetros: [] },
    ]);

    const { result } = renderHook(() => useEnvironmentImport());

    await act(async () => {
      await result.current.fetchInventory();
    });

    expect(result.current.phase).toBe('selecting');
    expect(result.current.inventory).not.toBeNull();
    expect(result.current.inventory!.metros.length).toBeGreaterThan(0);
    expect(result.current.inventory!.totalPorts).toBeGreaterThan(0);
  });

  it('can toggle metro selection', async () => {
    (fetchPorts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchConnections as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchRouters as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchDevices as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchMetros as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { result } = renderHook(() => useEnvironmentImport());
    await act(async () => { await result.current.fetchInventory(); });

    act(() => { result.current.toggleMetro('DA'); });
    expect(result.current.selectedMetros).toContain('DA');

    act(() => { result.current.toggleMetro('DA'); });
    expect(result.current.selectedMetros).not.toContain('DA');
  });

  it('transitions to error on API failure', async () => {
    (fetchPorts as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    (fetchConnections as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchRouters as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchDevices as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchMetros as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { result } = renderHook(() => useEnvironmentImport());
    await act(async () => { await result.current.fetchInventory(); });

    expect(result.current.phase).toBe('error');
    expect(result.current.errors.length).toBeGreaterThan(0);
  });

  it('imports selected metros into the store', async () => {
    const ports = mockPorts().filter((p) => p.state === 'ACTIVE');
    const routers = mockRouters();
    const conns = mockConnections().filter((c) => c.state === 'ACTIVE');
    const devices = mockDevices().filter((d) => d.status === 'PROVISIONED');

    (fetchPorts as ReturnType<typeof vi.fn>).mockResolvedValue(ports);
    (fetchConnections as ReturnType<typeof vi.fn>).mockResolvedValue(conns);
    (fetchRouters as ReturnType<typeof vi.fn>).mockResolvedValue(routers);
    (fetchDevices as ReturnType<typeof vi.fn>).mockResolvedValue(devices);
    (fetchMetros as ReturnType<typeof vi.fn>).mockResolvedValue([
      { code: 'DA', name: 'Dallas', region: 'AMER', connectedMetros: [] },
      { code: 'SV', name: 'Silicon Valley', region: 'AMER', connectedMetros: [] },
      { code: 'LD', name: 'London', region: 'EMEA', connectedMetros: [] },
      { code: 'SG', name: 'Singapore', region: 'APAC', connectedMetros: [] },
    ]);

    const { result } = renderHook(() => useEnvironmentImport());

    await act(async () => {
      await result.current.fetchInventory();
    });

    // Select only DA and SV
    act(() => { result.current.deselectAll(); });
    act(() => { result.current.toggleMetro('DA'); });
    act(() => { result.current.toggleMetro('SV'); });

    await act(async () => {
      await result.current.importSelected();
    });

    expect(result.current.phase).toBe('complete');
    expect(result.current.importSummary).not.toBeNull();
    expect(result.current.importSummary!.portsImported).toBeGreaterThan(0);

    // Verify store has the metros
    const state = useConfigStore.getState();
    const metroCodes = state.project.metros.map((m) => m.metroCode);
    expect(metroCodes).toContain('DA');
    expect(metroCodes).toContain('SV');

    // Verify services were added with isExisting flag
    const daMetro = state.project.metros.find((m) => m.metroCode === 'DA');
    expect(daMetro).toBeDefined();
    expect(daMetro!.services.length).toBeGreaterThan(0);
    const existingServices = daMetro!.services.filter((s) => s.isExisting);
    expect(existingServices.length).toBeGreaterThan(0);

    // Verify connections were imported
    expect(state.project.connections.length).toBeGreaterThan(0);
  });

  it('selectAll and deselectAll work correctly', async () => {
    const ports = mockPorts().filter((p) => p.state === 'ACTIVE');

    (fetchPorts as ReturnType<typeof vi.fn>).mockResolvedValue(ports);
    (fetchConnections as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchRouters as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchDevices as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchMetros as ReturnType<typeof vi.fn>).mockResolvedValue([
      { code: 'DA', name: 'Dallas', region: 'AMER', connectedMetros: [] },
      { code: 'SV', name: 'Silicon Valley', region: 'AMER', connectedMetros: [] },
    ]);

    const { result } = renderHook(() => useEnvironmentImport());

    await act(async () => {
      await result.current.fetchInventory();
    });

    // Should be pre-selected
    expect(result.current.selectedMetros.length).toBeGreaterThan(0);

    act(() => { result.current.deselectAll(); });
    expect(result.current.selectedMetros).toEqual([]);

    act(() => { result.current.selectAll(); });
    expect(result.current.selectedMetros.length).toBeGreaterThan(0);
  });

  it('reset returns to idle state', async () => {
    (fetchPorts as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchConnections as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchRouters as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchDevices as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (fetchMetros as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { result } = renderHook(() => useEnvironmentImport());

    await act(async () => {
      await result.current.fetchInventory();
    });

    expect(result.current.phase).toBe('selecting');

    act(() => { result.current.reset(); });

    expect(result.current.phase).toBe('idle');
    expect(result.current.inventory).toBeNull();
    expect(result.current.selectedMetros).toEqual([]);
    expect(result.current.errors).toEqual([]);
  });

  it('maps redundant port pairs to a single service', async () => {
    const ports = mockPorts().filter((p) => p.state === 'ACTIVE');
    const routers = mockRouters();
    const conns = mockConnections().filter((c) => c.state === 'ACTIVE');
    const devices = mockDevices().filter((d) => d.status === 'PROVISIONED');

    (fetchPorts as ReturnType<typeof vi.fn>).mockResolvedValue(ports);
    (fetchConnections as ReturnType<typeof vi.fn>).mockResolvedValue(conns);
    (fetchRouters as ReturnType<typeof vi.fn>).mockResolvedValue(routers);
    (fetchDevices as ReturnType<typeof vi.fn>).mockResolvedValue(devices);
    (fetchMetros as ReturnType<typeof vi.fn>).mockResolvedValue([
      { code: 'DA', name: 'Dallas', region: 'AMER', connectedMetros: [] },
      { code: 'SV', name: 'Silicon Valley', region: 'AMER', connectedMetros: [] },
      { code: 'LD', name: 'London', region: 'EMEA', connectedMetros: [] },
      { code: 'SG', name: 'Singapore', region: 'APAC', connectedMetros: [] },
    ]);

    const { result } = renderHook(() => useEnvironmentImport());

    await act(async () => {
      await result.current.fetchInventory();
    });

    await act(async () => {
      await result.current.importSelected();
    });

    // DA has 2 physical ports in a redundant pair — should map to 1 FABRIC_PORT service
    const state = useConfigStore.getState();
    const daMetro = state.project.metros.find((m) => m.metroCode === 'DA');
    const daPortServices = daMetro!.services.filter((s) => s.type === 'FABRIC_PORT');
    // Only 1 port service for the redundant pair
    expect(daPortServices.length).toBe(1);

    // Connections referencing either port UUID should resolve correctly
    // conn-001 (DA port-da1-001 -> SV port-sv5-001) should have resolved endpoints
    const daToSvConn = state.project.connections.find((c) => c.name === 'DA-SV-EVPL-1G');
    expect(daToSvConn).toBeDefined();
    expect(daToSvConn!.aSide.serviceId).not.toBe('');
  });
});
