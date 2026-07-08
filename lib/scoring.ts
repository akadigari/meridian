/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  MERIDIAN SCORING ENGINE - the one file that defines the entire methodology.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  NEW HERE? This file is the heart of the project and it was written to be
 *  read. There is no clever math anywhere: every score comes from "connect
 *  the dots" lines between hand-picked anchor points (see piecewise() below),
 *  and the final score is a weighted average. A guided tour of the whole
 *  codebase for beginners lives in docs/CODE_TOUR.md.
 *
 *  THE THESIS THIS SCORES (stated honestly):
 *  When a broke, high-inflation country gets a serious reformer who fixes the
 *  fundamentals - kills the deficit, frees the currency, crushes inflation - 
 *  its assets can re-rate upward and early investors benefit.
 *
 *  WHAT A SCORE MEANS (and doesn't):
 *  A high score means "ranks well on the reform-playbook fundamentals."
 *  It does NOT mean "will make money." This is a discretionary screening
 *  heuristic - not a backtested edge, not a prediction, not financial advice.
 *  Much of any turnaround may already be priced in by the time it screens well.
 *
 *  THE 5 FACTORS AND THEIR WEIGHTS (sum = 100):
 *    A. Inflation falling ........ 25   (quant - IMF WEO, all countries)
 *    B. Currency honesty ......... 20   (quant proxy + CURATED parallel-gap overlay)
 *    C. Bond-market trust ........ 15   (CURATED spreads; quant PROXY elsewhere)
 *    D. Fiscal balance ........... 25   (quant - IMF WEO, all countries)
 *    E. Serious reformer ......... 15   (CURATED only - no API can measure this)
 *
 *  AUTOMATED vs CURATED:
 *  Factors A and D are fully automated from the IMF WEO DataMapper (annual,
 *  includes IMF estimates for the current year). Factor B's automated part is
 *  official-rate depreciation - which CANNOT see a parallel market, so a
 *  curated official-vs-parallel gap overrides it where we track one. Factor C
 *  uses curated sovereign spreads on the shortlist and an honest, clearly
 *  labeled proxy (reserves / current account / debt / growth) everywhere else.
 *  Factor E is purely curated: "is there a serious reformer" is a judgment
 *  call, and we'd rather show a judgment with sources than fake a number.
 *  Countries with no curated overlay renormalize the remaining weights and are
 *  marked UNRATED for signal purposes - they get a score, not a verdict.
 *
 *  Every threshold below is a judgment call. That's the point of putting them
 *  all in one file: change them, re-rank, disagree.
 */

import type {
  QuantData, CuratedOverlay, FactorScore, ScoredCountry, Series,
  KillCriterion, Signal, Confidence,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// WEIGHTS - the whole ranking in five numbers.
// ─────────────────────────────────────────────────────────────────────────────
export const WEIGHTS = {
  inflation: 25,
  currency: 20,
  bondTrust: 15,
  fiscal: 25,
  reformer: 15,
} as const;

// Traffic-light bands used everywhere in the UI.
export const LIGHT_BANDS = { green: 70, yellow: 40 } as const; // ≥70 green, ≥40 yellow, else red

// Signal thresholds (curated countries only - see computeSignal).
export const SIGNAL_BANDS = { setupIntact: 65, watch: 45 } as const;

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────
const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

/** Piecewise-linear interpolation through [x, score] anchor points. */
function piecewise(x: number, points: [number, number][]): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1];
    const [x2, y2] = points[i];
    if (x <= x2) return y1 + ((x - x1) / (x2 - x1)) * (y2 - y1);
  }
  return points[points.length - 1][1];
}

/** Latest year ≤ maxYear that has a value in the series. */
export function latestYear(s: Series | undefined, maxYear: number): string | null {
  if (!s) return null;
  const years = Object.keys(s)
    .map(Number)
    .filter((y) => y <= maxYear && s[String(y)] != null && isFinite(s[String(y)]))
    .sort((a, b) => b - a);
  return years.length ? String(years[0]) : null;
}

const val = (s: Series | undefined, year: string | null): number | null =>
  s && year != null && s[year] != null && isFinite(s[year]) ? s[year] : null;

function light(score: number | null): FactorScore['light'] {
  if (score == null) return 'gray';
  return score >= LIGHT_BANDS.green ? 'green' : score >= LIGHT_BANDS.yellow ? 'yellow' : 'red';
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTOR A - INFLATION FALLING (weight 25)
// 45% "how low is it" + 55% "is it being crushed". The trajectory leg is what
// makes this a turnaround screen and not a stability contest: disinflation
// from 200% → 40% scores the trend leg near 100, while a rich country parked
// at 2% (nothing to improve) gets a neutral 50 on trend.
// ─────────────────────────────────────────────────────────────────────────────
export function scoreInflationLevel(pct: number): number {
  // 0–2% ideal; hyperinflation territory is a zero. Log-ish via anchors.
  return piecewise(pct, [
    [0, 95],   // deflation is not rewarded above 95 - it has its own problems
    [2, 100],
    [5, 85],
    [10, 65],
    [20, 45],
    [40, 25],
    [80, 10],
    [150, 3],
    [300, 0],
  ]);
}

export function scoreInflationTrend(now: number, prior: number): number {
  if (prior <= 10 && now <= 10) return 50; // already low → nothing to crush; neutral
  // Relative decline: 1 − now/prior. Halving inflation ⇒ 0.5 ⇒ solid score.
  const rel = 1 - now / Math.max(prior, 0.1);
  return piecewise(rel, [
    [-1.0, 0],   // inflation doubled → 0
    [-0.3, 20],  // +30% worse
    [0.0, 45],   // flat
    [0.3, 65],   // down 30%
    [0.6, 85],   // down 60%
    [0.8, 100],  // crushed
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTOR B - CURRENCY HONESTY (weight 20)
// The real question: does the official rate tell the truth? A small
// official-vs-parallel gap is the honest signal, but it only exists where a
// parallel market exists (curated). The automated proxy - official-rate
// depreciation - catches collapsing currencies but is BLIND to a rigged peg,
// so where we curate a gap it dominates the factor (65/35).
// ─────────────────────────────────────────────────────────────────────────────
export function scoreParallelGap(gapPct: number): number {
  return piecewise(Math.abs(gapPct), [
    [0, 100],  // unified / free float
    [3, 90],
    [8, 70],   // cracks showing
    [15, 45],  // market doesn't believe the official rate
    [30, 20],
    [60, 5],
    [100, 0],  // Venezuela-grade fiction
  ]);
}

export function scoreDepreciation(annualPct: number): number {
  // 3y annualized depreciation of official LCU/USD. Mild drift is normal for EM.
  return piecewise(annualPct, [
    [-5, 90],  // appreciating - fine, not extra credit (could be commodity luck)
    [0, 95],
    [5, 85],
    [10, 65],
    [20, 45],
    [40, 25],
    [80, 8],
    [150, 0],
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTOR C - BOND-MARKET TRUST (weight 15)
// Curated: sovereign USD spread (EMBI-style, bps). The bond market is the
// meanest, best-informed judge of a reform program. Free APIs don't publish
// per-country spreads, so outside the shortlist we fall back to a PROXY of
// external-accounts health and label it as such - a proxy for "could the
// bond market trust this country", not the market's actual opinion.
// ─────────────────────────────────────────────────────────────────────────────
export function scoreSpread(bps: number, trend: 'falling' | 'stable' | 'rising' | 'unknown'): number {
  const base = piecewise(bps, [
    [100, 100],
    [300, 85],   // healthy EM
    [500, 65],   // priced like a credit with questions
    [800, 45],   // distressed-adjacent
    [1200, 25],  // market pricing real default odds
    [2000, 5],
    [3000, 0],
  ]);
  // Direction matters: a 600bps spread grinding tighter ≠ 600bps blowing out.
  const adj = trend === 'falling' ? +8 : trend === 'rising' ? -12 : 0;
  return clamp(base + adj);
}

export function proxyBondTrust(q: {
  reservesMonths: number | null;
  currentAccountPct: number | null;
  debtPct: number | null;
  growthPct: number | null;
}): { score: number | null; parts: string[] } {
  const parts: string[] = [];
  const subs: number[] = [];
  if (q.reservesMonths != null) {
    subs.push(piecewise(q.reservesMonths, [[0, 0], [1, 15], [3, 55], [5, 80], [8, 95], [12, 100]]));
    parts.push(`reserves ${q.reservesMonths.toFixed(1)}mo imports`);
  }
  if (q.currentAccountPct != null) {
    subs.push(piecewise(q.currentAccountPct, [[-10, 5], [-5, 30], [-2, 55], [0, 70], [3, 90], [8, 100]]));
    parts.push(`current acct ${q.currentAccountPct.toFixed(1)}% GDP`);
  }
  if (q.debtPct != null) {
    subs.push(piecewise(q.debtPct, [[20, 100], [40, 85], [60, 65], [90, 40], [120, 20], [180, 0]]));
    parts.push(`govt debt ${q.debtPct.toFixed(0)}% GDP`);
  }
  if (q.growthPct != null) {
    subs.push(piecewise(q.growthPct, [[-6, 5], [-2, 30], [0, 45], [2, 65], [4, 85], [7, 100]]));
    parts.push(`growth ${q.growthPct.toFixed(1)}%`);
  }
  if (!subs.length) return { score: null, parts };
  return { score: subs.reduce((a, b) => a + b, 0) / subs.length, parts };
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTOR D - FISCAL BALANCE (weight 25)
// "Kill the deficit" is the core of the playbook. 60% level + 40% trajectory:
// a surplus you just reached counts more than one you inherited, and a big
// deficit that's shrinking fast is exactly what this screen exists to catch.
// ─────────────────────────────────────────────────────────────────────────────
export function scoreFiscalLevel(balancePct: number): number {
  return piecewise(balancePct, [
    [-12, 0],
    [-8, 15],
    [-5, 35],
    [-3, 55],  // the garden-variety EM deficit
    [-1, 72],
    [0, 82],   // balanced - the psychological line the playbook cares about
    [1, 92],
    [3, 100],
  ]);
}

export function scoreFiscalTrend(nowPct: number, priorPct: number): number {
  const improvement = nowPct - priorPct; // pp of GDP over the window (~2y)
  return piecewise(improvement, [
    [-4, 0],   // blowing out
    [-1.5, 25],
    [0, 50],   // flat
    [1.5, 70],
    [3, 85],
    [5, 100],  // Milei-grade consolidation
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTOR E - SERIOUS REFORMER (weight 15, curated only)
// No API measures political will. The curated score (0–100) is a sourced
// judgment: 100 ≈ shock therapy with a mandate; 50 ≈ orthodox but constrained;
// 0 ≈ no reformer / actively unorthodox. If the reformer is out of power the
// score is forced to ≤10 regardless of how good the program was.
// ─────────────────────────────────────────────────────────────────────────────
export function scoreReformer(c: CuratedOverlay['reformer']): number {
  if (!c.exists) return clamp(c.score, 0, 25); // "no reformer" can still have technocratic drift
  if (!c.inPower) return Math.min(c.score, 10); // the person IS the trade; gone = gone
  return clamp(c.score);
}

// ─────────────────────────────────────────────────────────────────────────────
// KILL CRITERIA - the explicit "you are wrong, get out" conditions.
// Evaluated only where we have curated data; UNKNOWN elsewhere (we won't
// pretend to monitor what we can't see).
// ─────────────────────────────────────────────────────────────────────────────
export function evaluateKillCriteria(
  cur: CuratedOverlay | undefined,
  fiscalNow: number | null,
  fiscalPrior: number | null,
): KillCriterion[] {
  const unknown = (id: string, label: string): KillCriterion =>
    ({ id, label, status: 'unknown', detail: 'No curated coverage for this country.' });
  if (!cur) {
    return [
      unknown('reformer', 'Reformer loses power'),
      unknown('gap', 'Currency gap reopens / forced devaluation'),
      unknown('fiscal', 'Budget flips back to deficit'),
      unknown('risk', 'Country risk blows out'),
    ];
  }
  const out: KillCriterion[] = [];

  // 1. Reformer loses power.
  out.push({
    id: 'reformer',
    label: 'Reformer loses power',
    status: !cur.reformer.exists ? 'unknown' : cur.reformer.inPower ? 'ok' : 'tripped',
    detail: cur.reformer.exists
      ? `${cur.reformer.name ?? 'Reform team'} ${cur.reformer.inPower ? 'in power' : 'OUT of power'}. Next election: ${cur.reformer.nextElection ?? 'n/a'}.`
      : 'No reformer identified - criterion not applicable.',
  });

  // 2. Currency gap reopens. near > 8%, tripped > 15%.
  const gap = cur.parallelFx.gapPct;
  out.push({
    id: 'gap',
    label: 'Currency gap reopens / forced devaluation',
    status: gap == null ? 'unknown' : gap > 15 ? 'tripped' : gap > 8 ? 'near' : 'ok',
    detail: gap == null
      ? cur.parallelFx.notes
      : `Official-vs-parallel gap ≈ ${gap.toFixed(1)}% (tripwire: near >8%, tripped >15%). ${cur.parallelFx.notes}`,
  });

  // 3. Budget flips back to deficit (or is deteriorating >1.5pp over the window).
  let fiscalStatus: KillCriterion['status'] = 'unknown';
  let fiscalDetail = 'No fiscal data.';
  if (fiscalNow != null) {
    const deteriorating = fiscalPrior != null && fiscalNow - fiscalPrior < -1.5;
    const wasPositive = fiscalPrior != null && fiscalPrior >= 0;
    if (wasPositive && fiscalNow < -0.5) fiscalStatus = 'tripped';
    else if (fiscalNow < 0 && deteriorating) fiscalStatus = 'near';
    else if (deteriorating) fiscalStatus = 'near';
    else fiscalStatus = 'ok';
    fiscalDetail = `Balance ${fiscalNow.toFixed(1)}% of GDP now vs ${fiscalPrior != null ? fiscalPrior.toFixed(1) : '-'}% ~2y ago (IMF WEO). ${cur.fiscalNote ?? ''}`;
  }
  out.push({ id: 'fiscal', label: 'Budget flips back to deficit', status: fiscalStatus, detail: fiscalDetail });

  // 4. Country risk blows out. near: >700bps, or rising & >500bps; tripped: >900bps, or rising & >800bps.
  const cr = cur.countryRisk;
  let riskStatus: KillCriterion['status'] = 'unknown';
  if (cr.spreadBps != null) {
    if (cr.spreadBps > 900 || (cr.trend === 'rising' && cr.spreadBps > 800)) riskStatus = 'tripped';
    else if (cr.spreadBps > 700 || (cr.trend === 'rising' && cr.spreadBps > 500)) riskStatus = 'near';
    else riskStatus = 'ok';
  }
  out.push({
    id: 'risk',
    label: 'Country risk blows out',
    status: riskStatus,
    detail: cr.spreadBps != null
      ? `Sovereign spread ≈ ${cr.spreadBps}bps, trend ${cr.trend}. ${cr.rating ?? ''} (tripwire: near >700bps or rising & >500bps; tripped >900bps or rising & >800bps)`
      : cr.notes,
  });

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGNAL - a verdict, only where we've done the qualitative homework.
//   SETUP INTACT: composite ≥65, live reformer, nothing tripped, AND all four
//                 kill criteria monitorable. If we can't watch an exit
//                 condition (no spread data, no gap number), we don't hand out
//                 the full green light - that's WATCH, honestly labeled.
//   WATCH:        composite ≥45, or something is "near"/"unknown".
//   STAND DOWN:   kill criterion tripped, or composite <45.
//   UNRATED:      no curated overlay → we give a score, not a verdict.
// A high signal is a CONTINUATION bet - it says the setup holds, not that
// the asset is cheap. Re-rating already underway is re-rating you missed.
// ─────────────────────────────────────────────────────────────────────────────
export function computeSignal(
  composite: number | null,
  curated: boolean,
  kills: KillCriterion[],
): Signal {
  if (!curated || composite == null) return 'UNRATED';
  if (kills.some((k) => k.status === 'tripped')) return 'STAND DOWN';
  if (composite < SIGNAL_BANDS.watch) return 'STAND DOWN';
  const fullyMonitored = kills.every((k) => k.status === 'ok');
  if (composite >= SIGNAL_BANDS.setupIntact && fullyMonitored) return 'SETUP INTACT';
  return 'WATCH';
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCORER - one country in, one ScoredCountry out.
// `nowYear` is the anchor year (the latest with broad IMF coverage - usually
// the current year, which is an IMF *estimate* and labeled as such in the UI).
// Momentum = quant-only composite(now) − composite(now − MOMENTUM_WINDOW).
// ─────────────────────────────────────────────────────────────────────────────
export const MOMENTUM_WINDOW = 2; // years
export const MAX_DATA_AGE = 2;    // years - older core data ⇒ country is not scored

export function scoreCountry(
  q: QuantData,
  cur: CuratedOverlay | undefined,
  nowYear: number,
): ScoredCountry {
  // ---- resolve the data years ------------------------------------------------
  const yNow = latestYear(q.inflation, nowYear) ?? latestYear(q.fiscal, nowYear);
  const yNum = yNow ? Number(yNow) : nowYear;
  const yPrior = String(yNum - MOMENTUM_WINDOW);

  // STALENESS GATE: if the freshest core data (inflation/fiscal) is more than
  // MAX_DATA_AGE years old, the IMF has effectively stopped covering this
  // country (war, no statistics). Scoring 7-year-old numbers as if current
  // would put ghosts at the top of the leaderboard - refuse instead.
  const tooStale = yNow == null || nowYear - yNum > MAX_DATA_AGE;

  // ---- FACTOR A: inflation ----------------------------------------------------
  // Prefer the curated latest monthly print (much fresher than annual WEO) for
  // the LEVEL leg; the trend leg always uses the annual series for consistency.
  const infNowAnnual = val(q.inflation, latestYear(q.inflation, yNum));
  const infPrior = val(q.inflation, latestYear(q.inflation, yNum - MOMENTUM_WINDOW));
  const infCurated = cur?.latestInflation?.yoyPct ?? null;
  const infLevelInput = infCurated ?? infNowAnnual;
  let inflation: FactorScore;
  if (infLevelInput == null) {
    inflation = { score: null, light: 'gray', confidence: 'missing', detail: 'No inflation data.' };
  } else {
    const levelS = scoreInflationLevel(infLevelInput);
    const trendS = infNowAnnual != null && infPrior != null
      ? scoreInflationTrend(infNowAnnual, infPrior)
      : 50;
    const score = clamp(0.45 * levelS + 0.55 * trendS);
    inflation = {
      score,
      light: light(score),
      // The level leg may come from the curated monthly print (fresher than
      // annual WEO) - the tag must say so, or curated data masquerades as API.
      confidence: infCurated != null ? 'curated' : 'api',
      asOf: infCurated != null ? cur?.latestInflation?.asOf : `${latestYear(q.inflation, yNum)} (IMF WEO${yNum >= nowYear ? ' est.' : ''})`,
      detail: `${infLevelInput.toFixed(1)}% ${infCurated != null ? `(latest print, ${cur?.latestInflation?.asOf})` : 'annual avg'}${
        infPrior != null && infNowAnnual != null ? `; vs ${infPrior.toFixed(1)}% in ${yPrior} → trend ${infNowAnnual < infPrior ? 'falling' : infNowAnnual > infPrior ? 'rising' : 'flat'}` : ''
      }`,
    };
  }

  // ---- FACTOR B: currency honesty ----------------------------------------------
  // Automated leg: official depreciation, blended 60% recent (1y) / 40%
  // structural (3y CAGR). Recent behavior dominates on purpose: a completed
  // one-time devaluation is the honest correction the playbook WANTS - what
  // matters is whether the currency is stable *after* it. A 3y-only window
  // would keep punishing Argentina for the 2023 unification for years.
  // STALENESS: the fx series is gated like the core factors - if the freshest
  // official rate is older than MAX_DATA_AGE, the leg is treated as missing
  // (Venezuela's series ends 2017 in pre-redenomination bolívares; scoring it
  // as "stable" would be exactly the lie this factor exists to catch).
  let depPct: number | null = null;   // headline % for display
  let depWindow = '';                 // which window the headline came from
  let depScore: number | null = null; // blended score
  const fxLatestY = latestYear(q.fxOfficial, yNum);
  if (q.fxOfficial && fxLatestY && yNum - Number(fxLatestY) <= MAX_DATA_AGE) {
    const now = q.fxOfficial[fxLatestY];
    const y1 = q.fxOfficial[String(Number(fxLatestY) - 1)];
    const y3 = q.fxOfficial[String(Number(fxLatestY) - 3)];
    const dep1 = y1 != null && y1 > 0 && now != null ? (now / y1 - 1) * 100 : null;
    const dep3 = y3 != null && y3 > 0 && now != null ? (Math.pow(now / y3, 1 / 3) - 1) * 100 : null;
    if (dep1 != null && dep3 != null) {
      depScore = 0.6 * scoreDepreciation(dep1) + 0.4 * scoreDepreciation(dep3);
      depPct = dep1;
      depWindow = `${fxLatestY} vs ${Number(fxLatestY) - 1}, blended w/ 3y trend`;
    } else if (dep1 != null || dep3 != null) {
      depScore = scoreDepreciation((dep1 ?? dep3)!);
      depPct = dep1 ?? dep3;
      depWindow = dep1 != null ? `${fxLatestY} vs ${Number(fxLatestY) - 1}` : `3y annualized to ${fxLatestY}`;
    }
  }
  const gapPct = cur?.parallelFx?.gapPct ?? null;
  let currency: FactorScore;
  if (gapPct != null) {
    const gapS = scoreParallelGap(gapPct);
    const depS = depScore ?? gapS;
    const score = clamp(0.65 * gapS + 0.35 * depS);
    currency = {
      score, light: light(score), confidence: 'curated', asOf: cur?.asOf,
      detail: `Official-vs-parallel gap ≈ ${gapPct.toFixed(1)}% (curated${depPct != null ? `; official rate ${depPct >= 0 ? 'depreciated' : 'appreciated'} ${Math.abs(depPct).toFixed(0)}% (${depWindow})` : ''}). ${cur?.parallelFx?.notes ?? ''}`,
    };
  } else if (depScore != null) {
    const score = clamp(depScore);
    currency = {
      score, light: light(score), confidence: 'proxy', asOf: fxLatestY ?? undefined,
      detail: `Official rate ${depPct! >= 0 ? 'depreciation' : 'appreciation'} ≈ ${Math.abs(depPct!).toFixed(1)}% (${depWindow}). PROXY ONLY - cannot detect a parallel market or a rigged peg.`,
    };
  } else {
    currency = {
      score: null, light: 'gray', confidence: 'missing',
      detail: q.fxOfficial && fxLatestY
        ? `No usable exchange-rate data: official series ends ${fxLatestY} (older than the ${MAX_DATA_AGE}y staleness gate).`
        : 'No exchange-rate data (or not an own-currency country).',
    };
  }

  // ---- FACTOR C: bond-market trust ----------------------------------------------
  const fiscalSeriesYear = latestYear(q.fiscal, yNum);
  const growthNow = val(q.growth, latestYear(q.growth, yNum));
  let bondTrust: FactorScore;
  if (cur?.countryRisk?.spreadBps != null) {
    const score = clamp(scoreSpread(cur.countryRisk.spreadBps, cur.countryRisk.trend));
    bondTrust = {
      score, light: light(score), confidence: 'curated', asOf: cur.asOf,
      detail: `Sovereign USD spread ≈ ${cur.countryRisk.spreadBps}bps, trend ${cur.countryRisk.trend}. ${cur.countryRisk.rating ?? ''}`,
    };
  } else {
    // Reserves get a slightly looser staleness window (World Bank publishes
    // with a lag) but a window nonetheless - a 2016 reserves number is not a
    // present-tense fact about anything.
    const reservesFresh =
      q.reservesMonths && yNum - Number(q.reservesMonths.year) <= MAX_DATA_AGE + 1;
    const proxy = proxyBondTrust({
      reservesMonths: reservesFresh ? q.reservesMonths!.value : null,
      currentAccountPct: val(q.currentAccount, latestYear(q.currentAccount, yNum)),
      debtPct: val(q.debt, latestYear(q.debt, yNum)),
      growthPct: growthNow,
    });
    bondTrust = proxy.score == null
      ? { score: null, light: 'gray', confidence: 'missing', detail: 'No spread and no external-accounts data.' }
      : {
          score: clamp(proxy.score), light: light(clamp(proxy.score)), confidence: 'proxy',
          detail: `PROXY (no market spread available): ${proxy.parts.join(', ')}. This measures balance-sheet health, not the bond market's actual opinion.`,
        };
  }

  // ---- FACTOR D: fiscal ----------------------------------------------------------
  const fisNow = val(q.fiscal, fiscalSeriesYear);
  const fisPrior = val(q.fiscal, latestYear(q.fiscal, yNum - MOMENTUM_WINDOW));
  let fiscal: FactorScore;
  if (fisNow == null) {
    fiscal = { score: null, light: 'gray', confidence: 'missing', detail: 'No fiscal balance data.' };
  } else {
    const levelS = scoreFiscalLevel(fisNow);
    const trendS = fisPrior != null ? scoreFiscalTrend(fisNow, fisPrior) : 50;
    const score = clamp(0.6 * levelS + 0.4 * trendS);
    fiscal = {
      score, light: light(score), confidence: 'api',
      asOf: `${fiscalSeriesYear} (IMF WEO${Number(fiscalSeriesYear) >= nowYear ? ' est.' : ''})`,
      detail: `Balance ${fisNow.toFixed(1)}% of GDP${fisPrior != null ? ` (${fisNow >= fisPrior ? '+' : ''}${(fisNow - fisPrior).toFixed(1)}pp vs ${yPrior})` : ''}. ${cur?.fiscalNote ?? ''}`,
    };
  }

  // ---- FACTOR E: reformer ----------------------------------------------------------
  let reformer: FactorScore;
  if (cur) {
    const score = scoreReformer(cur.reformer);
    reformer = {
      score, light: light(score), confidence: 'curated', asOf: cur.asOf,
      detail: cur.reformer.exists
        ? `${cur.reformer.name} (${cur.reformer.role}) - ${cur.reformer.notes}`
        : cur.reformer.notes,
    };
  } else {
    reformer = {
      score: null, light: 'gray', confidence: 'missing',
      detail: 'Not curated. "Is there a serious reformer" is a judgment call - we don\'t fake it from an API.',
    };
  }

  // ---- COMPOSITE: weighted average over available factors (weights renormalized) ----
  const entries: [keyof typeof WEIGHTS, FactorScore][] = [
    ['inflation', inflation], ['currency', currency], ['bondTrust', bondTrust],
    ['fiscal', fiscal], ['reformer', reformer],
  ];
  let wSum = 0, sSum = 0, coverage = 0;
  for (const [k, f] of entries) {
    if (f.score != null) {
      wSum += WEIGHTS[k];
      sSum += WEIGHTS[k] * f.score;
      coverage++;
    }
  }
  // Require BOTH core quant factors (inflation + fiscal) plus their combined
  // weight to score at all, and refuse to score stale data (staleness gate
  // above). One core factor missing = no composite; a currency proxy is not a
  // substitute for knowing the inflation picture.
  const hasCore = inflation.score != null && fiscal.score != null;
  const composite = hasCore && wSum >= 50 && !tooStale ? Math.round((sSum / wSum) * 10) / 10 : null;

  // ---- MOMENTUM: quant-only composite now vs MOMENTUM_WINDOW years ago -------------
  // Uses only factors computable at BOTH dates from API series (inflation level+
  // trend, fiscal level, growth, depreciation) so curated freshness doesn't
  // contaminate the comparison.
  const momentumNow = quantComposite(q, yNum);
  const momentumPrior = quantComposite(q, yNum - MOMENTUM_WINDOW);
  const momentum = !tooStale && momentumNow != null && momentumPrior != null
    ? Math.round((momentumNow - momentumPrior) * 10) / 10
    : null;

  // ---- turnaround candidate: was it in real macro distress ~2y ago? ---------------
  const infThen = val(q.inflation, latestYear(q.inflation, yNum - MOMENTUM_WINDOW));
  const fisThen = fisPrior;
  const turnaroundCandidate =
    (infThen != null && infThen >= 20) || (fisThen != null && fisThen <= -5);

  const kills = evaluateKillCriteria(cur, fisNow, fisPrior);
  const signal = computeSignal(composite, !!cur, kills);

  return {
    iso3: q.iso3,
    name: q.name,
    composite,
    factors: { inflation, currency, bondTrust, fiscal, reformer },
    momentum,
    momentumDetail: momentum != null
      ? `Quant score ${momentumPrior!.toFixed(0)} (${yPrior}) → ${momentumNow!.toFixed(0)} (${yNow ?? nowYear})`
      : tooStale
        ? `Not scored: freshest IMF data is ${yNow ?? 'missing'} (older than ${nowYear - MAX_DATA_AGE}).`
        : 'Insufficient history for momentum.',
    signal,
    killCriteria: kills,
    curated: !!cur,
    turnaroundCandidate,
    dataYears: { latest: yNow ?? String(nowYear), prior: yPrior },
    coverage,
  };
}

/**
 * Quant-only score series over a span of years - the "past history math"
 * behind the country-page sparkline and the hindsight backtest. Same curves
 * as the live factors, so the history is comparable with today's score.
 */
export function quantHistory(q: QuantData, from: number, to: number): { year: number; score: number }[] {
  const out: { year: number; score: number }[] = [];
  for (let y = from; y <= to; y++) {
    const s = quantComposite(q, y);
    // Skip years whose freshest inflation data is stale relative to that
    // year, mirroring the staleness rules used everywhere else.
    const iy = latestYear(q.inflation, y);
    if (s != null && iy != null && y - Number(iy) <= MAX_DATA_AGE) {
      out.push({ year: y, score: Math.round(s * 10) / 10 });
    }
  }
  return out;
}

/**
 * Quant-only sub-composite at an arbitrary year - used for momentum.
 * Same scoring curves as the main factors, restricted to what the APIs can
 * see at any date: inflation (level+trend), fiscal (level), growth, and
 * official-rate depreciation.
 */
export function quantComposite(q: QuantData, year: number): number | null {
  const inf = val(q.inflation, latestYear(q.inflation, year));
  const infPrev = val(q.inflation, latestYear(q.inflation, year - 1));
  const fis = val(q.fiscal, latestYear(q.fiscal, year));
  const gro = val(q.growth, latestYear(q.growth, year));

  let dep: number | null = null;
  const fy = latestYear(q.fxOfficial, year);
  // Same staleness rule as the main factor: fx older than MAX_DATA_AGE
  // relative to the year being scored is treated as missing.
  if (q.fxOfficial && fy && year - Number(fy) <= MAX_DATA_AGE) {
    const then = q.fxOfficial[String(Number(fy) - 2)];
    const now = q.fxOfficial[fy];
    if (now != null && then != null && then > 0) dep = (Math.pow(now / then, 1 / 2) - 1) * 100;
  }

  const parts: [number, number][] = []; // [weight, score]
  if (inf != null) {
    const trend = infPrev != null ? scoreInflationTrend(inf, infPrev) : 50;
    parts.push([35, 0.45 * scoreInflationLevel(inf) + 0.55 * trend]);
  }
  if (fis != null) parts.push([35, scoreFiscalLevel(fis)]);
  if (gro != null) parts.push([15, piecewise(gro, [[-6, 5], [-2, 30], [0, 45], [2, 65], [4, 85], [7, 100]])]);
  if (dep != null) parts.push([15, scoreDepreciation(dep)]);

  const w = parts.reduce((a, [pw]) => a + pw, 0);
  if (w < 70) return null; // need inflation + fiscal at minimum
  return parts.reduce((a, [pw, s]) => a + pw * s, 0) / w;
}
