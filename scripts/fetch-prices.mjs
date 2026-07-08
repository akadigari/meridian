#!/usr/bin/env node
/**
 * Fetches monthly adjusted closes for US-listed country ETFs (Yahoo chart API,
 * no key) -> data/prices.json. Used for two things:
 *   1. The "depth gauge": how far an ETF trades below its 5-year high, shown
 *      on country pages so "priced in" has a number attached.
 *   2. The hindsight backtest (scripts/backtest.mjs).
 *
 * Honest limitation, disclosed everywhere it matters: liquidated funds (EGPT,
 * NGE, PAK, FM) return no usable history, so any backtest built on this data
 * covers SURVIVORS ONLY. The failed reform ETFs are exactly the ones missing.
 * Run: npm run fetch-prices
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'prices.json');

// ticker -> ISO3 (EEM is the EM benchmark for excess returns).
export const ETF_UNIVERSE = {
  ARGT: 'ARG', TUR: 'TUR', GREK: 'GRC', VNM: 'VNM', EWZ: 'BRA', THD: 'THA',
  EIDO: 'IDN', EPU: 'PER', ECH: 'CHL', EPOL: 'POL', EZA: 'ZAF', EWW: 'MEX',
  INDA: 'IND', EPHE: 'PHL', KSA: 'SAU', EWY: 'KOR', COLO: 'COL',
  EEM: '_BENCHMARK',
};

async function fetchMonthly(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=25y&interval=1mo`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (meridian-dashboard)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  const r = j?.chart?.result?.[0];
  if (!r?.timestamp?.length) throw new Error(j?.chart?.error?.description ?? 'no data');
  const closes = r.indicators?.adjclose?.[0]?.adjclose ?? r.indicators?.quote?.[0]?.close ?? [];
  const months = {};
  r.timestamp.forEach((ts, i) => {
    const v = closes[i];
    if (v != null && isFinite(v)) months[new Date(ts * 1000).toISOString().slice(0, 7)] = Math.round(v * 10000) / 10000;
  });
  return months;
}

async function main() {
  console.log('- Meridian price fetch (Yahoo chart API, monthly adjclose) -');
  const tickers = {};
  const failed = [];
  for (const [ticker, iso3] of Object.entries(ETF_UNIVERSE)) {
    try {
      const months = await fetchMonthly(ticker);
      const keys = Object.keys(months).sort();
      if (keys.length < 24) throw new Error(`only ${keys.length} months (liquidated fund?)`);
      const last = months[keys[keys.length - 1]];
      const last60 = keys.slice(-60).map((k) => months[k]);
      const high5y = Math.max(...last60);
      tickers[ticker] = {
        iso3,
        firstMonth: keys[0],
        lastMonth: keys[keys.length - 1],
        last,
        high5y: Math.round(high5y * 100) / 100,
        pctBelowHigh: Math.round((last / high5y - 1) * 1000) / 10, // negative = below high
        months,
      };
      console.log(`${ticker.padEnd(5)} ${keys[0]} -> ${keys[keys.length - 1]}  last=${last}  vs 5y high ${tickers[ticker].pctBelowHigh}%`);
    } catch (e) {
      failed.push(`${ticker}: ${e.message}`);
      console.log(`${ticker.padEnd(5)} SKIPPED (${e.message})`);
    }
    await new Promise((r) => setTimeout(r, 400)); // be polite
  }
  if (!tickers.EEM) throw new Error('benchmark EEM failed; refusing to write prices.json');
  if (Object.keys(tickers).length < 8) throw new Error('too few tickers succeeded; refusing to write');

  const out = {
    generatedAt: new Date().toISOString(),
    source: 'Yahoo Finance chart API, monthly adjusted close (dividend-adjusted)',
    note: 'Survivors only: liquidated country ETFs (EGPT, NGE, PAK, FM) have no retrievable history.',
    failed,
    tickers,
  };
  fs.writeFileSync(OUT + '.tmp', JSON.stringify(out));
  fs.renameSync(OUT + '.tmp', OUT);
  console.log(`\nWrote ${OUT} (${Object.keys(tickers).length} tickers)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
