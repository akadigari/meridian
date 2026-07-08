// Server-side data access: loads the API snapshot + curated overlay,
// runs the scoring engine, memoizes per process.
import fs from 'node:fs';
import path from 'node:path';
import { scoreCountry } from './scoring';
import type { QuantData, CuratedOverlay, ScoredCountry } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');

export interface Snapshot {
  generatedAt: string;
  sources: Record<string, { name: string; url: string; note?: string; asOf?: string } | null>;
  countries: Record<string, QuantData>;
}

export interface CuratedFile {
  asOf: string;
  note: string;
  bondsAccessNote?: string;
  countries: Record<string, CuratedOverlay>;
}

function readJSON<T>(file: string): T | null {
  const full = path.join(DATA_DIR, file);
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8')) as T;
  } catch (e) {
    // Missing file is a legitimate state (no curated overlay / no analysis yet)
    // - but a CORRUPT file must be loud, or a bad edit silently un-curates
    // every country.
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error(`data: ${full} exists but failed to parse - treating as missing:`, e);
    }
    return null;
  }
}

// Caches are keyed on file mtime so `npm run fetch-data`, curated edits, and
// analyst regeneration show up without a server restart.
const _cache = new Map<string, { mtime: number; value: unknown }>();
function cachedJSON<T>(file: string): T | null {
  const full = path.join(DATA_DIR, file);
  let mtime = -1;
  try {
    mtime = fs.statSync(full).mtimeMs;
  } catch {
    /* missing */
  }
  const hit = _cache.get(file);
  if (hit && hit.mtime === mtime) return hit.value as T | null;
  const value = mtime === -1 ? null : readJSON<T>(file);
  _cache.set(file, { mtime, value });
  return value;
}

export function getSnapshot(): Snapshot {
  const snap = cachedJSON<Snapshot>('snapshot.json');
  if (!snap) throw new Error('data/snapshot.json missing - run `npm run fetch-data`');
  return snap;
}

export function getCurated(): CuratedFile | null {
  return cachedJSON<CuratedFile>('curated.json');
}

export function getAnalysis(): Record<string, unknown> | null {
  return cachedJSON<Record<string, unknown>>('analysis.json');
}

export interface PricesFile {
  generatedAt: string;
  source: string;
  note: string;
  tickers: Record<string, {
    iso3: string; firstMonth: string; lastMonth: string;
    last: number; high5y: number; pctBelowHigh: number;
    months: Record<string, number>;
  }>;
}

export function getPrices(): PricesFile | null {
  return cachedJSON<PricesFile>('prices.json');
}

/** Depth gauge for one ETF ticker: % below its 5y high, or null. */
export function getDepth(ticker: string | null | undefined): { pctBelowHigh: number; asOf: string } | null {
  if (!ticker) return null;
  const t = getPrices()?.tickers?.[ticker];
  return t ? { pctBelowHigh: t.pctBelowHigh, asOf: t.lastMonth } : null;
}

export interface BacktestFile {
  generatedAt: string;
  method: string;
  caveats: string[];
  universe: string[];
  sensitivity: { minMomentum: number; n: number; hitRate?: number; avgExcessPct?: number; medianExcessPct?: number; avgRawPct?: number }[];
  events: {
    iso3: string; country: string; ticker: string; year: number; momentum: number;
    distress: string; window: string; fwdReturnPct: number; benchReturnPct: number; excessPct: number;
  }[];
}

export function getBacktest(): BacktestFile | null {
  return cachedJSON<BacktestFile>('backtest.json');
}

/** Anchor year for "now": year of the snapshot (IMF WEO includes estimates for it). */
export function nowYear(): number {
  return Number(getSnapshot().generatedAt.slice(0, 4));
}

export function getScoredCountries(): ScoredCountry[] {
  // Recomputed per call (~197 countries, sub-millisecond) - always consistent
  // with whatever snapshot/curated files are on disk right now.
  const snap = getSnapshot();
  const curated = getCurated();
  const year = nowYear();
  const out: ScoredCountry[] = [];
  for (const q of Object.values(snap.countries)) {
    const cur = curated?.countries?.[q.iso3];
    out.push(scoreCountry(q, cur, year));
  }
  out.sort((a, b) => (b.composite ?? -1) - (a.composite ?? -1));
  return out;
}

export function getCountry(iso3: string): {
  scored: ScoredCountry;
  quant: QuantData;
  curated: CuratedOverlay | null;
} | null {
  const snap = getSnapshot();
  const q = snap.countries[iso3.toUpperCase()];
  if (!q) return null;
  const cur = getCurated()?.countries?.[q.iso3] ?? null;
  return { scored: scoreCountry(q, cur ?? undefined, nowYear()), quant: q, curated: cur };
}
