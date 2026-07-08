#!/usr/bin/env node
/**
 * Meridian data fetcher - pulls the free-API snapshot the dashboard runs on.
 *
 *   IMF WEO DataMapper (no key):  inflation, fiscal balance, growth,
 *                                 current account, gross debt - ALL countries,
 *                                 annual, includes IMF estimates for the
 *                                 current year and beyond.
 *   World Bank API (no key):      reserves (months of imports), official
 *                                 exchange rate (LCU/USD, annual average).
 *   open.er-api.com (no key):     spot FX snapshot (LCU per USD).
 *   FRED (optional key):          US 10Y yield + US CPI, context only.
 *
 * Writes data/snapshot.json with per-source "as of" stamps.
 * Run: npm run fetch-data
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'snapshot.json');

const IMF_SERIES = {
  inflation: 'PCPIPCH',       // CPI inflation, period average, %
  fiscal: 'GGXCNL_NGDP',      // General govt net lending/borrowing, % GDP
  growth: 'NGDP_RPCH',        // Real GDP growth, %
  currentAccount: 'BCA_NGDPD',// Current account, % GDP
  debt: 'GGXWDG_NGDP',        // General govt gross debt, % GDP
};

// IMF DataMapper includes aggregates (regions, income groups) - filter to ISO3.
const NON_COUNTRY = new Set([
  'WEOWORLD', 'ADVEC', 'EMDE', 'AZQ', 'EAQ', 'EUQ', 'MEQ', 'SSQ', 'WEQ', 'CAQ',
  'SAQ', 'SEQ', 'EU', 'G7', 'G20', 'ASEAN5', 'OEMDC', 'MAE', 'LAC', 'MECA', 'SSA',
  'EURO', 'NMQ', 'AFQ', 'APQ', 'BLA', 'CIS', 'DA', 'EDA', 'EDE', 'EE', 'LDC', 'OADVEC',
]);

async function getJSON(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'meridian-dashboard/0.1' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
}

async function fetchIMF() {
  const out = {}; // iso3 -> { seriesKey -> { year: value } }
  for (const [key, code] of Object.entries(IMF_SERIES)) {
    process.stdout.write(`IMF ${code} (${key}) ... `);
    const data = await getJSON(`https://www.imf.org/external/datamapper/api/v1/${code}`);
    const values = data?.values?.[code] ?? {};
    let n = 0;
    for (const [iso3, series] of Object.entries(values)) {
      if (iso3.length !== 3 || NON_COUNTRY.has(iso3)) continue;
      out[iso3] ??= {};
      out[iso3][key] = series;
      n++;
    }
    console.log(`${n} countries`);
    if (n < 100) throw new Error(`IMF ${code}: only ${n} countries - refusing to write a gutted snapshot`);
  }
  return out;
}

async function fetchIMFCountryNames() {
  const data = await getJSON('https://www.imf.org/external/datamapper/api/v1/countries');
  const names = {};
  for (const [iso3, obj] of Object.entries(data?.countries ?? {})) {
    if (obj?.label) names[iso3] = obj.label;
  }
  return names;
}

async function fetchWorldBank(indicator, label) {
  process.stdout.write(`World Bank ${indicator} (${label}) ... `);
  const out = {};
  const endYear = new Date().getFullYear();
  let page = 1, pages = 1;
  do {
    const data = await getJSON(
      `https://api.worldbank.org/v2/country/all/indicator/${indicator}?format=json&per_page=2000&date=2015:${endYear}&page=${page}`,
    );
    // WB errors come back as [{message: [...]}] with HTTP 200 - validate shape.
    if (!Array.isArray(data) || typeof data[0]?.pages !== 'number') {
      throw new Error(`World Bank ${indicator}: unexpected response shape: ${JSON.stringify(data).slice(0, 200)}`);
    }
    const [meta, rows] = data;
    pages = meta.pages;
    for (const row of rows ?? []) {
      const iso3 = row.countryiso3code;
      if (!iso3 || iso3.length !== 3 || row.value == null) continue;
      out[iso3] ??= {};
      out[iso3][row.date] = row.value;
    }
    page++;
  } while (page <= pages);
  const n = Object.keys(out).length;
  console.log(`${n} countries`);
  if (n === 0) throw new Error(`World Bank ${indicator}: zero rows - refusing to write a gutted snapshot`);
  return out;
}

async function fetchSpotFX() {
  process.stdout.write('open.er-api.com USD spot rates ... ');
  const data = await getJSON('https://open.er-api.com/v6/latest/USD');
  if (data?.result !== 'success' || !data?.rates) throw new Error(`open.er-api: ${JSON.stringify(data).slice(0, 120)}`);
  console.log(`${Object.keys(data.rates).length} currencies, updated ${data.time_last_update_utc}`);
  return { rates: data?.rates ?? {}, asOf: data?.time_last_update_utc ?? null };
}

async function fetchFRED() {
  const key = process.env.FRED_API_KEY;
  if (!key) {
    console.log('FRED: no FRED_API_KEY set - skipping US context series (optional).');
    return null;
  }
  const series = { us10y: 'DGS10', usCpiYoY: 'CPIAUCSL' };
  const out = {};
  for (const [k, id] of Object.entries(series)) {
    const data = await getJSON(
      `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${key}&file_type=json&sort_order=desc&limit=13`,
    );
    out[k] = data?.observations ?? [];
  }
  console.log('FRED: fetched US context series.');
  return out;
}

// World Bank countries endpoint → iso3 -> currency code guess is not provided;
// map spot FX by currency using a static iso3->currency table for the majors we
// care about (used only for display, never for scoring).
const ISO3_CURRENCY = {
  ARG: 'ARS', TUR: 'TRY', NGA: 'NGN', EGY: 'EGP', ECU: 'USD', GHA: 'GHS',
  ZMB: 'ZMW', LKA: 'LKR', PAK: 'PKR', ETH: 'ETB', KEN: 'KES', UKR: 'UAH',
  BRA: 'BRL', MEX: 'MXN', IND: 'INR', IDN: 'IDR', ZAF: 'ZAR', VNM: 'VND',
  COL: 'COP', PER: 'PEN', CHL: 'CLP', POL: 'PLN', HUN: 'HUF', ROU: 'RON',
  PHL: 'PHP', THA: 'THB', MYS: 'MYR', BGD: 'BDT', VEN: 'VES', BOL: 'BOB',
};

async function main() {
  console.log(' -  Meridian data fetch - ');
  const [imf, names, reserves, fxOfficial, spot, fred] = await Promise.all([
    fetchIMF(),
    fetchIMFCountryNames(),
    fetchWorldBank('FI.RES.TOTL.MO', 'reserves, months of imports'),
    fetchWorldBank('PA.NUS.FCRF', 'official FX rate, LCU/USD'),
    fetchSpotFX(),
    fetchFRED().catch((e) => (console.log('FRED failed:', e.message), null)),
  ]);

  // IMF and World Bank disagree on a few codes - map IMF's to WB's.
  const WB_ALIAS = { UVK: 'XKX', WBG: 'PSE' };
  const nowY = new Date().getFullYear();

  const countries = {};
  for (const [iso3, series] of Object.entries(imf)) {
    const name = names[iso3];
    if (!name) continue; // aggregates without a country label
    const wbCode = WB_ALIAS[iso3] ?? iso3;
    const resSeries = reserves[wbCode];
    let reservesMonths;
    if (resSeries) {
      // Ignore observations more than ~3y old - the scorer refuses stale data,
      // so don't bother shipping it as "latest".
      const years = Object.keys(resSeries)
        .filter((y) => Number(y) >= nowY - 3)
        .sort((a, b) => Number(b) - Number(a));
      if (years.length) reservesMonths = { value: resSeries[years[0]], year: years[0] };
    }
    countries[iso3] = {
      iso3,
      name,
      ...series,
      currentAccount: series.currentAccount,
      reservesMonths,
      fxOfficial: fxOfficial[wbCode],
      fxSpot: ISO3_CURRENCY[iso3] ? spot.rates[ISO3_CURRENCY[iso3]] ?? null : null,
    };
  }

  if (Object.keys(countries).length < 150) {
    throw new Error(`sanity: only ${Object.keys(countries).length} countries assembled - refusing to overwrite snapshot.json`);
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    sources: {
      imf: { name: 'IMF World Economic Outlook (DataMapper API)', url: 'https://www.imf.org/external/datamapper/api/', note: 'Annual; current/forward years are IMF staff estimates.' },
      worldBank: { name: 'World Bank Open Data API', url: 'https://api.worldbank.org/', note: 'Annual; typically 1–2 year publication lag.' },
      fx: { name: 'open.er-api.com', url: 'https://open.er-api.com/', asOf: spot.asOf },
      fred: fred ? { name: 'FRED (St. Louis Fed)', url: 'https://fred.stlouisfed.org/' } : null,
    },
    usContext: fred,
    countries,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  // Atomic write: never leave a truncated snapshot.json for the app to choke on.
  fs.writeFileSync(OUT + '.tmp', JSON.stringify(snapshot));
  fs.renameSync(OUT + '.tmp', OUT);
  console.log(`\nWrote ${OUT} - ${Object.keys(countries).length} countries, ${(fs.statSync(OUT).size / 1024 / 1024).toFixed(1)} MB`);
}

main().catch((e) => { console.error(e); process.exit(1); });
