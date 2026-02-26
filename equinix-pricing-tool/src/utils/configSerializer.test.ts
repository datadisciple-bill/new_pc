import { describe, it, expect } from 'vitest';
import { serializeProject, parseProjectFile, SCHEMA_VERSION } from './configSerializer';
import type { ProjectConfig } from '@/types/config';

function makeTestProject(): ProjectConfig {
  return {
    id: 'test-id-123',
    name: 'Test Project',
    metros: [
      {
        metroCode: 'DC',
        metroName: 'Ashburn',
        region: 'AMER',
        services: [
          {
            id: 'svc-1',
            type: 'FABRIC_PORT',
            config: {
              speed: '10G',
              portProduct: 'STANDARD',
              type: 'PRIMARY',
              encapsulation: 'DOT1Q',
              quantity: 1,
            },
            pricing: {
              mrc: 500,
              nrc: 100,
              currency: 'USD',
              isEstimate: false,
              breakdown: [{ description: 'Port', mrc: 500, nrc: 100 }],
            },
          },
          {
            id: 'svc-2',
            type: 'NETWORK_EDGE',
            config: {
              deviceTypeCode: 'CSR1000V',
              deviceTypeName: 'Cisco CSR 1000V',
              vendorName: 'Cisco',
              packageCode: 'STD',
              softwareVersion: '16.09',
              licenseType: 'BYOL',
              redundant: false,
              termLength: 12,
              showPriceTable: true,
              priceTable: [{ cores: 2, mrc: 300, nrc: 0 }],
            },
            pricing: { mrc: 300, nrc: 0, currency: 'USD', isEstimate: false, breakdown: [] },
          },
        ],
      },
    ],
    connections: [
      {
        id: 'conn-1',
        name: 'Test VC',
        type: 'EVPL_VC',
        aSide: { metroCode: 'DC', type: 'PORT', serviceId: 'svc-1' },
        zSide: { metroCode: 'DC', type: 'NETWORK_EDGE', serviceId: 'svc-2' },
        bandwidthMbps: 100,
        redundant: false,
        pricing: { mrc: 50, nrc: 0, currency: 'USD', isEstimate: false, breakdown: [] },
        showPriceTable: true,
        priceTable: [{ bandwidthMbps: 50, label: '50 Mbps', mrc: 25, currency: 'USD' }],
      },
    ],
    textBoxes: [{ id: 'tb-1', text: 'Note', x: 0, y: 0, width: 100, height: 40 }],
    localSites: [],
    annotationMarkers: [],
  };
}

describe('serializeProject', () => {
  it('round-trips config fields', () => {
    const project = makeTestProject();
    const json = serializeProject(project);
    const result = parseProjectFile(json);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.project.id).toBe(project.id);
    expect(result.project.name).toBe(project.name);
    expect(result.project.metros).toHaveLength(1);
    expect(result.project.metros[0].metroCode).toBe('DC');
    expect(result.project.metros[0].services).toHaveLength(2);
    expect(result.project.connections).toHaveLength(1);
    expect(result.project.textBoxes).toHaveLength(1);
  });

  it('strips pricing from services', () => {
    const project = makeTestProject();
    const json = serializeProject(project);
    const parsed = JSON.parse(json);

    for (const metro of parsed.project.metros) {
      for (const svc of metro.services) {
        expect(svc.pricing).toBeNull();
      }
    }
  });

  it('strips priceTable and showPriceTable from NetworkEdge configs', () => {
    const project = makeTestProject();
    const json = serializeProject(project);
    const parsed = JSON.parse(json);

    const neService = parsed.project.metros[0].services[1];
    expect(neService.config).not.toHaveProperty('priceTable');
    expect(neService.config).not.toHaveProperty('showPriceTable');
  });

  it('strips pricing from connections', () => {
    const project = makeTestProject();
    const json = serializeProject(project);
    const parsed = JSON.parse(json);

    for (const conn of parsed.project.connections) {
      expect(conn.pricing).toBeNull();
      expect(conn.priceTable).toBeNull();
      expect(conn.showPriceTable).toBe(false);
    }
  });

  it('produces human-readable JSON with indentation', () => {
    const project = makeTestProject();
    const json = serializeProject(project);
    expect(json).toContain('\n  ');
  });
});

describe('parseProjectFile', () => {
  it('returns error for invalid JSON', () => {
    const result = parseProjectFile('not json {{{');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Invalid JSON');
    }
  });

  it('returns error for missing schemaVersion', () => {
    const result = parseProjectFile(JSON.stringify({ project: { id: 'x', metros: [], connections: [] } }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('schemaVersion');
    }
  });

  it('returns error for future schemaVersion', () => {
    const result = parseProjectFile(JSON.stringify({
      schemaVersion: SCHEMA_VERSION + 1,
      project: { id: 'x', metros: [], connections: [] },
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Unsupported schema version');
    }
  });

  it('returns error for missing required fields', () => {
    const result = parseProjectFile(JSON.stringify({
      schemaVersion: 1,
      project: { name: 'No id' },
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('id');
    }
  });

  it('returns error for missing metros array', () => {
    const result = parseProjectFile(JSON.stringify({
      schemaVersion: 1,
      project: { id: 'x', connections: [] },
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('metros');
    }
  });

  it('returns error for missing connections array', () => {
    const result = parseProjectFile(JSON.stringify({
      schemaVersion: 1,
      project: { id: 'x', metros: [] },
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('connections');
    }
  });

  it('defaults optional arrays when missing', () => {
    const result = parseProjectFile(JSON.stringify({
      schemaVersion: 1,
      project: { id: 'x', name: 'Test', metros: [], connections: [] },
    }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.textBoxes).toEqual([]);
    expect(result.project.localSites).toEqual([]);
    expect(result.project.annotationMarkers).toEqual([]);
  });

  it('returns error for non-object file', () => {
    const result = parseProjectFile('"just a string"');
    expect(result.ok).toBe(false);
  });
});
