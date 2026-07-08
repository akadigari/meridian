// Turns our own backtest numbers + curated facts into two plain-English lines
// per Trident Five pick: how long you'd ride the idea, and what $1,000 did in
// past signals like this. This is arithmetic on real data we ship, clearly
// labeled - it is NOT a forecast and NOT advice.
import type { CuratedOverlay } from './types';
import type { BacktestFile } from './data';

export interface PickMath {
  /** e.g. "12 months at a time; next election Oct 2027 is the natural checkpoint" */
  horizon: string;
  /** e.g. "$1,000 -> about $1,088 in 12 months if it matches the average past signal" */
  dollars: string | null;
}

/** First "Month Year" or bare year found in a curated next-election string. */
function electionLabel(nextElection?: string): string | null {
  if (!nextElection) return null;
  const my = nextElection.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?[ -~]{0,3}(20\d\d)/,
  );
  if (my) return `${my[1].slice(0, 3)} ${my[2]}`;
  const y = nextElection.match(/20\d\d/);
  return y ? y[0] : null;
}

/**
 * The playbook's natural clock: our backtest holds each signal for 12 months,
 * and the thesis dies when the reformer loses power - so elections are the
 * checkpoints and kill criteria are the exits.
 */
export function pickMath(
  cur: CuratedOverlay | null | undefined,
  backtest: BacktestFile | null,
  nowYear: number,
): PickMath {
  // Horizon
  let horizon = 'about 12 months at a time, out the moment a kill criterion trips';
  const el = electionLabel(cur?.reformer?.nextElection);
  if (el) {
    const y = Number(el.match(/20\d\d/)?.[0] ?? 0);
    horizon =
      y > 0 && y <= nowYear + 1
        ? `12 months, but the ${el} election is the real deadline - reassess before it`
        : `12 months at a time until the ${el} election; exit early if a kill criterion trips`;
  }

  // Dollars: the average 12-month result across every past signal in our
  // backtest (momentum >= +12). Same base rate for every pick on purpose -
  // we have no per-country crystal ball and refuse to fake one.
  let dollars: string | null = null;
  const s = backtest?.sensitivity?.find((x) => x.minMomentum === 12);
  if (s && s.n && s.avgRawPct != null) {
    const end = Math.round(1000 * (1 + s.avgRawPct / 100));
    dollars = `$1,000 became about $${end.toLocaleString()} in 12 months for the average past signal (${s.n} cases)`;
  }
  return { horizon, dollars };
}

/** Shared caveat for the card footer, computed from the same file. */
export function moneyCaveat(backtest: BacktestFile | null): string | null {
  const s = backtest?.sensitivity?.find((x) => x.minMomentum === 12);
  if (!s || !s.n) return null;
  const worst = backtest!.events.reduce(
    (m, e) => Math.min(m, e.fwdReturnPct),
    Infinity,
  );
  return (
    `The dollar math is our own backtest of ${backtest!.events.length} past signals, survivors only, so it flatters. ` +
    `Only ${s.hitRate}% of signals beat a plain emerging-markets fund, and the worst one lost ${Math.abs(Math.round(worst))}%. ` +
    `It describes the past. It does not predict your future.`
  );
}
