#!/usr/bin/env node
/**
 * Hindsight event study: does the screen's own "turnaround" signal precede
 * ETF outperformance? All the math is here, in one file, unfitted.
 *
 * EVENT (same definitions the live app uses, applied to past years):
 *   for country c with a live US ETF, year Y is an event if
 *     1. distress at Y-2:  inflation(Y-2) >= 20%  OR  fiscal(Y-2) <= -5% GDP
 *        (identical to the app's TURNAROUND badge thresholds), and
 *     2. momentum: quantComposite(Y) - quantComposite(Y-2) >= threshold
 *        (reported at +8 / +12 / +16 so nobody can accuse us of picking one).
 *
 * TRADE: buy at end of April Y+1 (by then the WEO vintage covering Y is
 * published), hold 12 months, measure total return vs EEM over the window.
 *
 * WHY YOU SHOULD NOT TRUST THIS TOO MUCH (rendered verbatim in the UI):
 *   - Survivorship: liquidated ETFs (Egypt, Nigeria, Pakistan, frontier)
 *     have no price history. The failures are missing from the sample,
 *     which biases results IN FAVOR of the playbook.
 *   - Revised data: scores use today's IMF WEO vintage, not what was known
 *     at the time. Real-time data was noisier; this flatters the signal.
 *   - Tiny, overlapping sample: consecutive event-years in one country
 *     share most of their 12-month windows. n is small either way.
 *   - Nothing is fitted: thresholds were chosen for the live screen before
 *     this backtest was run, and are not tuned to improve these numbers.
 *
 * Run: npm run backtest   (needs data/snapshot.json + data/prices.json)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { quantComposite } from '../lib/scoring.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const snapshot = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'snapshot.json'), 'utf8'));
const prices = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'prices.json'), 'utf8'));

const DISTRESS = { inflation: 20, fiscal: -5 }; // = the app's TURNAROUND badge
const THRESHOLDS = [8, 12, 16];
const ENTRY_MONTH = '04'; // end of April Y+1

/** monthly close at YYYY-MM, tolerating ±2 months of missing data */
function closeAt(months, ym) {
  if (months[ym] != null) return months[ym];
  const [y, m] = ym.split('-').map(Number);
  for (const off of [1, -1, 2, -2]) {
    const d = new Date(Date.UTC(y, m - 1 + off, 1));
    const k = d.toISOString().slice(0, 7);
    if (months[k] != null) return months[k];
  }
  return null;
}

const bench = prices.tickers.EEM.months;
const events = [];

for (const [ticker, p] of Object.entries(prices.tickers)) {
  if (p.iso3 === '_BENCHMARK') continue;
  const q = snapshot.countries[p.iso3];
  if (!q) continue;
  const firstYear = Number(p.firstMonth.slice(0, 4));
  const lastFull = Number(p.lastMonth.slice(0, 4)) - 2; // need Y+1 entry and 12m hold

  for (let Y = firstYear + 1; Y <= lastFull; Y++) {
    const infThen = q.inflation?.[String(Y - 2)];
    const fisThen = q.fiscal?.[String(Y - 2)];
    const distressed =
      (infThen != null && infThen >= DISTRESS.inflation) ||
      (fisThen != null && fisThen <= DISTRESS.fiscal);
    if (!distressed) continue;

    const now = quantComposite(q, Y);
    const then = quantComposite(q, Y - 2);
    if (now == null || then == null) continue;
    const momentum = Math.round((now - then) * 10) / 10;
    if (momentum < Math.min(...THRESHOLDS)) continue;

    const entryYM = `${Y + 1}-${ENTRY_MONTH}`;
    const exitYM = `${Y + 2}-${ENTRY_MONTH}`;
    const e0 = closeAt(p.months, entryYM), e1 = closeAt(p.months, exitYM);
    const b0 = closeAt(bench, entryYM), b1 = closeAt(bench, exitYM);
    if (e0 == null || e1 == null || b0 == null || b1 == null) continue;

    const fwd = (e1 / e0 - 1) * 100;
    const benchFwd = (b1 / b0 - 1) * 100;
    events.push({
      iso3: p.iso3,
      country: q.name,
      ticker,
      year: Y,
      momentum,
      distress: `${infThen != null ? `inflation ${infThen.toFixed(0)}%` : ''}${infThen != null && fisThen != null ? ', ' : ''}${fisThen != null ? `fiscal ${fisThen.toFixed(1)}%` : ''} in ${Y - 2}`,
      window: `${entryYM} to ${exitYM}`,
      fwdReturnPct: Math.round(fwd * 10) / 10,
      benchReturnPct: Math.round(benchFwd * 10) / 10,
      excessPct: Math.round((fwd - benchFwd) * 10) / 10,
    });
  }
}

events.sort((a, b) => b.momentum - a.momentum);

function summarize(minMomentum) {
  const set = events.filter((e) => e.momentum >= minMomentum);
  const n = set.length;
  if (!n) return { minMomentum, n: 0 };
  const ex = set.map((e) => e.excessPct).sort((a, b) => a - b);
  const avg = ex.reduce((a, b) => a + b, 0) / n;
  const median = n % 2 ? ex[(n - 1) / 2] : (ex[n / 2 - 1] + ex[n / 2]) / 2;
  return {
    minMomentum,
    n,
    hitRate: Math.round((set.filter((e) => e.excessPct > 0).length / n) * 100),
    avgExcessPct: Math.round(avg * 10) / 10,
    medianExcessPct: Math.round(median * 10) / 10,
    avgRawPct: Math.round((set.reduce((a, b) => a + b.fwdReturnPct, 0) / n) * 10) / 10,
  };
}

const out = {
  generatedAt: new Date().toISOString(),
  method:
    `Event: country has a live US ETF, was distressed two years earlier (inflation >= ${DISTRESS.inflation}% or fiscal <= ${DISTRESS.fiscal}% GDP, the app's TURNAROUND thresholds), and its quant-only score improved by at least the stated threshold over those two years. Trade: buy end-April of the following year (after the WEO vintage covering the signal year is public), hold 12 months, measure dividend-adjusted return minus EEM.`,
  caveats: [
    'Survivorship bias, in the playbook\'s favor: the liquidated country ETFs (Egypt, Nigeria, Pakistan, frontier FM) have no retrievable price history, so the failed reform stories are missing from this sample.',
    'Revised-data bias: scores are computed from today\'s IMF WEO vintage, not the noisier numbers actually known at the time.',
    'Tiny, overlapping sample: consecutive event-years in the same country share most of their return windows; do not read statistical significance into any of this.',
    'Nothing is fitted: the thresholds are the live screen\'s own, chosen before this backtest was run. If the numbers look good, that is one weak piece of evidence, not proof of an edge.',
    'The 2020 COVID fiscal shock makes nearly every country "distressed" for 2022 signals, so several events are generic pandemic-recovery trades, not reformer stories. The event definition cannot tell the difference; a human can.',
    'Annual data is late by construction: the screen\'s Argentina event does not fire until the 2025 data year (entry April 2026), roughly two years after the actual asset bottom. This tool spots setups in annual fundamentals, not entry points.',
  ],
  universe: Object.entries(prices.tickers).filter(([, p]) => p.iso3 !== '_BENCHMARK').map(([t, p]) => `${t} (${p.iso3}, since ${p.firstMonth.slice(0, 4)})`),
  sensitivity: THRESHOLDS.map(summarize),
  events,
};

const OUT = path.join(ROOT, 'data', 'backtest.json');
fs.writeFileSync(OUT + '.tmp', JSON.stringify(out, null, 2));
fs.renameSync(OUT + '.tmp', OUT);
console.log(`Wrote ${OUT}: ${events.length} events`);
for (const s of out.sensitivity) {
  console.log(`momentum >= +${s.minMomentum}: n=${s.n} hit=${s.hitRate ?? '-'}% avgExcess=${s.avgExcessPct ?? '-'}% median=${s.medianExcessPct ?? '-'}%`);
}
