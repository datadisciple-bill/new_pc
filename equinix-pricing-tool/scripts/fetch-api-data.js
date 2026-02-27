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

async function apiGet(path) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await sleep(RATE_LIMIT_MS);
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
        throw new Error(`${res.status} ${res.statusText}: ${body.slice(0, 120)}`);
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
      await sleep(RATE_LIMIT_MS);
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
        throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 120)}`);
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
    const msg = err.message?.length > 80 ? err.message.slice(0, 80) + '...' : err.message;
    console.log(`\r  ${WARN} ${label} ${c.yellow}skipped${c.reset} ${c.dim}\u2014 ${msg}${c.reset} ${elapsed(t)}`);
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
    // IA_VC = virtual (Fabric port), IA_C = dedicated physical port
    const res = await apiGet('/internetAccess/v2/ibxs?service.connection.type=IA_VC&limit=200');
    return res.data ?? res;
  } catch {
    return [];
  }
}

// ── Fetch Pricing ────────────────────────────────────────────────────────────

async function fetchFabricPortPricing(referenceIbx) {
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
  let ok = 0;
  let fail = 0;
  const failures = [];

  for (let i = 0; i < combos.length; i++) {
    const { label, mbps, portProduct } = combos[i];
    const key = `${label}_${portProduct}`;
    process.stdout.write(`\r${progressBar(i + 1, total)} ${c.dim}${key}${c.reset}       `);
    try {
      const res = await apiPost('/fabric/v4/prices/search', priceFilter({
        '/type': 'VIRTUAL_PORT_PRODUCT',
        '/port/location/ibx': referenceIbx,
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
      ok++;
    } catch (err) {
      fail++;
      failures.push({ key, reason: err.message || 'Unknown error' });
    }
  }
  process.stdout.write('\r' + ' '.repeat(70) + '\r');
  const status = fail ? `${c.green}${ok} ok${c.reset}, ${c.red}${fail} failed${c.reset}` : `${c.green}${ok} prices${c.reset}`;
  if (fail) {
    console.log(`  ${CHECK} Fabric Ports \u2014 ${status}`);
    for (const f of failures) {
      console.log(`    ${CROSS} ${c.dim}${f.key}:${c.reset} ${c.red}${f.reason}${c.reset}`);
    }
  } else {
    console.log(`  ${CHECK} Fabric Ports \u2014 ${status}`);
  }
  return pricing;
}

async function fetchVCPricing(referenceMetro) {
  const bandwidths = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 50000];
  const total = bandwidths.length;
  const pricing = {};
  let ok = 0;
  let fail = 0;
  const failures = [];

  for (let i = 0; i < bandwidths.length; i++) {
    const bw = bandwidths[i];
    const label = bw >= 1000 ? `${bw / 1000}G` : `${bw}M`;
    process.stdout.write(`\r${progressBar(i + 1, total)} ${c.dim}${label}${c.reset}       `);
    try {
      const res = await apiPost('/fabric/v4/prices/search', priceFilter({
        '/type': 'VIRTUAL_CONNECTION_PRODUCT',
        '/connection/type': 'EVPL_VC',
        '/connection/bandwidth': bw,
        '/connection/aSide/accessPoint/type': 'COLO',
        '/connection/aSide/accessPoint/location/metroCode': referenceMetro,
        '/connection/aSide/accessPoint/port/settings/buyout': false,
        '/connection/zSide/accessPoint/type': 'COLO',
        '/connection/zSide/accessPoint/location/metroCode': referenceMetro,
      }));
      const charges = res.data?.[0]?.charges ?? [];
      const mrc = charges.find((ch) => ch.type === 'MONTHLY_RECURRING')?.price ?? 0;
      const nrc = charges.find((ch) => ch.type === 'NON_RECURRING')?.price ?? 0;
      pricing[String(bw)] = { mrc, nrc };
      ok++;
    } catch (err) {
      fail++;
      failures.push({ key: label, reason: err.message || 'Unknown error' });
    }
  }
  process.stdout.write('\r' + ' '.repeat(70) + '\r');
  const status = fail ? `${c.green}${ok} ok${c.reset}, ${c.red}${fail} failed${c.reset}` : `${c.green}${ok} prices${c.reset}`;
  console.log(`  ${CHECK} Virtual Connections \u2014 ${status}`);
  if (fail) {
    for (const f of failures) {
      console.log(`    ${CROSS} ${c.dim}${f.key}:${c.reset} ${c.red}${f.reason}${c.reset}`);
    }
  }
  return pricing;
}

async function fetchCloudRouterPricing(routerPackages, referenceMetro) {
  const total = routerPackages.length;
  const pricing = {};
  let ok = 0;
  let fail = 0;
  const failures = [];

  for (let i = 0; i < routerPackages.length; i++) {
    const pkg = routerPackages[i];
    process.stdout.write(`\r${progressBar(i + 1, total)} ${c.dim}${pkg.code}${c.reset}       `);
    try {
      const res = await apiPost('/fabric/v4/prices/search', priceFilter({
        '/type': 'CLOUD_ROUTER_PRODUCT',
        '/router/package/code': pkg.code,
        '/router/location/metroCode': referenceMetro,
      }));
      const charges = res.data?.[0]?.charges ?? [];
      const mrc = charges.find((ch) => ch.type === 'MONTHLY_RECURRING')?.price ?? 0;
      const nrc = charges.find((ch) => ch.type === 'NON_RECURRING')?.price ?? 0;
      pricing[pkg.code] = { mrc, nrc };
      ok++;
    } catch (err) {
      fail++;
      failures.push({ key: pkg.code, reason: err.message || 'Unknown error' });
    }
  }
  process.stdout.write('\r' + ' '.repeat(70) + '\r');
  const status = fail ? `${c.green}${ok} ok${c.reset}, ${c.red}${fail} failed${c.reset}` : `${c.green}${ok} prices${c.reset}`;
  console.log(`  ${CHECK} Cloud Router \u2014 ${status}`);
  if (fail) {
    for (const f of failures) {
      console.log(`    ${CROSS} ${c.dim}${f.key}:${c.reset} ${c.red}${f.reason}${c.reset}`);
    }
  }
  return pricing;
}

async function fetchNetworkEdgePricing(deviceTypes, referenceMetro) {
  const termLengths = [1, 12, 24, 36];
  const pricing = {};
  let ok = 0;
  let fail = 0;
  const failures = [];

  // Extract the smallest core count for a device type.
  // Core counts live in deviceManagementTypes → SELF-CONFIGURED/EQUINIX-CONFIGURED
  //   → licenseOptions → SUB/BYOL → cores[] → core
  function getSmallestCore(dt) {
    for (const mgmt of Object.values(dt.deviceManagementTypes ?? {})) {
      for (const lic of Object.values(mgmt?.licenseOptions ?? {})) {
        const cores = (lic?.cores ?? []).map((c) => c.core).filter(Boolean).sort((a, b) => a - b);
        if (cores.length) return cores[0];
      }
    }
    // Fall back to coreCounts array if present
    if (dt.coreCounts?.length) return Math.min(...dt.coreCounts);
    return 2; // sensible default
  }

  // Extract the first available license type from deviceManagementTypes
  function getDefaultLicenseType(dt) {
    for (const mgmt of Object.values(dt.deviceManagementTypes ?? {})) {
      const keys = Object.keys(mgmt?.licenseOptions ?? {});
      if (keys.length) return keys[0]; // e.g. "SUB" or "BYOL"
    }
    return undefined;
  }

  // Build flat list of all combinations
  const combos = [];
  for (const dt of deviceTypes) {
    const core = getSmallestCore(dt);
    const licenseType = getDefaultLicenseType(dt);
    for (const pkg of (dt.softwarePackages ?? [])) {
      for (const term of termLengths) {
        combos.push({ dt, pkg, term, core, licenseType });
      }
    }
  }
  const total = combos.length;

  if (total === 0) {
    console.log(`  ${c.dim}  Network Edge \u2014 no device types to price${c.reset}`);
    return pricing;
  }

  let completed = 0;

  // Process in concurrent batches for speed
  for (let i = 0; i < combos.length; i += CONCURRENCY) {
    const batch = combos.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async ({ dt, pkg, term, core, licenseType }) => {
        const key = `${dt.deviceTypeCode}_${pkg.code}_${term}`;
        const params = {
          vendorPackage: dt.deviceTypeCode,
          softwarePackage: pkg.code,
          termLength: String(term),
          metro: referenceMetro,
          core: String(core),
        };
        if (licenseType) params.licenseType = licenseType;
        const qs = new URLSearchParams(params);
        const res = await apiGet(`/ne/v1/prices?${qs}`);
        const charges = res.primary?.charges ?? [];
        const deviceCharge = charges.find((ch) => ch.description === 'VIRTUAL_DEVICE');
        const licenseCharge = charges.find((ch) => ch.description === 'DEVICE_LICENSE');
        const mrc = Number(deviceCharge?.monthlyRecurringCharges ?? 0) +
                    Number(licenseCharge?.monthlyRecurringCharges ?? 0);
        return { key, mrc };
      })
    );

    for (let j = 0; j < results.length; j++) {
      completed++;
      const combo = batch[j];
      const key = `${combo.dt.deviceTypeCode}_${combo.pkg.code}_${combo.term}`;
      const result = results[j];
      if (result.status === 'fulfilled') {
        pricing[result.value.key] = { mrc: result.value.mrc, nrc: 0 };
        ok++;
      } else {
        fail++;
        failures.push({ key, reason: result.reason?.message || 'Unknown error' });
      }
    }
    process.stdout.write(`\r${progressBar(completed, total)} ${c.dim}${batch[batch.length - 1].dt.deviceTypeCode}${c.reset}       `);
  }

  process.stdout.write('\r' + ' '.repeat(80) + '\r');
  const status = fail ? `${c.green}${ok} ok${c.reset}, ${c.red}${fail} failed${c.reset}` : `${c.green}${ok} prices${c.reset}`;
  console.log(`  ${CHECK} Network Edge \u2014 ${status}`);
  if (fail) {
    // Group NE failures by reason to avoid flooding the console
    const byReason = new Map();
    for (const f of failures) {
      const existing = byReason.get(f.reason) ?? [];
      existing.push(f.key);
      byReason.set(f.reason, existing);
    }
    for (const [reason, keys] of byReason) {
      if (keys.length <= 3) {
        console.log(`    ${CROSS} ${c.dim}${keys.join(', ')}:${c.reset} ${c.red}${reason}${c.reset}`);
      } else {
        console.log(`    ${CROSS} ${c.dim}${keys.length} combos:${c.reset} ${c.red}${reason}${c.reset}`);
      }
    }
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

  // ── Phase 2: Options ───────────────────────────────────────────────────────
  console.log(`${c.bold}${c.cyan}[2/4]${c.reset}${c.bold} Fetching catalog data${c.reset}`);
  const metros = await fetchWithStatus('Metros', fetchMetros);
  if (metros.length === 0) {
    console.log(`\n  ${CROSS} ${c.red}No metros returned — cannot continue without metro data.${c.reset}\n`);
    process.exit(1);
  }
  const deviceTypes = await fetchWithStatus('Network Edge device types', fetchDeviceTypes);
  const serviceProfiles = await fetchWithStatus('Fabric service profiles', fetchServiceProfiles);
  const routerPackages = await fetchWithStatus('Cloud Router packages', fetchRouterPackages);
  const eiaLocations = await fetchWithStatus('Internet Access locations', fetchEIALocations);
  console.log('');

  // ── Phase 3: Pricing ───────────────────────────────────────────────────────
  const referenceMetro = 'DC';
  // Pick first IBX in the reference metro from EIA locations, or fall back to a well-known one
  const referenceIbx = eiaLocations.find((loc) => loc.metroCode === referenceMetro)?.ibx ?? 'DC6';
  console.log(`${c.bold}${c.cyan}[3/4]${c.reset}${c.bold} Fetching pricing${c.reset} ${c.dim}(reference metro: ${referenceMetro}, IBX: ${referenceIbx})${c.reset}`);

  let fabricPortPricing = {};
  let vcPricing = {};
  let cloudRouterPricing = {};
  let nePricing = {};

  try { fabricPortPricing = await fetchFabricPortPricing(referenceIbx); } catch (err) {
    console.log(`  ${WARN} Fabric Port pricing ${c.yellow}skipped${c.reset} ${c.dim}\u2014 ${err.message}${c.reset}`);
  }
  try { vcPricing = await fetchVCPricing(referenceMetro); } catch (err) {
    console.log(`  ${WARN} VC pricing ${c.yellow}skipped${c.reset} ${c.dim}\u2014 ${err.message}${c.reset}`);
  }
  try { cloudRouterPricing = await fetchCloudRouterPricing(routerPackages, referenceMetro); } catch (err) {
    console.log(`  ${WARN} Cloud Router pricing ${c.yellow}skipped${c.reset} ${c.dim}\u2014 ${err.message}${c.reset}`);
  }
  try { nePricing = await fetchNetworkEdgePricing(deviceTypes, referenceMetro); } catch (err) {
    console.log(`  ${WARN} Network Edge pricing ${c.yellow}skipped${c.reset} ${c.dim}\u2014 ${err.message}${c.reset}`);
  }
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
      fabricPorts: fabricPortPricing,
      virtualConnections: vcPricing,
      cloudRouter: cloudRouterPricing,
      networkEdge: nePricing,
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
  const totalPrices = Object.keys(fabricPortPricing).length +
    Object.keys(vcPricing).length +
    Object.keys(cloudRouterPricing).length +
    Object.keys(nePricing).length;

  console.log(`${c.bold}  \u2500\u2500\u2500 Summary \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500${c.reset}`);
  console.log('');
  console.log(`  ${c.dim}Catalog${c.reset}    Metros ${c.bold}${metros.length}${c.reset}  \u2502  Devices ${c.bold}${deviceTypes.length}${c.reset}  \u2502  Profiles ${c.bold}${serviceProfiles.length}${c.reset}`);
  console.log(`             Packages ${c.bold}${routerPackages.length}${c.reset}  \u2502  EIA Locations ${c.bold}${eiaLocations.length}${c.reset}`);
  console.log('');
  console.log(`  ${c.dim}Pricing${c.reset}    Ports ${c.bold}${Object.keys(fabricPortPricing).length}${c.reset}  \u2502  VCs ${c.bold}${Object.keys(vcPricing).length}${c.reset}  \u2502  FCR ${c.bold}${Object.keys(cloudRouterPricing).length}${c.reset}  \u2502  NE ${c.bold}${Object.keys(nePricing).length}${c.reset}`);
  console.log('');
  console.log(`  ${c.dim}Total${c.reset}      ${c.bold}${totalPrices}${c.reset} prices  \u2502  ${c.bold}${apiCalls}${c.reset} API calls  \u2502  ${c.bold}${totalElapsed}s${c.reset}`);
  console.log('');
  console.log(`  ${c.green}${c.bold}\u2714 Done!${c.reset} Commit ${c.bold}public/data/defaults.json${c.reset} and rebuild to deploy.`);
  console.log('');
}

main().catch((err) => {
  console.error(`\n  ${CROSS} ${c.red}${c.bold}Fatal error:${c.reset} ${err.message}\n`);
  process.exit(1);
});
