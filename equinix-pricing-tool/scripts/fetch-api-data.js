#!/usr/bin/env node

/**
 * Equinix API Data Fetcher
 *
 * Queries the Equinix API to build a static defaults.json file containing
 * all metros, device types, service profiles, router packages, EIA locations,
 * and reference pricing for Fabric Ports, Virtual Connections, Cloud Router,
 * and Network Edge devices.
 *
 * Usage:
 *   1. Add credentials to .env in the project root:
 *        EQUINIX_CLIENT_ID=your_client_id
 *        EQUINIX_CLIENT_SECRET=your_client_secret
 *
 *   2. Run:  npm run fetch-data
 *
 * Output: public/data/defaults.json
 *
 * Run this periodically (e.g. daily via cron or CI) to keep the default
 * dataset current. The output file ships as a static asset and the app
 * loads it at startup — no end-user authentication required.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'public', 'data');
const OUTPUT_FILE = join(OUTPUT_DIR, 'defaults.json');
// Also write to ./data/ for Docker volume mount persistence
const DOCKER_DATA_DIR = join(__dirname, '..', 'data');
const DOCKER_DATA_FILE = join(DOCKER_DATA_DIR, 'defaults.json');

const API_BASE = 'https://api.equinix.com';
const MAX_RETRIES = 3;
const RATE_LIMIT_MS = 200; // 5 requests/sec
const CONCURRENCY = 5; // Max parallel requests (stays within ~5 req/sec with rate limit)

// ── ANSI helpers ─────────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
};

const CHECK = `${c.green}\u2714${c.reset}`;
const CROSS = `${c.red}\u2718${c.reset}`;
const ARROW = `${c.cyan}\u25B6${c.reset}`;
const WARN  = `${c.yellow}\u26A0${c.reset}`;

function elapsed(startMs) {
  const s = ((Date.now() - startMs) / 1000).toFixed(1);
  return `${c.dim}(${s}s)${c.reset}`;
}

function progressBar(current, total, width = 30) {
  const pct = Math.min(current / total, 1);
  const filled = Math.round(width * pct);
  const empty = width - filled;
  const bar = `${c.green}${'█'.repeat(filled)}${c.dim}${'░'.repeat(empty)}${c.reset}`;
  const label = `${String(current).padStart(String(total).length)}/${total}`;
  return `  ${bar} ${label}`;
}

// ── Load .env ────────────────────────────────────────────────────────────────

function loadEnvFile() {
  const envPath = join(__dirname, '..', '.env');
  if (!existsSync(envPath)) return;

  const contents = readFileSync(envPath, 'utf-8');
  for (const line of contents.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    // Don't override existing env vars (CLI takes precedence)
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

// ── Helpers ──────────────────────────────────────────────────────────────────

let token = '';
let apiCalls = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Global throttle: schedules requests 200ms apart but allows multiple in-flight
let nextSlot = 0;
async function throttle() {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + RATE_LIMIT_MS;
  const wait = slot - now;
  if (wait > 0) await sleep(wait);
}

// Reusable concurrent batch runner
async function runConcurrent(items, fn) {
  let ok = 0, fail = 0;
  const failures = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map(fn));
    for (const r of results) {
      if (r.status === 'fulfilled') ok++;
      else { fail++; failures.push(r.reason); }
    }
  }
  return { ok, fail, failures };
}

async function apiGet(path) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await throttle();
      apiCalls++;
      const res = await fetch(`${API_BASE}${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.status === 429) {
        const wait = 2000 * Math.pow(2, attempt);
        process.stdout.write(`\r  ${WARN} Rate limited, retrying in ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`${res.status} ${res.statusText}: ${body}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      await sleep(2000 * Math.pow(2, attempt));
    }
  }
}

async function apiPost(path, body) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await throttle();
      apiCalls++;
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (res.status === 429) {
        const wait = 2000 * Math.pow(2, attempt);
        process.stdout.write(`\r  ${WARN} Rate limited, retrying in ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`${res.status} ${res.statusText}: ${text}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      await sleep(2000 * Math.pow(2, attempt));
    }
  }
}

// ── Authentication ───────────────────────────────────────────────────────────

async function authenticate() {
  const clientId = process.env.EQUINIX_CLIENT_ID;
  const clientSecret = process.env.EQUINIX_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(
      `\n${c.red}${c.bold}Error: EQUINIX_CLIENT_ID and EQUINIX_CLIENT_SECRET are required.${c.reset}\n\n` +
        `  Add them to ${c.bold}.env${c.reset} in the project root:\n\n` +
        `    ${c.dim}EQUINIX_CLIENT_ID=your_client_id${c.reset}\n` +
        `    ${c.dim}EQUINIX_CLIENT_SECRET=your_client_secret${c.reset}\n\n` +
        `  Then run:  ${c.bold}npm run fetch-data${c.reset}\n`
    );
    process.exit(1);
  }

  const t = Date.now();
  process.stdout.write(`  ${ARROW} Authenticating...`);
  const res = await fetch(`${API_BASE}/oauth2/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.log(` ${CROSS}`);
    console.error(`\n${c.red}Authentication failed: ${res.status} ${res.statusText}${c.reset}\n${body}`);
    process.exit(1);
  }

  const data = await res.json();
  token = data.access_token;
  console.log(`\r  ${CHECK} Authenticated as ${c.bold}${data.user_name}${c.reset} ${elapsed(t)}`);
}

/**
 * Build a Fabric v4 price search filter body in the required {filter: {and: [...]}} format.
 * @param {Record<string, *>} props - key/value pairs; arrays use IN operator, scalars use =
 */
function priceFilter(props) {
  const and = [];
  for (const [property, val] of Object.entries(props)) {
    if (Array.isArray(val)) {
      and.push({ property, operator: 'IN', values: val });
    } else {
      and.push({ property, operator: '=', values: [val] });
    }
  }
  return { filter: { and } };
}

// ── Fetch Options ────────────────────────────────────────────────────────────

async function fetchWithStatus(label, fn, fallback = []) {
  const t = Date.now();
  process.stdout.write(`  ${ARROW} ${label}...`);
  try {
    const result = await fn();
    const count = Array.isArray(result) ? result.length : '?';
    console.log(`\r  ${CHECK} ${label} ${c.dim}\u2014${c.reset} ${c.bold}${count}${c.reset} items ${elapsed(t)}`);
    return result;
  } catch (err) {
    console.log(`\r  ${WARN} ${label} ${c.yellow}skipped${c.reset} ${elapsed(t)}`);
    console.log(`    ${c.dim}${err.message}${c.reset}`);
    return fallback;
  }
}

async function fetchMetros() {
  const res = await apiGet('/fabric/v4/metros?limit=200');
  const raw = res.data ?? res;
  // Normalize to our Metro type — strip extra API fields to keep defaults.json lean
  return raw.map((m) => ({
    code: m.code,
    name: m.name,
    region: m.region ?? 'AMER',
    connectedMetros: (m.connectedMetros ?? []).map((cm) => ({
      code: cm.code,
      avgLatency: cm.avgLatency ?? 0,
    })),
  }));
}

async function fetchDeviceTypes() {
  const res = await apiGet('/ne/v1/deviceTypes?limit=200');
  const raw = Array.isArray(res) ? res : res.data ?? [];
  // Normalize to our DeviceType type — extract only the fields the app needs
  return raw.map((dt) => ({
    deviceTypeCode: dt.deviceTypeCode ?? dt.code,
    name: dt.name,
    vendor: dt.vendor,
    category: dt.category ?? 'OTHER',
    availableMetros: (dt.availableMetros ?? dt.metros ?? []).map((m) =>
      typeof m === 'string' ? m : (m?.code ?? m?.metroCode ?? '')
    ).filter(Boolean),
    softwarePackages: (dt.softwarePackages ?? []).map((sp) => ({
      // Raw API uses "packageCode"; our TypeScript type uses "code"
      code: sp.packageCode ?? sp.code,
      name: sp.name,
    })),
    coreCounts: dt.coreCounts ?? extractCoreCounts(dt),
    coreMemoryMap: extractCoreMemoryMap(dt),
    availableLicenseTypes: extractLicenseTypes(dt),
    // Preserve deviceManagementTypes for core/license extraction during pricing
    deviceManagementTypes: dt.deviceManagementTypes,
  }));
}

/** Extract core counts from deviceManagementTypes if coreCounts isn't directly available */
function extractCoreCounts(dt) {
  const cores = new Set();
  for (const mgmt of Object.values(dt.deviceManagementTypes ?? {})) {
    for (const lic of Object.values(mgmt?.licenseOptions ?? {})) {
      for (const c of lic?.cores ?? []) {
        if (c.core) cores.add(c.core);
      }
    }
  }
  return cores.size > 0 ? [...cores].sort((a, b) => a - b) : [];
}

/** Extract core → memory mapping from deviceManagementTypes → licenseOptions → cores[] */
function extractCoreMemoryMap(dt) {
  const map = {};
  for (const mgmt of Object.values(dt.deviceManagementTypes ?? {})) {
    for (const lic of Object.values(mgmt?.licenseOptions ?? {})) {
      for (const c of lic?.cores ?? []) {
        if (c.core && c.memory && c.unit) {
          map[c.core] = `${c.memory} ${c.unit}`;
        }
      }
    }
  }
  return Object.keys(map).length > 0 ? map : undefined;
}

/** Extract available license types (e.g. "SUB", "BYOL") from deviceManagementTypes */
function extractLicenseTypes(dt) {
  const types = new Set();
  for (const mgmt of Object.values(dt.deviceManagementTypes ?? {})) {
    for (const key of Object.keys(mgmt?.licenseOptions ?? {})) {
      types.add(key);
    }
  }
  return types.size > 0 ? [...types] : undefined;
}

async function fetchServiceProfiles() {
  const res = await apiGet('/fabric/v4/serviceProfiles?limit=200&viewPoint=zSide');
  const raw = res.data ?? res;
  // Normalize to our ServiceProfile type
  return raw.map((sp) => ({
    uuid: sp.uuid,
    name: sp.name,
    type: sp.type,
    description: sp.description ?? '',
    visibility: sp.visibility ?? '',
    accessPointTypeConfigs: (sp.accessPointTypeConfigs ?? []).map((c) => ({
      type: c.type,
      supportedBandwidths: c.supportedBandwidths ?? [],
    })),
  }));
}

async function fetchRouterPackages() {
  const res = await apiGet('/fabric/v4/routerPackages');
  return res.data ?? res;
}

async function fetchEIALocations() {
  try {
    // Fetch both IA_VC (virtual/Fabric) and IA_C (colocation/dedicated) locations
    const [vcRes, coloRes] = await Promise.all([
      apiGet('/internetAccess/v2/ibxs?service.connection.type=IA_VC&limit=200').catch(() => ({ data: [] })),
      apiGet('/internetAccess/v2/ibxs?service.connection.type=IA_C&limit=200').catch(() => ({ data: [] })),
    ]);
    const vcLocs = vcRes.data ?? vcRes ?? [];
    const coloLocs = coloRes.data ?? coloRes ?? [];
    // Merge and deduplicate by IBX
    const seen = new Set();
    const merged = [];
    for (const loc of [...vcLocs, ...coloLocs]) {
      if (!seen.has(loc.ibx)) {
        seen.add(loc.ibx);
        merged.push(loc);
      }
    }
    return merged;
  } catch {
    return [];
  }
}

// ── Fetch Pricing ────────────────────────────────────────────────────────────

async function fetchFabricPortPricing(referenceIbx, fallbackIbx) {
  // Bandwidth in Mbps as required by the API; label is human-friendly key
  const speeds = [
    { label: '1G', mbps: 1000 },
    { label: '10G', mbps: 10000 },
    { label: '100G', mbps: 100000 },
    { label: '400G', mbps: 400000 },
  ];
  const portProducts = ['STANDARD', 'UNLIMITED', 'UNLIMITED_PLUS'];
  const combos = speeds.flatMap((s) =>
    portProducts.map((p) => ({ ...s, portProduct: p }))
  );
  const total = combos.length;
  const pricing = {};
  let completed = 0;
  const failedCombos = [];

  const ibxList = [referenceIbx, fallbackIbx].filter(Boolean);

  const { fail } = await runConcurrent(combos, async ({ label, mbps, portProduct }) => {
    const key = `${label}_${portProduct}`;
    for (const ibx of ibxList) {
      try {
        const res = await apiPost('/fabric/v4/prices/search', priceFilter({
          '/type': 'VIRTUAL_PORT_PRODUCT',
          '/port/location/ibx': ibx,
          '/port/type': 'XF_PORT',
          '/port/bandwidth': mbps,
          '/port/package/code': portProduct,
          '/port/connectivitySource/type': 'COLO',
          '/port/settings/buyout': false,
          '/port/lag/enabled': false,
        }));
        const charges = res.data?.[0]?.charges ?? [];
        const mrc = charges.find((ch) => ch.type === 'MONTHLY_RECURRING')?.price ?? 0;
        const nrc = charges.find((ch) => ch.type === 'NON_RECURRING')?.price ?? 0;
        pricing[key] = { mrc, nrc };
        completed++;
        process.stdout.write(`\r${progressBar(completed, total)} ${c.dim}${key}${c.reset}       `);
        return;
      } catch (err) {
        if (ibx === ibxList[ibxList.length - 1]) {
          failedCombos.push({ label: key, error: err.message || 'Unknown error' });
          completed++;
          process.stdout.write(`\r${progressBar(completed, total)} ${c.dim}${key}${c.reset}       `);
          return;
        }
      }
    }
  });
  process.stdout.write('\r' + ' '.repeat(70) + '\r');
  const okCount = Object.keys(pricing).length;
  const failCount = failedCombos.length;
  const status = failCount ? `${c.green}${okCount} ok${c.reset}, ${c.red}${failCount} failed${c.reset}` : `${c.green}${okCount} prices${c.reset}`;
  console.log(`  ${CHECK} Fabric Ports \u2014 ${status}`);
  if (failCount) {
    for (const f of failedCombos) {
      console.log(`    ${CROSS} ${c.dim}${f.label}:${c.reset} ${c.red}${f.error}${c.reset}`);
    }
  }
  return pricing;
}

/**
 * Fetch Fabric Port pricing for every metro that has an IBX in eiaLocations.
 * Returns { metroCode: { "1G_STANDARD": {mrc,nrc}, ... } } \u2014 one map per metro.
 * Falls back to the reference IBX result when a per-metro IBX lookup fails.
 */
async function fetchFabricPortPricingByMetro(metros, eiaLocations) {
  const speeds = [
    { label: '1G', mbps: 1000 },
    { label: '10G', mbps: 10000 },
    { label: '100G', mbps: 100000 },
    { label: '400G', mbps: 400000 },
  ];
  const portProducts = ['STANDARD', 'UNLIMITED', 'UNLIMITED_PLUS'];
  const portCombos = speeds.flatMap((s) =>
    portProducts.map((p) => ({ ...s, portProduct: p }))
  );

  // Pick one IBX per metro from the EIA locations catalog
  const metroIbx = new Map();
  for (const loc of eiaLocations) {
    if (loc.metroCode && loc.ibx && !metroIbx.has(loc.metroCode)) {
      metroIbx.set(loc.metroCode, loc.ibx);
    }
  }

  // Build a flat list of (metro, ibx, combo) so we can batch concurrently
  const targets = [];
  for (const m of metros) {
    const ibx = metroIbx.get(m.code);
    if (!ibx) continue; // metro has no known IBX in EIA catalog; skip
    for (const combo of portCombos) {
      targets.push({ metroCode: m.code, ibx, ...combo });
    }
  }
  const total = targets.length;
  if (total === 0) {
    console.log(`  ${c.dim}  Fabric Ports (per-metro) \u2014 no metros with IBX${c.reset}`);
    return {};
  }

  const byMetro = {};
  let completed = 0;
  const failedCombos = [];

  await runConcurrent(targets, async ({ metroCode, ibx, label, mbps, portProduct }) => {
    const key = `${label}_${portProduct}`;
    try {
      const res = await apiPost('/fabric/v4/prices/search', priceFilter({
        '/type': 'VIRTUAL_PORT_PRODUCT',
        '/port/location/ibx': ibx,
        '/port/type': 'XF_PORT',
        '/port/bandwidth': mbps,
        '/port/package/code': portProduct,
        '/port/connectivitySource/type': 'COLO',
        '/port/settings/buyout': false,
        '/port/lag/enabled': false,
      }));
      const charges = res.data?.[0]?.charges ?? [];
      const mrc = charges.find((ch) => ch.type === 'MONTHLY_RECURRING')?.price ?? 0;
      const nrc = charges.find((ch) => ch.type === 'NON_RECURRING')?.price ?? 0;
      if (!byMetro[metroCode]) byMetro[metroCode] = {};
      byMetro[metroCode][key] = { mrc, nrc };
    } catch (err) {
      failedCombos.push({ label: `${metroCode}/${key}`, error: err.message || 'Unknown error' });
    } finally {
      completed++;
      process.stdout.write(`\r${progressBar(completed, total)} ${c.dim}per-metro ports${c.reset}       `);
    }
  });
  process.stdout.write('\r' + ' '.repeat(80) + '\r');
  const metroCount = Object.keys(byMetro).length;
  const priceCount = Object.values(byMetro).reduce((s, m) => s + Object.keys(m).length, 0);
  const status = failedCombos.length
    ? `${c.green}${metroCount} metros (${priceCount} prices)${c.reset}, ${c.red}${failedCombos.length} failed${c.reset}`
    : `${c.green}${metroCount} metros (${priceCount} prices)${c.reset}`;
  console.log(`  ${CHECK} Fabric Ports (per-metro) \u2014 ${status}`);
  if (failedCombos.length && failedCombos.length <= 20) {
    for (const f of failedCombos) {
      console.log(`    ${CROSS} ${c.dim}${f.label}:${c.reset} ${c.red}${f.error}${c.reset}`);
    }
  } else if (failedCombos.length > 20) {
    console.log(`    ${c.dim}(${failedCombos.length} failures omitted)${c.reset}`);
  }
  return byMetro;
}

async function fetchVCPricing(referenceMetro, fallbackMetro) {
  const bandwidths = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 50000];
  const total = bandwidths.length;
  const pricing = {};
  let completed = 0;
  const failedCombos = [];

  const metroList = [referenceMetro, fallbackMetro].filter(Boolean);

  const { fail } = await runConcurrent(bandwidths, async (bw) => {
    const label = bw >= 1000 ? `${bw / 1000}G` : `${bw}M`;
    for (const metro of metroList) {
      try {
        const res = await apiPost('/fabric/v4/prices/search', priceFilter({
          '/type': 'VIRTUAL_CONNECTION_PRODUCT',
          '/connection/type': 'EVPL_VC',
          '/connection/bandwidth': bw,
          '/connection/aSide/accessPoint/type': 'COLO',
          '/connection/aSide/accessPoint/location/metroCode': metro,
          '/connection/aSide/accessPoint/port/settings/buyout': false,
          '/connection/zSide/accessPoint/type': 'COLO',
          '/connection/zSide/accessPoint/location/metroCode': metro,
        }));
        const charges = res.data?.[0]?.charges ?? [];
        const mrc = charges.find((ch) => ch.type === 'MONTHLY_RECURRING')?.price ?? 0;
        const nrc = charges.find((ch) => ch.type === 'NON_RECURRING')?.price ?? 0;
        pricing[String(bw)] = { mrc, nrc };
        completed++;
        process.stdout.write(`\r${progressBar(completed, total)} ${c.dim}${label}${c.reset}       `);
        return;
      } catch (err) {
        if (metro === metroList[metroList.length - 1]) {
          failedCombos.push({ label: `VC ${label}`, error: err.message || 'Unknown error' });
          completed++;
          process.stdout.write(`\r${progressBar(completed, total)} ${c.dim}${label}${c.reset}       `);
          return;
        }
      }
    }
  });
  process.stdout.write('\r' + ' '.repeat(70) + '\r');
  const okCount = Object.keys(pricing).length;
  const failCount = failedCombos.length;
  const status = failCount ? `${c.green}${okCount} ok${c.reset}, ${c.red}${failCount} failed${c.reset}` : `${c.green}${okCount} prices${c.reset}`;
  console.log(`  ${CHECK} Virtual Connections \u2014 ${status}`);
  if (failCount) {
    for (const f of failedCombos) {
      console.log(`    ${CROSS} ${c.dim}${f.label}:${c.reset} ${c.red}${f.error}${c.reset}`);
    }
  }
  return pricing;
}

async function fetchCloudRouterPricing(routerPackages, referenceMetro, fallbackMetro) {
  const total = routerPackages.length;
  const pricing = {};
  let completed = 0;
  const failedCombos = [];

  const metroList = [referenceMetro, fallbackMetro].filter(Boolean);

  const { fail } = await runConcurrent(routerPackages, async (pkg) => {
    for (const metro of metroList) {
      try {
        const res = await apiPost('/fabric/v4/prices/search', priceFilter({
          '/type': 'CLOUD_ROUTER_PRODUCT',
          '/router/package/code': pkg.code,
          '/router/location/metroCode': metro,
        }));
        const charges = res.data?.[0]?.charges ?? [];
        const mrc = charges.find((ch) => ch.type === 'MONTHLY_RECURRING')?.price ?? 0;
        const nrc = charges.find((ch) => ch.type === 'NON_RECURRING')?.price ?? 0;
        pricing[pkg.code] = { mrc, nrc };
        completed++;
        process.stdout.write(`\r${progressBar(completed, total)} ${c.dim}${pkg.code}${c.reset}       `);
        return;
      } catch (err) {
        if (metro === metroList[metroList.length - 1]) {
          failedCombos.push({ label: `FCR ${pkg.code}`, error: err.message || 'Unknown error' });
          completed++;
          process.stdout.write(`\r${progressBar(completed, total)} ${c.dim}${pkg.code}${c.reset}       `);
          return;
        }
      }
    }
  });
  process.stdout.write('\r' + ' '.repeat(70) + '\r');
  const okCount = Object.keys(pricing).length;
  const failCount = failedCombos.length;
  const status = failCount ? `${c.green}${okCount} ok${c.reset}, ${c.red}${failCount} failed${c.reset}` : `${c.green}${okCount} prices${c.reset}`;
  console.log(`  ${CHECK} Cloud Router \u2014 ${status}`);
  if (failCount) {
    for (const f of failedCombos) {
      console.log(`    ${CROSS} ${c.dim}${f.label}:${c.reset} ${c.red}${f.error}${c.reset}`);
    }
  }
  return pricing;
}

async function fetchNetworkEdgePricing(deviceTypes, referenceMetro, fallbackMetro) {
  const termLengths = [1, 12, 24, 36];
  const pricing = {};

  // Extract the first available license type from deviceManagementTypes
  function getDefaultLicenseType(dt) {
    for (const mgmt of Object.values(dt.deviceManagementTypes ?? {})) {
      const keys = Object.keys(mgmt?.licenseOptions ?? {});
      if (keys.length) return keys[0]; // e.g. "SUB" or "BYOL"
    }
    return undefined;
  }

  // Build flat list of all combinations: deviceType × coreCount × term
  const combos = [];
  for (const dt of deviceTypes) {
    const licenseType = getDefaultLicenseType(dt);
    const cores = dt.coreCounts?.length ? dt.coreCounts : [2]; // fallback
    const firstPkg = (dt.softwarePackages ?? [])[0]?.code; // for API softwarePackage param
    for (const coreCount of cores) {
      for (const term of termLengths) {
        combos.push({ dt, coreCount, term, licenseType, softwarePackage: firstPkg });
      }
    }
  }
  const total = combos.length;

  if (total === 0) {
    console.log(`  ${c.dim}  Network Edge \u2014 no device types to price${c.reset}`);
    return pricing;
  }

  let completed = 0;
  const failedCombos = []; // Track which configs failed

  // Try primary metro first, then fallback metro on failure
  async function fetchOneCombo({ dt, coreCount, term, licenseType, softwarePackage }) {
    const key = `${dt.deviceTypeCode}_${coreCount}_${term}`;
    const comboLabel = `${dt.deviceTypeCode} / ${coreCount} cores / ${term}mo`;

    for (const metro of [referenceMetro, fallbackMetro].filter(Boolean)) {
      try {
        const params = {
          vendorPackage: dt.deviceTypeCode,
          termLength: String(term),
          metro,
          core: String(coreCount),
        };
        if (softwarePackage) params.softwarePackage = softwarePackage;
        if (licenseType) params.licenseType = licenseType;
        const qs = new URLSearchParams(params);
        const res = await apiGet(`/ne/v1/prices?${qs}`);
        const charges = res.primary?.charges ?? [];
        const deviceCharge = charges.find((ch) => ch.description === 'VIRTUAL_DEVICE');
        const licenseCharge = charges.find((ch) => ch.description === 'DEVICE_LICENSE');
        const mrc = Number(deviceCharge?.monthlyRecurringCharges ?? 0) +
                    Number(licenseCharge?.monthlyRecurringCharges ?? 0);
        pricing[key] = { mrc, nrc: 0 };
        completed++;
        process.stdout.write(`\r${progressBar(completed, total)} ${c.dim}${dt.deviceTypeCode}${c.reset}       `);
        return; // success
      } catch (err) {
        if (metro === fallbackMetro || !fallbackMetro) {
          // Both metros failed — record the failure
          failedCombos.push({ label: comboLabel, error: err.message || 'Unknown error' });
          completed++;
          process.stdout.write(`\r${progressBar(completed, total)} ${c.dim}${dt.deviceTypeCode}${c.reset}       `);
          return;
        }
        // Primary failed, will retry with fallback
      }
    }
  }

  // Process in concurrent batches
  for (let i = 0; i < combos.length; i += CONCURRENCY) {
    const batch = combos.slice(i, i + CONCURRENCY);
    await Promise.allSettled(batch.map(fetchOneCombo));
  }

  process.stdout.write('\r' + ' '.repeat(80) + '\r');
  const okCount = Object.keys(pricing).length;
  const failCount = failedCombos.length;
  const status = failCount ? `${c.green}${okCount} ok${c.reset}, ${c.red}${failCount} failed${c.reset}` : `${c.green}${okCount} prices${c.reset}`;
  console.log(`  ${CHECK} Network Edge \u2014 ${status}`);
  if (failCount) {
    if (failCount <= 50) {
      // List every failure individually
      for (const f of failedCombos) {
        console.log(`    ${CROSS} ${c.dim}${f.label}:${c.reset} ${c.red}${f.error}${c.reset}`);
      }
    } else {
      // Too many to list — group by device type
      const byDevice = new Map();
      for (const f of failedCombos) {
        const deviceCode = f.label.split(' / ')[0];
        const existing = byDevice.get(deviceCode) ?? [];
        existing.push(f);
        byDevice.set(deviceCode, existing);
      }
      for (const [deviceCode, entries] of byDevice) {
        const reason = entries[0].error;
        console.log(`    ${CROSS} ${c.bold}${deviceCode}${c.reset} ${c.dim}(${entries.length} combos)${c.reset}: ${c.red}${reason}${c.reset}`);
      }
    }
  }
  return pricing;
}

/**
 * Per-metro VC same-metro pricing.
 * Returns { metroCode: { "1000": {mrc,nrc}, ... } }.
 */
async function fetchVCPricingByMetro(metros) {
  const bandwidths = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 50000];
  const targets = metros.flatMap((m) => bandwidths.map((bw) => ({ metroCode: m.code, bw })));
  const total = targets.length;
  const byMetro = {};
  let completed = 0;
  const failedCombos = [];

  await runConcurrent(targets, async ({ metroCode, bw }) => {
    try {
      const res = await apiPost('/fabric/v4/prices/search', priceFilter({
        '/type': 'VIRTUAL_CONNECTION_PRODUCT',
        '/connection/type': 'EVPL_VC',
        '/connection/bandwidth': bw,
        '/connection/aSide/accessPoint/type': 'COLO',
        '/connection/aSide/accessPoint/location/metroCode': metroCode,
        '/connection/aSide/accessPoint/port/settings/buyout': false,
        '/connection/zSide/accessPoint/type': 'COLO',
        '/connection/zSide/accessPoint/location/metroCode': metroCode,
      }));
      const charges = res.data?.[0]?.charges ?? [];
      const mrc = charges.find((ch) => ch.type === 'MONTHLY_RECURRING')?.price ?? 0;
      const nrc = charges.find((ch) => ch.type === 'NON_RECURRING')?.price ?? 0;
      if (!byMetro[metroCode]) byMetro[metroCode] = {};
      byMetro[metroCode][String(bw)] = { mrc, nrc };
    } catch (err) {
      failedCombos.push({ label: `${metroCode}/${bw}`, error: err.message || 'Unknown error' });
    } finally {
      completed++;
      process.stdout.write(`\r${progressBar(completed, total)} ${c.dim}per-metro VCs${c.reset}       `);
    }
  });
  process.stdout.write('\r' + ' '.repeat(80) + '\r');
  const metroCount = Object.keys(byMetro).length;
  const priceCount = Object.values(byMetro).reduce((s, m) => s + Object.keys(m).length, 0);
  const status = failedCombos.length
    ? `${c.green}${metroCount} metros (${priceCount} prices)${c.reset}, ${c.red}${failedCombos.length} failed${c.reset}`
    : `${c.green}${metroCount} metros (${priceCount} prices)${c.reset}`;
  console.log(`  ${CHECK} Virtual Connections (per-metro) — ${status}`);
  if (failedCombos.length > 20) console.log(`    ${c.dim}(${failedCombos.length} failures omitted)${c.reset}`);
  return byMetro;
}

/**
 * Per-metro Cloud Router pricing.
 * Returns { metroCode: { "STANDARD": {mrc,nrc}, ... } }.
 */
async function fetchCloudRouterPricingByMetro(routerPackages, metros) {
  const targets = metros.flatMap((m) => routerPackages.map((pkg) => ({ metroCode: m.code, pkg })));
  const total = targets.length;
  if (total === 0) {
    console.log(`  ${c.dim}  Cloud Router (per-metro) — no packages${c.reset}`);
    return {};
  }
  const byMetro = {};
  let completed = 0;
  const failedCombos = [];

  await runConcurrent(targets, async ({ metroCode, pkg }) => {
    try {
      const res = await apiPost('/fabric/v4/prices/search', priceFilter({
        '/type': 'CLOUD_ROUTER_PRODUCT',
        '/router/package/code': pkg.code,
        '/router/location/metroCode': metroCode,
      }));
      const charges = res.data?.[0]?.charges ?? [];
      const mrc = charges.find((ch) => ch.type === 'MONTHLY_RECURRING')?.price ?? 0;
      const nrc = charges.find((ch) => ch.type === 'NON_RECURRING')?.price ?? 0;
      if (!byMetro[metroCode]) byMetro[metroCode] = {};
      byMetro[metroCode][pkg.code] = { mrc, nrc };
    } catch (err) {
      failedCombos.push({ label: `${metroCode}/${pkg.code}`, error: err.message || 'Unknown error' });
    } finally {
      completed++;
      process.stdout.write(`\r${progressBar(completed, total)} ${c.dim}per-metro FCR${c.reset}       `);
    }
  });
  process.stdout.write('\r' + ' '.repeat(80) + '\r');
  const metroCount = Object.keys(byMetro).length;
  const priceCount = Object.values(byMetro).reduce((s, m) => s + Object.keys(m).length, 0);
  const status = failedCombos.length
    ? `${c.green}${metroCount} metros (${priceCount} prices)${c.reset}, ${c.red}${failedCombos.length} failed${c.reset}`
    : `${c.green}${metroCount} metros (${priceCount} prices)${c.reset}`;
  console.log(`  ${CHECK} Cloud Router (per-metro) — ${status}`);
  if (failedCombos.length > 20) console.log(`    ${c.dim}(${failedCombos.length} failures omitted)${c.reset}`);
  return byMetro;
}

/**
 * Per-metro EIA pricing (one IBX per metro from eiaLocations).
 * Returns { metroCode: { "IA_C_FIXED_1000": {mrc,nrc}, ... } }.
 */
async function fetchEIAPricingByMetro(metros, eiaLocations) {
  const bandwidths = [50, 100, 200, 500, 1000, 2000, 5000, 10000];

  const metroIbx = new Map();
  for (const loc of eiaLocations) {
    if (loc.metroCode && loc.ibx && !metroIbx.has(loc.metroCode)) {
      metroIbx.set(loc.metroCode, loc.ibx);
    }
  }

  const targets = [];
  for (const m of metros) {
    const ibx = metroIbx.get(m.code);
    if (!ibx) continue;
    for (const bw of bandwidths) {
      targets.push({ metroCode: m.code, ibx, bw });
    }
  }
  const total = targets.length;
  if (total === 0) {
    console.log(`  ${c.dim}  Internet Access (per-metro) — no metros with IBX${c.reset}`);
    return {};
  }

  const byMetro = {};
  let completed = 0;
  const failedCombos = [];

  await runConcurrent(targets, async ({ metroCode, ibx, bw }) => {
    const key = `IA_C_FIXED_${bw}`;
    const portSpeed = bw <= 1000 ? 1000 : bw <= 10000 ? 10000 : 100000;
    try {
      const body = {
        filter: {
          and: [
            { property: '/type', operator: '=', values: ['INTERNET_ACCESS_PRODUCT'] },
            { property: '/account/accountNumber', operator: '=', values: ['1'] },
            { property: '/service/type', operator: '=', values: ['SINGLE_PORT'] },
            { property: '/service/bandwidth', operator: '=', values: [String(bw)] },
            { property: '/service/billing', operator: '=', values: ['FIXED'] },
            { property: '/service/useCase', operator: '=', values: ['MAIN'] },
            { property: '/service/connection/type', operator: '=', values: ['IA_C'] },
            { property: '/service/connection/aSide/accessPoint/type', operator: '=', values: ['COLO'] },
            { property: '/service/connection/aSide/accessPoint/location/ibx', operator: '=', values: [ibx] },
            { property: '/service/connection/aSide/accessPoint/port/physicalPort/speed', operator: '=', values: [String(portSpeed)] },
            { property: '/service/connection/aSide/accessPoint/port/physicalPortQuantity', operator: '=', values: ['1'] },
          ],
        },
      };
      const res = await apiPost('/internetAccess/v1/prices/search', body);
      const charges = res.data?.[0]?.summary?.charges ?? [];
      const mrc = charges.find((ch) => ch.type === 'MONTHLY_RECURRING')?.price ?? 0;
      const nrc = charges.find((ch) => ch.type === 'NON_RECURRING')?.price ?? 0;
      if (!byMetro[metroCode]) byMetro[metroCode] = {};
      byMetro[metroCode][key] = { mrc, nrc };
      // Mirror IA_C → IA_VC (v1 API only prices IA_C; same value used as pre-sales estimate for Fabric delivery)
      byMetro[metroCode][`IA_VC_FIXED_${bw}`] = { mrc, nrc };
    } catch (err) {
      failedCombos.push({ label: `${metroCode}/${key}`, error: err.message || 'Unknown error' });
    } finally {
      completed++;
      process.stdout.write(`\r${progressBar(completed, total)} ${c.dim}per-metro EIA${c.reset}       `);
    }
  });
  process.stdout.write('\r' + ' '.repeat(80) + '\r');
  const metroCount = Object.keys(byMetro).length;
  const priceCount = Object.values(byMetro).reduce((s, m) => s + Object.keys(m).length, 0);
  const status = failedCombos.length
    ? `${c.green}${metroCount} metros (${priceCount} prices)${c.reset}, ${c.red}${failedCombos.length} failed${c.reset}`
    : `${c.green}${metroCount} metros (${priceCount} prices)${c.reset}`;
  console.log(`  ${CHECK} Internet Access (per-metro) — ${status}`);
  if (failedCombos.length > 20) console.log(`    ${c.dim}(${failedCombos.length} failures omitted)${c.reset}`);
  return byMetro;
}

async function fetchVCPairPricing(metros) {
  // Expanded coverage: top metros by region, evenly distributed (was 13, now ~30).
  // Picks the metros most commonly used in customer designs across AMER / EMEA / APAC.
  const KEY_METROS_DEFAULT = [
    // AMER (10)
    'DC', 'NY', 'SV', 'CH', 'DA', 'AT', 'LA', 'SE', 'MI', 'SP',
    // EMEA (10)
    'LD', 'AM', 'FR', 'PA', 'ZH', 'ML', 'MA', 'DU', 'JB', 'IL',
    // APAC (10)
    'SG', 'HK', 'TY', 'SY', 'MB', 'SL', 'OS', 'JK', 'PE', 'CN',
  ];
  // Use metros parameter if provided to honor real-data-only mode; otherwise the default 30.
  const provided = (metros ?? []).map((m) => m.code);
  const KEY_METROS = provided.length
    ? KEY_METROS_DEFAULT.filter((code) => provided.includes(code))
    : KEY_METROS_DEFAULT;
  const bandwidths = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 50000];
  const pricing = {};

  // Build all pair × bandwidth combinations
  // 13 same-metro + C(13,2)=78 cross-metro = 91 pairs × 9 bw = 819 fetches
  const pairs = [];
  for (let i = 0; i < KEY_METROS.length; i++) {
    for (let j = i; j < KEY_METROS.length; j++) {
      pairs.push([KEY_METROS[i], KEY_METROS[j]]);
    }
  }

  const combos = pairs.flatMap(([a, z]) =>
    bandwidths.map((bw) => ({ aSide: a, zSide: z, bw }))
  );
  const total = combos.length;
  let completed = 0;
  const failedCombos = [];

  await runConcurrent(combos, async ({ aSide, zSide, bw }) => {
    const pairKey = [aSide, zSide].sort().join('|');
    const label = bw >= 1000 ? `${bw / 1000}G` : `${bw}M`;
    try {
      const res = await apiPost('/fabric/v4/prices/search', priceFilter({
        '/type': 'VIRTUAL_CONNECTION_PRODUCT',
        '/connection/type': 'EVPL_VC',
        '/connection/bandwidth': bw,
        '/connection/aSide/accessPoint/type': 'COLO',
        '/connection/aSide/accessPoint/location/metroCode': aSide,
        '/connection/aSide/accessPoint/port/settings/buyout': false,
        '/connection/zSide/accessPoint/type': 'COLO',
        '/connection/zSide/accessPoint/location/metroCode': zSide,
      }));
      const charges = res.data?.[0]?.charges ?? [];
      const mrc = charges.find((ch) => ch.type === 'MONTHLY_RECURRING')?.price ?? 0;
      const nrc = charges.find((ch) => ch.type === 'NON_RECURRING')?.price ?? 0;
      if (!pricing[pairKey]) pricing[pairKey] = {};
      pricing[pairKey][String(bw)] = { mrc, nrc };
      completed++;
      process.stdout.write(`\r${progressBar(completed, total)} ${c.dim}${pairKey} ${label}${c.reset}       `);
    } catch (err) {
      failedCombos.push({ label: `${pairKey} ${label}`, error: err.message || 'Unknown error' });
      completed++;
      process.stdout.write(`\r${progressBar(completed, total)} ${c.dim}${pairKey} ${label}${c.reset}       `);
    }
  });
  process.stdout.write('\r' + ' '.repeat(80) + '\r');
  const pairCount = Object.keys(pricing).length;
  const priceCount = Object.values(pricing).reduce((sum, bws) => sum + Object.keys(bws).length, 0);
  const failCount = failedCombos.length;
  const status = failCount
    ? `${c.green}${pairCount} pairs (${priceCount} prices)${c.reset}, ${c.red}${failCount} failed${c.reset}`
    : `${c.green}${pairCount} pairs (${priceCount} prices)${c.reset}`;
  console.log(`  ${CHECK} VC Pairs — ${status}`);
  if (failCount && failCount <= 20) {
    for (const f of failedCombos) {
      console.log(`    ${CROSS} ${c.dim}${f.label}:${c.reset} ${c.red}${f.error}${c.reset}`);
    }
  } else if (failCount > 20) {
    console.log(`    ${c.dim}(${failCount} failures omitted)${c.reset}`);
  }
  return pricing;
}

async function fetchEIAPricing(referenceIbx, fallbackIbx) {
  // Only IA_C (dedicated port) is supported by v1 pricing API; IA_VC has no pricing examples in spec
  const connectionTypes = ['IA_C'];
  const bandwidths = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
  const combos = connectionTypes.flatMap((ct) =>
    bandwidths.map((bw) => ({ connectionType: ct, bandwidth: bw }))
  );
  const total = combos.length;
  const pricing = {};
  let completed = 0;
  const failedCombos = [];

  const ibxList = [referenceIbx, fallbackIbx].filter(Boolean);

  const { fail } = await runConcurrent(combos, async ({ connectionType, bandwidth }) => {
    const key = `${connectionType}_FIXED_${bandwidth}`;
    const label = bandwidth >= 1000 ? `${bandwidth / 1000}G` : `${bandwidth}M`;
    // Pick smallest physical port speed that fits the bandwidth
    const portSpeed = bandwidth <= 1000 ? 1000 : bandwidth <= 10000 ? 10000 : 100000;

    for (const ibx of ibxList) {
      try {
        // EIA v1 API requires all values as strings per OpenAPI spec
        const body = {
          filter: {
            and: [
              { property: '/type', operator: '=', values: ['INTERNET_ACCESS_PRODUCT'] },
              { property: '/account/accountNumber', operator: '=', values: ['1'] },
              { property: '/service/type', operator: '=', values: ['SINGLE_PORT'] },
              { property: '/service/bandwidth', operator: '=', values: [String(bandwidth)] },
              { property: '/service/billing', operator: '=', values: ['FIXED'] },
              { property: '/service/useCase', operator: '=', values: ['MAIN'] },
              { property: '/service/connection/type', operator: '=', values: [connectionType] },
              { property: '/service/connection/aSide/accessPoint/type', operator: '=', values: ['COLO'] },
              { property: '/service/connection/aSide/accessPoint/location/ibx', operator: '=', values: [ibx] },
              { property: '/service/connection/aSide/accessPoint/port/physicalPort/speed', operator: '=', values: [String(portSpeed)] },
              { property: '/service/connection/aSide/accessPoint/port/physicalPortQuantity', operator: '=', values: ['1'] },
            ],
          },
        };
        const res = await apiPost('/internetAccess/v1/prices/search', body);
        const charges = res.data?.[0]?.summary?.charges ?? [];
        const mrc = charges.find((ch) => ch.type === 'MONTHLY_RECURRING')?.price ?? 0;
        const nrc = charges.find((ch) => ch.type === 'NON_RECURRING')?.price ?? 0;
        pricing[key] = { mrc, nrc };
        completed++;
        process.stdout.write(`\r${progressBar(completed, total)} ${c.dim}${connectionType} ${label}${c.reset}       `);
        return;
      } catch (err) {
        if (ibx === ibxList[ibxList.length - 1]) {
          failedCombos.push({ label: `EIA ${connectionType} ${label}`, error: err.message || 'Unknown error' });
          completed++;
          process.stdout.write(`\r${progressBar(completed, total)} ${c.dim}${connectionType} ${label}${c.reset}       `);
          return;
        }
      }
    }
  });
  process.stdout.write('\r' + ' '.repeat(70) + '\r');
  const okCount = Object.keys(pricing).length;
  const failCount = failedCombos.length;
  const status = failCount ? `${c.green}${okCount} ok${c.reset}, ${c.red}${failCount} failed${c.reset}` : `${c.green}${okCount} prices${c.reset}`;
  console.log(`  ${CHECK} Internet Access — ${status}`);
  if (failCount) {
    for (const f of failedCombos) {
      console.log(`    ${CROSS} ${c.dim}${f.label}:${c.reset} ${c.red}${f.error}${c.reset}`);
    }
  }
  // Mirror IA_C prices as IA_VC (v1 API only supports IA_C pricing;
  // use same prices as pre-sales estimates for Fabric/NE delivery)
  for (const bw of bandwidths) {
    const src = pricing[`IA_C_FIXED_${bw}`];
    if (src) pricing[`IA_VC_FIXED_${bw}`] = { ...src };
  }
  return pricing;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  console.log('');
  console.log(`${c.bold}  Equinix API Data Fetcher${c.reset}`);
  console.log(`${c.dim}  Builds public/data/defaults.json from live API data${c.reset}`);
  console.log('');

  // ── Phase 1: Auth ──────────────────────────────────────────────────────────
  console.log(`${c.bold}${c.cyan}[1/4]${c.reset}${c.bold} Authenticating${c.reset}`);
  await authenticate();
  console.log('');

  // ── Phase 2: Options (parallel) ─────────────────────────────────────────────
  console.log(`${c.bold}${c.cyan}[2/4]${c.reset}${c.bold} Fetching catalog data${c.reset} ${c.dim}(parallel)${c.reset}`);
  const catalogResults = await Promise.allSettled([
    fetchWithStatus('Metros', fetchMetros),
    fetchWithStatus('Network Edge device types', fetchDeviceTypes),
    fetchWithStatus('Fabric service profiles', fetchServiceProfiles),
    fetchWithStatus('Cloud Router packages', fetchRouterPackages),
    fetchWithStatus('Internet Access locations', fetchEIALocations),
  ]);
  const metros = catalogResults[0].status === 'fulfilled' ? catalogResults[0].value : [];
  const deviceTypes = catalogResults[1].status === 'fulfilled' ? catalogResults[1].value : [];
  const serviceProfiles = catalogResults[2].status === 'fulfilled' ? catalogResults[2].value : [];
  const routerPackages = catalogResults[3].status === 'fulfilled' ? catalogResults[3].value : [];
  const eiaLocations = catalogResults[4].status === 'fulfilled' ? catalogResults[4].value : [];
  if (metros.length === 0) {
    console.log(`\n  ${CROSS} ${c.red}No metros returned — cannot continue without metro data.${c.reset}\n`);
    process.exit(1);
  }
  console.log('');

  // ── Phase 3: Pricing ───────────────────────────────────────────────────────
  const referenceMetro = 'DC';
  const fallbackMetro = 'SV';
  // Pick first IBX in the reference metro from EIA locations, or fall back to a well-known one
  const referenceIbx = eiaLocations.find((loc) => loc.metroCode === referenceMetro)?.ibx ?? 'DC6';
  const fallbackIbx = eiaLocations.find((loc) => loc.metroCode === fallbackMetro)?.ibx ?? 'SV5';
  console.log(`${c.bold}${c.cyan}[3/4]${c.reset}${c.bold} Fetching pricing${c.reset} ${c.dim}(primary: ${referenceMetro}/${referenceIbx}, fallback: ${fallbackMetro}/${fallbackIbx}) (parallel)${c.reset}`);

  const pricingResults = await Promise.allSettled([
    fetchFabricPortPricing(referenceIbx, fallbackIbx),
    fetchVCPricing(referenceMetro, fallbackMetro),
    fetchCloudRouterPricing(routerPackages, referenceMetro, fallbackMetro),
    fetchNetworkEdgePricing(deviceTypes, referenceMetro, fallbackMetro),
    fetchEIAPricing(referenceIbx, fallbackIbx),
    fetchVCPairPricing(metros),
    // Per-metro expansions for richer offline data:
    fetchFabricPortPricingByMetro(metros, eiaLocations),
    fetchVCPricingByMetro(metros),
    fetchCloudRouterPricingByMetro(routerPackages, metros),
    fetchEIAPricingByMetro(metros, eiaLocations),
  ]);

  const pricingLabels = [
    'Fabric Port', 'VC', 'Cloud Router', 'Network Edge', 'Internet Access', 'VC Pairs',
    'Fabric Port (per-metro)', 'VC (per-metro)', 'Cloud Router (per-metro)', 'Internet Access (per-metro)',
  ];
  const [
    fabricPortPricing, vcPricing, cloudRouterPricing, nePricing, eiaPricing, vcPairPricing,
    fabricPortsByMetro, vcByMetro, cloudRouterByMetro, eiaByMetro,
  ] = pricingResults.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      console.log(`  ${WARN} ${pricingLabels[i]} pricing ${c.yellow}skipped${c.reset} ${c.dim}\u2014 ${r.reason?.message}${c.reset}`);
      return {};
    });
  console.log('');

  // ── Phase 4: Write ─────────────────────────────────────────────────────────
  console.log(`${c.bold}${c.cyan}[4/4]${c.reset}${c.bold} Writing output${c.reset}`);

  const defaults = {
    fetchedAt: new Date().toISOString(),
    referenceMetro,
    referenceIbx,
    metros,
    deviceTypes,
    serviceProfiles,
    routerPackages,
    eiaLocations,
    pricing: {
      // Reference (single-metro) tables — used as the fallback when a per-metro lookup misses
      fabricPorts: fabricPortPricing,
      virtualConnections: vcPricing,
      virtualConnectionPairs: vcPairPricing,
      cloudRouter: cloudRouterPricing,
      networkEdge: nePricing,
      internetAccess: eiaPricing,
      // Per-metro tables for richer offline data (introduced for the Offline Data mode)
      fabricPortsByMetro,
      virtualConnectionsByMetro: vcByMetro,
      cloudRouterByMetro,
      internetAccessByMetro: eiaByMetro,
    },
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const json = JSON.stringify(defaults, null, 2);
  writeFileSync(OUTPUT_FILE, json);
  const sizeKb = (Buffer.byteLength(json) / 1024).toFixed(0);
  console.log(`  ${CHECK} Wrote ${c.bold}public/data/defaults.json${c.reset} ${c.dim}(${sizeKb} KB)${c.reset}`);

  // Also write to ./data/ for Docker volume mount persistence
  mkdirSync(DOCKER_DATA_DIR, { recursive: true });
  writeFileSync(DOCKER_DATA_FILE, json);
  console.log(`  ${CHECK} Wrote ${c.bold}data/defaults.json${c.reset} ${c.dim}(Docker volume)${c.reset}`);
  console.log('');

  // ── Summary ────────────────────────────────────────────────────────────────
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const vcPairPriceCount = Object.values(vcPairPricing).reduce((sum, bws) => sum + Object.keys(bws).length, 0);
  const totalPrices = Object.keys(fabricPortPricing).length +
    Object.keys(vcPricing).length +
    vcPairPriceCount +
    Object.keys(cloudRouterPricing).length +
    Object.keys(nePricing).length +
    Object.keys(eiaPricing).length;

  console.log(`${c.bold}  \u2500\u2500\u2500 Summary \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500${c.reset}`);
  console.log('');
  console.log(`  ${c.dim}Catalog${c.reset}    Metros ${c.bold}${metros.length}${c.reset}  \u2502  Devices ${c.bold}${deviceTypes.length}${c.reset}  \u2502  Profiles ${c.bold}${serviceProfiles.length}${c.reset}`);
  console.log(`             Packages ${c.bold}${routerPackages.length}${c.reset}  \u2502  EIA Locations ${c.bold}${eiaLocations.length}${c.reset}`);
  console.log('');
  const perMetroPortsPrices = Object.values(fabricPortsByMetro).reduce((s, m) => s + Object.keys(m).length, 0);
  const perMetroVcPrices = Object.values(vcByMetro).reduce((s, m) => s + Object.keys(m).length, 0);
  const perMetroFcrPrices = Object.values(cloudRouterByMetro).reduce((s, m) => s + Object.keys(m).length, 0);
  const perMetroEiaPrices = Object.values(eiaByMetro).reduce((s, m) => s + Object.keys(m).length, 0);
  const perMetroTotal = perMetroPortsPrices + perMetroVcPrices + perMetroFcrPrices + perMetroEiaPrices;

  console.log(`  ${c.dim}Reference${c.reset}  Ports ${c.bold}${Object.keys(fabricPortPricing).length}${c.reset}  \u2502  VCs ${c.bold}${Object.keys(vcPricing).length}${c.reset}  \u2502  VC Pairs ${c.bold}${Object.keys(vcPairPricing).length}${c.reset} (${c.bold}${vcPairPriceCount}${c.reset} prices)  \u2502  FCR ${c.bold}${Object.keys(cloudRouterPricing).length}${c.reset}  \u2502  NE ${c.bold}${Object.keys(nePricing).length}${c.reset}  \u2502  EIA ${c.bold}${Object.keys(eiaPricing).length}${c.reset}`);
  console.log(`  ${c.dim}Per-metro${c.reset}  Ports ${c.bold}${Object.keys(fabricPortsByMetro).length}${c.reset} metros (${c.bold}${perMetroPortsPrices}${c.reset})  \u2502  VCs ${c.bold}${Object.keys(vcByMetro).length}${c.reset} (${c.bold}${perMetroVcPrices}${c.reset})  \u2502  FCR ${c.bold}${Object.keys(cloudRouterByMetro).length}${c.reset} (${c.bold}${perMetroFcrPrices}${c.reset})  \u2502  EIA ${c.bold}${Object.keys(eiaByMetro).length}${c.reset} (${c.bold}${perMetroEiaPrices}${c.reset})`);
  console.log('');
  console.log(`  ${c.dim}Total${c.reset}      ${c.bold}${totalPrices + perMetroTotal}${c.reset} prices  \u2502  ${c.bold}${apiCalls}${c.reset} API calls  \u2502  ${c.bold}${totalElapsed}s${c.reset}`);
  console.log('');
  console.log(`  ${c.green}${c.bold}\u2714 Done!${c.reset} Commit ${c.bold}public/data/defaults.json${c.reset} and rebuild to deploy.`);
  console.log('');
}

main().catch((err) => {
  console.error(`\n  ${CROSS} ${c.red}${c.bold}Fatal error:${c.reset} ${err.message}\n`);
  process.exit(1);
});
