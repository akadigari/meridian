import Link from 'next/link';
import { getAnalysis, getScoredCountries, getCurated, getDepth, getBacktest, nowYear } from '@/lib/data';
import { pickMath, moneyCaveat } from '@/lib/pickmath';
import { SignalBadge, scoreColor } from './ui';
import type { Analysis } from '@/lib/analyst';

const NUMERALS = ['I', 'II', 'III', 'IV', 'V'];

/** The Trident Five: the analyst's ranked top picks, one line of why + the key risk. */
export default function TopFive() {
  const analysis = getAnalysis() as unknown as Analysis | null;
  const picks = analysis?.topFive;
  if (!picks?.length) return null;
  const scored = new Map(getScoredCountries().map((c) => [c.iso3, c]));
  const curated = getCurated();
  const backtest = getBacktest();
  const year = nowYear();
  const caveat = moneyCaveat(backtest);

  return (
    <section className="topfive">
      <div className="topfive-head">
        <span className="topfive-title">
          <span className="trident">Ψ</span>THE TRIDENT FIVE
        </span>
        <span className="muted xs mono">
          our five favorite reform stories, ranked · AI opinion with sources · not advice
        </span>
      </div>
      {picks.slice(0, 5).map((p, i) => {
        const c = scored.get(p.iso3);
        const cur = curated?.countries?.[p.iso3];
        const access = cur?.access;
        const depth = access?.etfStatus === 'active' ? getDepth(access.etfTicker) : null;
        const math = pickMath(cur, backtest, year);
        return (
          <div className="topfive-row" key={p.iso3}>
            <div className="topfive-rank">{NUMERALS[i]}</div>
            <div className="topfive-body">
              <div className="topfive-country">
                <Link href={`/country/${p.iso3}`}>{p.country}</Link>
              </div>
              <div className="topfive-why">{p.why}</div>
              <div className="topfive-risk">
                <b>KEY RISK · </b>
                {p.keyRisk}
              </div>
              <div className="topfive-math muted xs">
                <b className="mono" style={{ fontSize: 9.5, letterSpacing: '0.08em' }}>HOW LONG · </b>
                {math.horizon}
                {math.dollars && (
                  <>
                    {' '}<b className="mono" style={{ fontSize: 9.5, letterSpacing: '0.08em' }}>· THE MATH · </b>
                    {math.dollars}
                  </>
                )}
              </div>
            </div>
            <div className="topfive-meta">
              {c && (
                <span className="score-big" style={{ color: scoreColor(c.composite) }}>
                  {c.composite?.toFixed(0) ?? ''}
                </span>
              )}
              {c && <SignalBadge signal={c.signal} />}
              {depth && (
                <span className="muted xs mono" title={`${access!.etfTicker} vs its 5y high, as of ${depth.asOf}`}>
                  {access!.etfTicker} {depth.pctBelowHigh >= 0 ? 'at' : `${Math.abs(depth.pctBelowHigh).toFixed(0)}% under`} 5y high
                </span>
              )}
            </div>
          </div>
        );
      })}
      <div className="topfive-foot muted xs">
        {caveat ? caveat + ' ' : ''}Ranks weigh the story, the momentum, and whether you can actually buy it.
        Full sources in the <Link href="/analyst">Analyst</Link> tab. Updated {analysis!.generatedAt.slice(0, 10)}.
      </div>
    </section>
  );
}
