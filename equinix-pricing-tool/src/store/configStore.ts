import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  ProjectConfig,
  MetroSelection,
  ServiceSelection,
  ServiceType,
  VirtualConnection,
  FabricPortConfig,
  NetworkEdgeConfig,
  InternetAccessConfig,
  CloudRouterConfig,
  PricingResult,
} from '@/types/config';
import type { Metro, DeviceType, ServiceProfile } from '@/types/equinix';
import {
  DEFAULT_FABRIC_PORT,
  DEFAULT_NETWORK_EDGE,
  DEFAULT_INTERNET_ACCESS,
  DEFAULT_CLOUD_ROUTER,
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
}

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

  // Connection actions
  addConnection: (connection: Omit<VirtualConnection, 'id' | 'pricing'>) => string;
  removeConnection: (connectionId: string) => void;
  updateConnection: (connectionId: string, updates: Partial<VirtualConnection>) => void;
  updateConnectionPricing: (connectionId: string, pricing: PricingResult) => void;

  // UI state
  ui: UIState;
  setActiveTab: (tab: UIState['activeTab']) => void;
  setSelectedMetro: (metroCode: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

function getDefaultConfig(type: ServiceType): FabricPortConfig | NetworkEdgeConfig | InternetAccessConfig | CloudRouterConfig {
  switch (type) {
    case 'FABRIC_PORT':
      return { ...DEFAULT_FABRIC_PORT };
    case 'NETWORK_EDGE':
      return { ...DEFAULT_NETWORK_EDGE };
    case 'INTERNET_ACCESS':
      return { ...DEFAULT_INTERNET_ACCESS };
    case 'CLOUD_ROUTER':
      return { ...DEFAULT_CLOUD_ROUTER };
  }
}

export const useConfigStore = create<ConfigStore>((set) => ({
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
      cache: { ...state.cache, deviceTypes: types, deviceTypesLoaded: true },
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
  },
  setProjectName: (name) =>
    set((state) => ({
      project: { ...state.project, name },
    })),

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
      return {
        project: {
          ...state.project,
          metros: [...state.project.metros, newMetro],
        },
      };
    }),
  removeMetro: (metroCode) =>
    set((state) => ({
      project: {
        ...state.project,
        metros: state.project.metros.filter((m) => m.metroCode !== metroCode),
        connections: state.project.connections.filter(
          (c) => c.aSide.metroCode !== metroCode && c.zSide.metroCode !== metroCode
        ),
      },
    })),

  // Service actions
  addService: (metroCode, type) => {
    const serviceId = uuidv4();
    const newService: ServiceSelection = {
      id: serviceId,
      type,
      config: getDefaultConfig(type),
      pricing: null,
    };
    set((state) => ({
      project: {
        ...state.project,
        metros: state.project.metros.map((m) =>
          m.metroCode === metroCode
            ? { ...m, services: [...m.services, newService] }
            : m
        ),
      },
    }));
    return serviceId;
  },
  removeService: (metroCode, serviceId) =>
    set((state) => ({
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
    })),
  updateServiceConfig: (metroCode, serviceId, config) =>
    set((state) => ({
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
    })),
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

  // Connection actions
  addConnection: (connection) => {
    const connectionId = uuidv4();
    const newConnection: VirtualConnection = {
      ...connection,
      id: connectionId,
      pricing: null,
    };
    set((state) => ({
      project: {
        ...state.project,
        connections: [...state.project.connections, newConnection],
      },
    }));
    return connectionId;
  },
  removeConnection: (connectionId) =>
    set((state) => ({
      project: {
        ...state.project,
        connections: state.project.connections.filter((c) => c.id !== connectionId),
      },
    })),
  updateConnection: (connectionId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        connections: state.project.connections.map((c) =>
          c.id === connectionId ? { ...c, ...updates } : c
        ),
      },
    })),
  updateConnectionPricing: (connectionId, pricing) =>
    set((state) => ({
      project: {
        ...state.project,
        connections: state.project.connections.map((c) =>
          c.id === connectionId ? { ...c, pricing } : c
        ),
      },
    })),

  // UI
  ui: {
    activeTab: 'metros',
    selectedMetroCode: null,
    isLoading: false,
    error: null,
  },
  setActiveTab: (tab) =>
    set((state) => ({ ui: { ...state.ui, activeTab: tab } })),
  setSelectedMetro: (metroCode) =>
    set((state) => ({ ui: { ...state.ui, selectedMetroCode: metroCode } })),
  setLoading: (loading) =>
    set((state) => ({ ui: { ...state.ui, isLoading: loading } })),
  setError: (error) =>
    set((state) => ({ ui: { ...state.ui, error } })),
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
