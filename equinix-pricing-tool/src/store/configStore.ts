import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  ProjectConfig,
  MetroSelection,
  ServiceSelection,
  ServiceType,
  VirtualConnection,
  TextBox,
  FabricPortConfig,
  NetworkEdgeConfig,
  InternetAccessConfig,
  CloudRouterConfig,
  ColocationConfig,
  PricingResult,
} from '@/types/config';
import type { Metro, DeviceType, ServiceProfile } from '@/types/equinix';
import {
  DEFAULT_FABRIC_PORT,
  DEFAULT_NETWORK_EDGE,
  DEFAULT_INTERNET_ACCESS,
  DEFAULT_CLOUD_ROUTER,
  DEFAULT_COLOCATION,
} from '@/constants/serviceDefaults';

interface AuthState {
  token: string | null;
  tokenExpiry: number | null;
  isAuthenticated: boolean;
  userName: string | null;
}

interface CacheState {
  metros: Metro[];
  deviceTypes: DeviceType[];
  serviceProfiles: ServiceProfile[];
  metrosLoaded: boolean;
  deviceTypesLoaded: boolean;
  serviceProfilesLoaded: boolean;
}

interface UIState {
  activeTab: 'metros' | 'services' | 'diagram' | 'pricing';
  selectedMetroCode: string | null;
  isLoading: boolean;
  error: string | null;
  showPricing: boolean;
}

const MAX_HISTORY = 10;

interface ConfigStore {
  // Auth
  auth: AuthState;
  setAuth: (token: string, expiry: number, userName: string) => void;
  clearAuth: () => void;

  // Cache
  cache: CacheState;
  setMetros: (metros: Metro[]) => void;
  setDeviceTypes: (types: DeviceType[]) => void;
  setServiceProfiles: (profiles: ServiceProfile[]) => void;

  // Project config
  project: ProjectConfig;
  setProjectName: (name: string) => void;

  // Undo history
  projectHistory: ProjectConfig[];
  undo: () => void;
  canUndo: boolean;

  // Metro actions
  addMetro: (metro: Metro) => void;
  removeMetro: (metroCode: string) => void;

  // Service actions
  addService: (metroCode: string, type: ServiceType) => string;
  removeService: (metroCode: string, serviceId: string) => void;
  updateServiceConfig: (
    metroCode: string,
    serviceId: string,
    config: Partial<FabricPortConfig | NetworkEdgeConfig | InternetAccessConfig | CloudRouterConfig>
  ) => void;
  updateServicePricing: (metroCode: string, serviceId: string, pricing: PricingResult) => void;

  // Copy services between metros
  copyMetroServices: (fromMetroCode: string, toMetroCode: string) => Map<string, string>;

  // Connection actions
  addConnection: (connection: Omit<VirtualConnection, 'id' | 'pricing' | 'priceTable' | 'showPriceTable'> & { showPriceTable?: boolean }) => string;
  removeConnection: (connectionId: string) => void;
  updateConnection: (connectionId: string, updates: Partial<VirtualConnection>) => void;
  updateConnectionPricing: (connectionId: string, pricing: PricingResult) => void;

  // Text box actions
  addTextBox: (x: number, y: number) => string;
  removeTextBox: (id: string) => void;
  updateTextBox: (id: string, updates: Partial<TextBox>) => void;

  // UI state
  ui: UIState;
  setActiveTab: (tab: UIState['activeTab']) => void;
  setSelectedMetro: (metroCode: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setShowPricing: (show: boolean) => void;
}

/**
 * Normalize an availableMetros array to plain string metro codes.
 * The Equinix NE API may return objects like {code:'DC'} or {metroCode:'DC'}
 * instead of plain strings. Handle all known shapes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeMetroCodes(raw: any[] | undefined | null): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m) => {
      if (typeof m === 'string') return m;
      if (m && typeof m === 'object') return m.code ?? m.metroCode ?? '';
      return '';
    })
    .filter(Boolean);
}

function getDefaultConfig(type: ServiceType): FabricPortConfig | NetworkEdgeConfig | InternetAccessConfig | CloudRouterConfig | ColocationConfig {
  switch (type) {
    case 'FABRIC_PORT':
      return { ...DEFAULT_FABRIC_PORT };
    case 'NETWORK_EDGE':
      return { ...DEFAULT_NETWORK_EDGE };
    case 'INTERNET_ACCESS':
      return { ...DEFAULT_INTERNET_ACCESS };
    case 'CLOUD_ROUTER':
      return { ...DEFAULT_CLOUD_ROUTER };
    case 'COLOCATION':
      return { ...DEFAULT_COLOCATION };
  }
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
  // Auth
  auth: {
    token: null,
    tokenExpiry: null,
    isAuthenticated: false,
    userName: null,
  },
  setAuth: (token, expiry, userName) =>
    set({
      auth: { token, tokenExpiry: expiry, isAuthenticated: true, userName },
    }),
  clearAuth: () =>
    set({
      auth: { token: null, tokenExpiry: null, isAuthenticated: false, userName: null },
    }),

  // Cache
  cache: {
    metros: [],
    deviceTypes: [],
    serviceProfiles: [],
    metrosLoaded: false,
    deviceTypesLoaded: false,
    serviceProfilesLoaded: false,
  },
  setMetros: (metros) =>
    set((state) => ({
      cache: { ...state.cache, metros, metrosLoaded: true },
    })),
  setDeviceTypes: (types) =>
    set((state) => ({
      cache: {
        ...state.cache,
        // Normalize availableMetros — API may return objects instead of strings
        deviceTypes: types.map((dt) => ({
          ...dt,
          availableMetros: normalizeMetroCodes(dt.availableMetros),
        })),
        deviceTypesLoaded: true,
      },
    })),
  setServiceProfiles: (profiles) =>
    set((state) => ({
      cache: { ...state.cache, serviceProfiles: profiles, serviceProfilesLoaded: true },
    })),

  // Project
  project: {
    id: uuidv4(),
    name: 'New Project',
    metros: [],
    connections: [],
    textBoxes: [],
  },
  projectHistory: [],
  canUndo: false,
  setProjectName: (name) =>
    set((state) => ({
      project: { ...state.project, name },
    })),

  undo: () =>
    set((state) => {
      if (state.projectHistory.length === 0) return state;
      const prev = state.projectHistory[state.projectHistory.length - 1];
      const newHistory = state.projectHistory.slice(0, -1);
      return {
        project: prev,
        projectHistory: newHistory,
        canUndo: newHistory.length > 0,
      };
    }),

  // Metro actions
  addMetro: (metro) =>
    set((state) => {
      if (state.project.metros.some((m) => m.metroCode === metro.code)) {
        return state;
      }
      const newMetro: MetroSelection = {
        metroCode: metro.code,
        metroName: metro.name,
        region: metro.region,
        services: [],
      };
      const newHistory = [...state.projectHistory, state.project].slice(-MAX_HISTORY);
      const isFirstMetro = state.project.metros.length === 0;
      return {
        project: { ...state.project, metros: [...state.project.metros, newMetro] },
        projectHistory: newHistory,
        canUndo: true,
        // Auto-select the first metro so the services panel is immediately usable
        ui: isFirstMetro
          ? { ...state.ui, selectedMetroCode: metro.code }
          : state.ui,
      };
    }),
  removeMetro: (metroCode) =>
    set((state) => {
      const newHistory = [...state.projectHistory, state.project].slice(-MAX_HISTORY);
      const remainingMetros = state.project.metros.filter((m) => m.metroCode !== metroCode);
      // If removing the currently selected metro, auto-select the next available one
      const needsReselect = state.ui.selectedMetroCode === metroCode;
      return {
        project: {
          ...state.project,
          metros: remainingMetros,
          connections: state.project.connections.filter(
            (c) => c.aSide.metroCode !== metroCode && c.zSide.metroCode !== metroCode
          ),
        },
        projectHistory: newHistory,
        canUndo: true,
        ui: needsReselect
          ? { ...state.ui, selectedMetroCode: remainingMetros[0]?.metroCode ?? null }
          : state.ui,
      };
    }),

  // Service actions
  addService: (metroCode, type) => {
    const serviceId = uuidv4();
    const newService: ServiceSelection = {
      id: serviceId,
      type,
      config: getDefaultConfig(type),
      pricing: null,
    };
    set((state) => {
      const newHistory = [...state.projectHistory, state.project].slice(-MAX_HISTORY);
      return {
        project: {
          ...state.project,
          metros: state.project.metros.map((m) =>
            m.metroCode === metroCode
              ? { ...m, services: [...m.services, newService] }
              : m
          ),
        },
        projectHistory: newHistory,
        canUndo: true,
      };
    });
    return serviceId;
  },
  removeService: (metroCode, serviceId) =>
    set((state) => {
      const newHistory = [...state.projectHistory, state.project].slice(-MAX_HISTORY);
      return {
        project: {
          ...state.project,
          metros: state.project.metros.map((m) =>
            m.metroCode === metroCode
              ? { ...m, services: m.services.filter((s) => s.id !== serviceId) }
              : m
          ),
          connections: state.project.connections.filter(
            (c) => c.aSide.serviceId !== serviceId && c.zSide.serviceId !== serviceId
          ),
        },
        projectHistory: newHistory,
        canUndo: true,
      };
    }),
  updateServiceConfig: (metroCode, serviceId, config) =>
    set((state) => {
      const newHistory = [...state.projectHistory, state.project].slice(-MAX_HISTORY);
      return {
        project: {
          ...state.project,
          metros: state.project.metros.map((m) =>
            m.metroCode === metroCode
              ? {
                  ...m,
                  services: m.services.map((s) =>
                    s.id === serviceId ? { ...s, config: { ...s.config, ...config } } : s
                  ),
                }
              : m
          ),
        },
        projectHistory: newHistory,
        canUndo: true,
      };
    }),
  updateServicePricing: (metroCode, serviceId, pricing) =>
    set((state) => ({
      project: {
        ...state.project,
        metros: state.project.metros.map((m) =>
          m.metroCode === metroCode
            ? {
                ...m,
                services: m.services.map((s) =>
                  s.id === serviceId ? { ...s, pricing } : s
                ),
              }
            : m
        ),
      },
    })),

  // Copy services between metros
  copyMetroServices: (fromMetroCode, toMetroCode) => {
    const state = get();
    const sourceMetro = state.project.metros.find((m) => m.metroCode === fromMetroCode);
    if (!sourceMetro) return new Map<string, string>();

    const oldToNew = new Map<string, string>();
    const copiedServices: ServiceSelection[] = sourceMetro.services.map((s) => {
      const newId = uuidv4();
      oldToNew.set(s.id, newId);
      return {
        ...s,
        id: newId,
        config: { ...s.config },
        pricing: null,
      };
    });

    set((st) => {
      const newHistory = [...st.projectHistory, st.project].slice(-MAX_HISTORY);
      return {
        project: {
          ...st.project,
          metros: st.project.metros.map((m) =>
            m.metroCode === toMetroCode
              ? { ...m, services: [...m.services, ...copiedServices] }
              : m
          ),
        },
        projectHistory: newHistory,
        canUndo: true,
      };
    });

    return oldToNew;
  },

  // Connection actions
  addConnection: (connection) => {
    const connectionId = uuidv4();
    const newConnection: VirtualConnection = {
      ...connection,
      id: connectionId,
      pricing: null,
      showPriceTable: connection.showPriceTable ?? false,
      priceTable: null,
    };
    set((state) => {
      const newHistory = [...state.projectHistory, state.project].slice(-MAX_HISTORY);
      return {
        project: {
          ...state.project,
          connections: [...state.project.connections, newConnection],
        },
        projectHistory: newHistory,
        canUndo: true,
      };
    });
    return connectionId;
  },
  removeConnection: (connectionId) =>
    set((state) => {
      const newHistory = [...state.projectHistory, state.project].slice(-MAX_HISTORY);
      return {
        project: {
          ...state.project,
          connections: state.project.connections.filter((c) => c.id !== connectionId),
        },
        projectHistory: newHistory,
        canUndo: true,
      };
    }),
  updateConnection: (connectionId, updates) =>
    set((state) => {
      const newHistory = [...state.projectHistory, state.project].slice(-MAX_HISTORY);
      return {
        project: {
          ...state.project,
          connections: state.project.connections.map((c) =>
            c.id === connectionId ? { ...c, ...updates } : c
          ),
        },
        projectHistory: newHistory,
        canUndo: true,
      };
    }),
  updateConnectionPricing: (connectionId, pricing) =>
    set((state) => ({
      project: {
        ...state.project,
        connections: state.project.connections.map((c) =>
          c.id === connectionId ? { ...c, pricing } : c
        ),
      },
    })),

  // Text box actions
  addTextBox: (x, y) => {
    const id = uuidv4();
    set((state) => {
      const newHistory = [...state.projectHistory, state.project].slice(-MAX_HISTORY);
      return {
        project: {
          ...state.project,
          textBoxes: [...state.project.textBoxes, { id, text: 'Text', x, y, width: 160, height: 40 }],
        },
        projectHistory: newHistory,
        canUndo: true,
      };
    });
    return id;
  },
  removeTextBox: (id) =>
    set((state) => {
      const newHistory = [...state.projectHistory, state.project].slice(-MAX_HISTORY);
      return {
        project: {
          ...state.project,
          textBoxes: state.project.textBoxes.filter((t) => t.id !== id),
        },
        projectHistory: newHistory,
        canUndo: true,
      };
    }),
  updateTextBox: (id, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        textBoxes: state.project.textBoxes.map((t) =>
          t.id === id ? { ...t, ...updates } : t
        ),
      },
    })),

  // UI
  ui: {
    activeTab: 'metros',
    selectedMetroCode: null,
    isLoading: false,
    error: null,
    showPricing: true,
  },
  setActiveTab: (tab) =>
    set((state) => ({ ui: { ...state.ui, activeTab: tab } })),
  setSelectedMetro: (metroCode) =>
    set((state) => ({ ui: { ...state.ui, selectedMetroCode: metroCode } })),
  setLoading: (loading) =>
    set((state) => ({ ui: { ...state.ui, isLoading: loading } })),
  setError: (error) =>
    set((state) => ({ ui: { ...state.ui, error } })),
  setShowPricing: (show) =>
    set((state) => ({ ui: { ...state.ui, showPricing: show } })),
}));

// Selector helpers
export const selectMetro = (metroCode: string) => (state: ConfigStore) =>
  state.project.metros.find((m) => m.metroCode === metroCode);

export const selectService = (metroCode: string, serviceId: string) => (state: ConfigStore) =>
  state.project.metros
    .find((m) => m.metroCode === metroCode)
    ?.services.find((s) => s.id === serviceId);

export const selectConnectionsForMetro = (metroCode: string) => (state: ConfigStore) =>
  state.project.connections.filter(
    (c) => c.aSide.metroCode === metroCode || c.zSide.metroCode === metroCode
  );
