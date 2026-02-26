import { describe, it, expect, beforeEach } from 'vitest';
import { useConfigStore } from './configStore';
import type { Metro } from '@/types/equinix';

const testMetro: Metro = {
  code: 'DC',
  name: 'Washington, D.C.',
  region: 'AMER',
  connectedMetros: [{ code: 'NY', avgLatency: 5.2 }],
};

describe('configStore', () => {
  beforeEach(() => {
    // Reset store between tests
    useConfigStore.setState({
      auth: { token: null, tokenExpiry: null, isAuthenticated: false, userName: null },
      project: { id: 'test', name: 'Test', metros: [], connections: [], textBoxes: [], localSites: [], annotationMarkers: [] },
      projectHistory: [],
      canUndo: false,
    });
  });

  describe('auth', () => {
    it('sets auth state', () => {
      useConfigStore.getState().setAuth('token123', Date.now() + 3600000, 'test@equinix.com');
      const auth = useConfigStore.getState().auth;
      expect(auth.isAuthenticated).toBe(true);
      expect(auth.token).toBe('token123');
      expect(auth.userName).toBe('test@equinix.com');
    });

    it('clears auth state', () => {
      useConfigStore.getState().setAuth('token123', Date.now() + 3600000, 'test@equinix.com');
      useConfigStore.getState().clearAuth();
      const auth = useConfigStore.getState().auth;
      expect(auth.isAuthenticated).toBe(false);
      expect(auth.token).toBeNull();
    });
  });

  describe('metros', () => {
    it('adds a metro', () => {
      useConfigStore.getState().addMetro(testMetro);
      const metros = useConfigStore.getState().project.metros;
      expect(metros).toHaveLength(1);
      expect(metros[0].metroCode).toBe('DC');
      expect(metros[0].metroName).toBe('Washington, D.C.');
    });

    it('prevents duplicate metros', () => {
      useConfigStore.getState().addMetro(testMetro);
      useConfigStore.getState().addMetro(testMetro);
      expect(useConfigStore.getState().project.metros).toHaveLength(1);
    });

    it('removes a metro and its connections', () => {
      useConfigStore.getState().addMetro(testMetro);
      useConfigStore.getState().addMetro({ ...testMetro, code: 'NY', name: 'New York' });

      // Add a connection involving DC
      useConfigStore.getState().addConnection({
        name: 'Test',
        type: 'EVPL_VC',
        aSide: { metroCode: 'DC', type: 'PORT', serviceId: 'test' },
        zSide: { metroCode: 'NY', type: 'PORT', serviceId: 'test2' },
        bandwidthMbps: 1000,
        redundant: false,
      });

      useConfigStore.getState().removeMetro('DC');
      expect(useConfigStore.getState().project.metros).toHaveLength(1);
      expect(useConfigStore.getState().project.connections).toHaveLength(0);
    });
  });

  describe('services', () => {
    it('adds a service to a metro', () => {
      useConfigStore.getState().addMetro(testMetro);
      const serviceId = useConfigStore.getState().addService('DC', 'FABRIC_PORT');
      const metro = useConfigStore.getState().project.metros[0];
      expect(metro.services).toHaveLength(1);
      expect(metro.services[0].id).toBe(serviceId);
      expect(metro.services[0].type).toBe('FABRIC_PORT');
    });

    it('removes a service and related connections', () => {
      useConfigStore.getState().addMetro(testMetro);
      const serviceId = useConfigStore.getState().addService('DC', 'FABRIC_PORT');

      useConfigStore.getState().addConnection({
        name: 'Test',
        type: 'EVPL_VC',
        aSide: { metroCode: 'DC', type: 'PORT', serviceId },
        zSide: { metroCode: 'DC', type: 'SERVICE_PROFILE', serviceId: 'aws', serviceProfileName: 'AWS' },
        bandwidthMbps: 1000,
        redundant: false,
      });

      useConfigStore.getState().removeService('DC', serviceId);
      expect(useConfigStore.getState().project.metros[0].services).toHaveLength(0);
      expect(useConfigStore.getState().project.connections).toHaveLength(0);
    });

    it('updates service config', () => {
      useConfigStore.getState().addMetro(testMetro);
      const serviceId = useConfigStore.getState().addService('DC', 'FABRIC_PORT');

      useConfigStore.getState().updateServiceConfig('DC', serviceId, { speed: '100G' });
      const service = useConfigStore.getState().project.metros[0].services[0];
      expect((service.config as { speed: string }).speed).toBe('100G');
    });

    it('updates service pricing', () => {
      useConfigStore.getState().addMetro(testMetro);
      const serviceId = useConfigStore.getState().addService('DC', 'FABRIC_PORT');

      useConfigStore.getState().updateServicePricing('DC', serviceId, {
        mrc: 1500, nrc: 0, currency: 'USD', isEstimate: false, breakdown: [],
      });
      const service = useConfigStore.getState().project.metros[0].services[0];
      expect(service.pricing?.mrc).toBe(1500);
    });
  });

  describe('connections', () => {
    it('adds and removes connections', () => {
      const connId = useConfigStore.getState().addConnection({
        name: 'Test',
        type: 'EVPL_VC',
        aSide: { metroCode: 'DC', type: 'PORT', serviceId: 'test' },
        zSide: { metroCode: 'NY', type: 'PORT', serviceId: 'test2' },
        bandwidthMbps: 1000,
        redundant: false,
      });

      expect(useConfigStore.getState().project.connections).toHaveLength(1);

      useConfigStore.getState().removeConnection(connId);
      expect(useConfigStore.getState().project.connections).toHaveLength(0);
    });
  });

  describe('undo', () => {
    it('can undo addMetro', () => {
      useConfigStore.getState().addMetro(testMetro);
      expect(useConfigStore.getState().project.metros).toHaveLength(1);
      expect(useConfigStore.getState().canUndo).toBe(true);

      useConfigStore.getState().undo();
      expect(useConfigStore.getState().project.metros).toHaveLength(0);
      expect(useConfigStore.getState().canUndo).toBe(false);
    });

    it('can undo multiple steps up to 10', () => {
      for (let i = 0; i < 12; i++) {
        useConfigStore.getState().addMetro({ ...testMetro, code: `M${i}` });
        useConfigStore.getState().removeMetro(`M${i}`);
      }
      // Only 10 history entries should be kept
      expect(useConfigStore.getState().projectHistory.length).toBeLessThanOrEqual(10);
    });

    it('does nothing when no history', () => {
      useConfigStore.getState().undo();
      expect(useConfigStore.getState().project.metros).toHaveLength(0);
    });
  });

  describe('copyMetroServices', () => {
    it('copies all services from one metro to another', () => {
      useConfigStore.getState().addMetro(testMetro);
      useConfigStore.getState().addMetro({ ...testMetro, code: 'AT', name: 'Atlanta' });

      useConfigStore.getState().addService('DC', 'FABRIC_PORT');
      useConfigStore.getState().addService('DC', 'NETWORK_EDGE');

      const oldToNew = useConfigStore.getState().copyMetroServices('DC', 'AT');

      const atMetro = useConfigStore.getState().project.metros.find((m) => m.metroCode === 'AT');
      expect(atMetro?.services).toHaveLength(2);
      expect(oldToNew.size).toBe(2);

      // New IDs should be different from old IDs
      const dcMetro = useConfigStore.getState().project.metros.find((m) => m.metroCode === 'DC');
      for (const [oldId, newId] of oldToNew) {
        expect(oldId).not.toBe(newId);
        expect(dcMetro?.services.some((s) => s.id === oldId)).toBe(true);
        expect(atMetro?.services.some((s) => s.id === newId)).toBe(true);
      }
    });

    it('copies service configs but resets pricing to null', () => {
      useConfigStore.getState().addMetro(testMetro);
      useConfigStore.getState().addMetro({ ...testMetro, code: 'AT', name: 'Atlanta' });

      const serviceId = useConfigStore.getState().addService('DC', 'FABRIC_PORT');
      useConfigStore.getState().updateServiceConfig('DC', serviceId, { speed: '100G' });
      useConfigStore.getState().updateServicePricing('DC', serviceId, {
        mrc: 7500, nrc: 0, currency: 'USD', isEstimate: false, breakdown: [],
      });

      useConfigStore.getState().copyMetroServices('DC', 'AT');

      const atMetro = useConfigStore.getState().project.metros.find((m) => m.metroCode === 'AT');
      const copiedService = atMetro?.services[0];
      expect((copiedService?.config as { speed: string }).speed).toBe('100G');
      expect(copiedService?.pricing).toBeNull(); // pricing should be re-fetched
    });

    it('returns empty map when source metro not found', () => {
      useConfigStore.getState().addMetro(testMetro);
      const result = useConfigStore.getState().copyMetroServices('ZZ', 'DC');
      expect(result.size).toBe(0);
    });
  });
});
