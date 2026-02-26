import type { ProjectConfig } from '@/types/config';

export const SCHEMA_VERSION = 1;

interface ProjectEnvelope {
  schemaVersion: number;
  exportedAt: string;
  project: ProjectConfig;
}

export type ParseResult = {
  ok: true;
  project: ProjectConfig;
} | {
  ok: false;
  error: string;
}

/**
 * Deep-clone a project and strip all pricing-related fields.
 * Returns a human-readable JSON string.
 */
export function serializeProject(project: ProjectConfig): string {
  const clone: ProjectConfig = JSON.parse(JSON.stringify(project));

  // Strip pricing from services
  for (const metro of clone.metros) {
    for (const service of metro.services) {
      service.pricing = null;
      // Strip priceTable/showPriceTable from NetworkEdge configs
      const cfg = service.config as unknown as Record<string, unknown>;
      if ('priceTable' in cfg) {
        delete cfg.priceTable;
      }
      if ('showPriceTable' in cfg) {
        delete cfg.showPriceTable;
      }
    }
  }

  // Strip pricing from connections
  for (const conn of clone.connections) {
    conn.pricing = null;
    conn.priceTable = null;
    conn.showPriceTable = false;
  }

  const envelope: ProjectEnvelope = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    project: clone,
  };

  return JSON.stringify(envelope, null, 2);
}

/**
 * Trigger a browser download of the project config as JSON.
 */
export function downloadProjectFile(project: ProjectConfig): void {
  const json = serializeProject(project);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `Equinix_Project_${project.name.replace(/\s+/g, '_')}_${date}.json`;
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Parse and validate an imported project JSON file.
 */
export function parseProjectFile(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Invalid JSON file.' };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { ok: false, error: 'File does not contain a valid object.' };
  }

  const envelope = parsed as Record<string, unknown>;

  // Check schema version
  if (typeof envelope.schemaVersion !== 'number') {
    return { ok: false, error: 'Missing schemaVersion field.' };
  }
  if (envelope.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: `Unsupported schema version ${envelope.schemaVersion}. This app supports up to version ${SCHEMA_VERSION}.` };
  }

  const project = envelope.project as Record<string, unknown> | undefined;
  if (!project || typeof project !== 'object') {
    return { ok: false, error: 'Missing project data.' };
  }

  // Validate required fields
  if (typeof project.id !== 'string' || !project.id) {
    return { ok: false, error: 'Project is missing an id.' };
  }
  if (!Array.isArray(project.metros)) {
    return { ok: false, error: 'Project is missing metros array.' };
  }
  if (!Array.isArray(project.connections)) {
    return { ok: false, error: 'Project is missing connections array.' };
  }

  // Ensure optional arrays exist
  const validated = project as unknown as ProjectConfig;
  if (!Array.isArray(validated.textBoxes)) {
    validated.textBoxes = [];
  }
  if (!Array.isArray(validated.localSites)) {
    validated.localSites = [];
  }
  if (!Array.isArray(validated.annotationMarkers)) {
    validated.annotationMarkers = [];
  }
  if (typeof validated.name !== 'string') {
    validated.name = 'Imported Project';
  }

  return { ok: true, project: validated };
}
