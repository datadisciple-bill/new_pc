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
 *   EQUINIX_CLIENT_ID=xxx EQUINIX_CLIENT_SECRET=xxx npm run fetch-data
 *
 * Output: public/data/defaults.json
 *
 * Run this periodically (e.g. daily via cron or CI) to keep the default
 * dataset current. The output file ships as a static asset and the app
 * loads it at startup — no end-user authentication required.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'public', 'data');
const OUTPUT_FILE = join(OUTPUT_DIR, 'defaults.json');

const API_BASE = 'https://api.equinix.com';
const MAX_RETRIES = 3;
const RATE_LIMIT_MS = 200; // 5 requests/sec

// ── Helpers ──────────────────────────────────────────────────────────────────

let token = '';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiGet(path) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await sleep(RATE_LIMIT_MS);
      const res = await fetch(`${API_BASE}${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.status === 429) {
        const wait = 2000 * Math.pow(2, attempt);
        console.warn(`  Rate limited on GET ${path}, waiting ${wait}ms...`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`GET ${path} -> ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      console.warn(`  Retry ${attempt + 1}/${MAX_RETRIES} for GET ${path}: ${err.message}`);
      await sleep(2000 * Math.pow(2, attempt));
    }
  }
}

async function apiPost(path, body) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await sleep(RATE_LIMIT_MS);
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
        console.warn(`  Rate limited on POST ${path}, waiting ${wait}ms...`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`POST ${path} -> ${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      console.warn(`  Retry ${attempt + 1}/${MAX_RETRIES} for POST ${path}: ${err.message}`);
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
      'Error: Set EQUINIX_CLIENT_ID and EQUINIX_CLIENT_SECRET environment variables.\n\n' +
        '  EQUINIX_CLIENT_ID=xxx EQUINIX_CLIENT_SECRET=xxx npm run fetch-data\n'
    );
    process.exit(1);
  }

  console.log('Authenticating with Equinix API...');
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
    console.error(`Authentication failed: ${res.status} ${res.statusText}\n${body}`);
    process.exit(1);
  }

  const data = await res.json();
  token = data.access_token;
  console.log(`  Authenticated as ${data.user_name}\n`);
}

// ── Fetch Options ────────────────────────────────────────────────────────────

async function fetchMetros() {
  console.log('Fetching metros...');
  const res = await apiGet('/fabric/v4/metros?limit=200');
  const metros = res.data ?? res;
  console.log(`  ${metros.length} metros found`);
  return metros;
}

async function fetchDeviceTypes() {
  console.log('Fetching Network Edge device types...');
  const res = await apiGet('/ne/v1/devices/types');
  const types = Array.isArray(res) ? res : res.data ?? [];
  console.log(`  ${types.length} device types found`);
  return types;
}

async function fetchServiceProfiles() {
  console.log('Fetching Fabric service profiles...');
  const res = await apiGet('/fabric/v4/serviceProfiles?limit=200&viewPoint=zSide');
  const profiles = res.data ?? res;
  console.log(`  ${profiles.length} service profiles found`);
  return profiles;
}

async function fetchRouterPackages() {
  console.log('Fetching Cloud Router packages...');
  const res = await apiGet('/fabric/v4/routerPackages');
  const packages = res.data ?? res;
  console.log(`  ${packages.length} router packages found`);
  return packages;
}

async function fetchEIALocations() {
  console.log('Fetching Internet Access locations...');
  try {
    const res = await apiGet('/internetAccess/v2/ibxs');
    const locations = res.data ?? res;
    console.log(`  ${locations.length} EIA locations found`);
    return locations;
  } catch (err) {
    console.warn(`  EIA fetch failed (${err.message}), using empty list`);
    return [];
  }
}

// ── Fetch Pricing ────────────────────────────────────────────────────────────

async function fetchFabricPortPricing() {
  console.log('\nFetching Fabric Port pricing...');
  const speeds = ['1G', '10G', '25G', '50G', '100G'];
  const types = ['SINGLE', 'REDUNDANT'];
  const pricing = {};

  for (const speed of speeds) {
    for (const portType of types) {
      const key = `${speed}_${portType}`;
      try {
        const res = await apiPost('/fabric/v4/prices/search', {
          filter: {
            '/type': 'VIRTUAL_PORT_PRODUCT',
            '/port/bandwidth': speed,
            '/port/type': portType,
            '/port/settings/buyout': false,
          },
        });
        const charges = res.data?.[0]?.charges ?? [];
        const mrc = charges.find((c) => c.type === 'MONTHLY_RECURRING')?.price ?? 0;
        const nrc = charges.find((c) => c.type === 'NON_RECURRING')?.price ?? 0;
        pricing[key] = { mrc, nrc };
        console.log(`  ${key}: $${mrc}/mo`);
      } catch (err) {
        console.warn(`  ${key}: FAILED (${err.message})`);
      }
    }
  }
  return pricing;
}

async function fetchVCPricing() {
  console.log('\nFetching Virtual Connection pricing...');
  const bandwidths = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 50000];
  const pricing = {};

  for (const bw of bandwidths) {
    try {
      const res = await apiPost('/fabric/v4/prices/search', {
        filter: {
          '/type': 'VIRTUAL_CONNECTION_PRODUCT',
          '/connection/bandwidth': bw,
        },
      });
      const charges = res.data?.[0]?.charges ?? [];
      const mrc = charges.find((c) => c.type === 'MONTHLY_RECURRING')?.price ?? 0;
      const nrc = charges.find((c) => c.type === 'NON_RECURRING')?.price ?? 0;
      pricing[String(bw)] = { mrc, nrc };
      const label = bw >= 1000 ? `${bw / 1000} Gbps` : `${bw} Mbps`;
      console.log(`  ${label}: $${mrc}/mo`);
    } catch (err) {
      console.warn(`  ${bw}Mbps: FAILED (${err.message})`);
    }
  }
  return pricing;
}

async function fetchCloudRouterPricing(routerPackages, referenceMetro) {
  console.log('\nFetching Cloud Router pricing...');
  const pricing = {};

  for (const pkg of routerPackages) {
    try {
      const res = await apiPost('/fabric/v4/prices/search', {
        filter: {
          '/type': 'CLOUD_ROUTER_PRODUCT',
          '/router/package/code': pkg.code,
          '/router/location/metroCode': referenceMetro,
        },
      });
      const charges = res.data?.[0]?.charges ?? [];
      const mrc = charges.find((c) => c.type === 'MONTHLY_RECURRING')?.price ?? 0;
      const nrc = charges.find((c) => c.type === 'NON_RECURRING')?.price ?? 0;
      pricing[pkg.code] = { mrc, nrc };
      console.log(`  ${pkg.code}: $${mrc}/mo`);
    } catch (err) {
      console.warn(`  ${pkg.code}: FAILED (${err.message})`);
    }
  }
  return pricing;
}

async function fetchNetworkEdgePricing(deviceTypes, referenceMetro) {
  console.log('\nFetching Network Edge pricing...');
  const termLengths = [1, 12, 24, 36];
  const pricing = {};
  let count = 0;
  const total = deviceTypes.reduce(
    (sum, dt) => sum + dt.softwarePackages.length * termLengths.length,
    0
  );

  for (const dt of deviceTypes) {
    for (const pkg of dt.softwarePackages) {
      for (const term of termLengths) {
        count++;
        const key = `${dt.deviceTypeCode}_${pkg.code}_${term}`;
        try {
          const qs = new URLSearchParams({
            deviceTypeCode: dt.deviceTypeCode,
            packageCode: pkg.code,
            termLength: String(term),
            metroCode: referenceMetro,
          });
          const res = await apiGet(`/ne/v1/prices?${qs}`);
          pricing[key] = {
            mrc: res.monthlyRecurring ?? 0,
            nrc: res.nonRecurring ?? 0,
          };
        } catch (err) {
          console.warn(`  ${key}: FAILED (${err.message})`);
        }
        if (count % 10 === 0 || count === total) {
          process.stdout.write(`  ${count}/${total} NE prices fetched\r`);
        }
      }
    }
  }
  console.log(`  ${Object.keys(pricing).length}/${total} NE prices fetched successfully`);
  return pricing;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  await authenticate();

  // Fetch all options (sequential to respect rate limits)
  const metros = await fetchMetros();
  const deviceTypes = await fetchDeviceTypes();
  const serviceProfiles = await fetchServiceProfiles();
  const routerPackages = await fetchRouterPackages();
  const eiaLocations = await fetchEIALocations();

  // Use first AMER metro as reference for pricing
  const referenceMetro = metros.find((m) => m.region === 'AMER')?.code ?? 'DC';
  console.log(`\nUsing ${referenceMetro} as reference metro for pricing`);

  // Fetch all pricing
  const fabricPortPricing = await fetchFabricPortPricing();
  const vcPricing = await fetchVCPricing();
  const cloudRouterPricing = await fetchCloudRouterPricing(routerPackages, referenceMetro);
  const nePricing = await fetchNetworkEdgePricing(deviceTypes, referenceMetro);

  // Build output
  const defaults = {
    fetchedAt: new Date().toISOString(),
    referenceMetro,
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

  // Write to file
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(defaults, null, 2));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Done in ${elapsed}s. Wrote ${OUTPUT_FILE}\n`);
  console.log(`  Metros:           ${metros.length}`);
  console.log(`  Device types:     ${deviceTypes.length}`);
  console.log(`  Service profiles: ${serviceProfiles.length}`);
  console.log(`  Router packages:  ${routerPackages.length}`);
  console.log(`  EIA locations:    ${eiaLocations.length}`);
  console.log(`  Port prices:      ${Object.keys(fabricPortPricing).length}`);
  console.log(`  VC prices:        ${Object.keys(vcPricing).length}`);
  console.log(`  FCR prices:       ${Object.keys(cloudRouterPricing).length}`);
  console.log(`  NE prices:        ${Object.keys(nePricing).length}`);
  console.log(
    `\nCommit public/data/defaults.json and rebuild to deploy updated data.`
  );
}

main().catch((err) => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
