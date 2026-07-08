import Link from 'next/link';
import { getAnalysis, getScoredCountries, getCurated, getDepth } from '@/lib/data';
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

  return (
    <section className="topfive">
      <div className="topfive-head">
        <span className="topfive-title">
          <span className="trident">Ψ</span>THE TRIDENT FIVE
        </span>
        <span className="muted xs mono">
          the analyst&rsquo;s five picks, ranked · AI opinion grounded in the curated research, not advice
        </span>
      </div>
      {picks.slice(0, 5).map((p, i) => {
        const c = scored.get(p.iso3);
        const access = curated?.countries?.[p.iso3]?.access;
        const depth = access?.etfStatus === 'active' ? getDepth(access.etfTicker) : null;
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
        Ranking blends setup quality, momentum, and whether a US investor can actually express the trade. Every
        number traces to the curated overlay; the full cited bull and bear cases live in the{' '}
        <Link href="/analyst">Analyst</Link> tab. Generated {analysis!.generatedAt.slice(0, 10)}. A rank here is a
        judgment about the setup, not a forecast about the price.
      </div>
    </section>
  );
}
