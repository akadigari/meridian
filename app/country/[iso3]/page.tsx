import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCountry, getCurated, getDepth, nowYear } from '@/lib/data';
import { quantHistory } from '@/lib/scoring';
import { SignalBadge, FACTOR_ORDER, FACTOR_LABELS, scoreColor } from '@/components/ui';
import TrendCharts from '@/components/TrendCharts';
import Sparkline from '@/components/Sparkline';
import type { Confidence } from '@/lib/types';

export const dynamic = 'force-dynamic';

const CONF_LABEL: Record<Confidence, string> = {
  api: 'API DATA',
  curated: 'CURATED',
  proxy: 'PROXY',
  missing: 'NO DATA',
};

export default async function CountryPage({ params }: { params: Promise<{ iso3: string }> }) {
  const { iso3 } = await params;
  const data = getCountry(iso3);
  if (!data) notFound();
  const { scored, quant, curated } = data;
  const year = nowYear();
  const bondsNote = getCurated()?.bondsAccessNote;
  const history = quantHistory(quant, year - 12, year);
  const depth = curated?.access?.etfStatus === 'active' ? getDepth(curated.access.etfTicker) : null;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
        <Link href="/" className="mono xs muted">← screen</Link>
        <Link href={`/compare?a=${scored.iso3}&b=ARG`} className="mono xs muted">⇄ compare</Link>
        <h1 className="page-title" style={{ marginBottom: 0 }}>{scored.name.toUpperCase()}</h1>
        <span className="score-big" style={{ color: scoreColor(scored.composite), fontSize: 26 }}>
          {scored.composite?.toFixed(0) ?? '-'}
        </span>
        <SignalBadge signal={scored.signal} />
        {scored.turnaroundCandidate && <span className="badge turnaround">TURNAROUND CANDIDATE</span>}
        {scored.curated
          ? <span className="badge curated">CURATED {curated?.asOf}</span>
          : <span className="badge unrated">AUTOMATED ONLY</span>}
      </div>

      {!scored.curated && (
        <p className="callout" style={{ marginTop: 14 }}>
          This country has <b>no curated qualitative overlay</b> - the score is pure API data. The parallel-rate
          gap and &ldquo;serious reformer&rdquo; factors are unknown, bond-market trust is a balance-sheet proxy,
          and no SETUP/WATCH/STAND DOWN verdict is issued. Treat the number as a starting point for homework.
        </p>
      )}

      <div className="grid2" style={{ marginTop: 18 }}>
        {/* ── 5-factor scorecard ── */}
        <div className="panel panel-pad">
          <div className="panel-title">Five-factor scorecard</div>
          {FACTOR_ORDER.map((k) => {
            const f = scored.factors[k];
            return (
              <div className="factor-row" key={k}>
                <span className={`light ${f.light}`} style={{ marginTop: 6, flexShrink: 0 }} />
                <div className="factor-name">{FACTOR_LABELS[k]}</div>
                <div style={{ flex: 1 }}>
                  <div className="small dim">
                    {f.detail}
                    <span className={`conf-tag conf-${f.confidence}`}>{CONF_LABEL[f.confidence]}</span>
                  </div>
                  {f.asOf && <div className="muted xs">as of {f.asOf}</div>}
                </div>
                <div className="factor-score" style={{ color: scoreColor(f.score) }}>
                  {f.score?.toFixed(0) ?? '-'}
                </div>
              </div>
            );
          })}
          <div className="muted xs" style={{ marginTop: 10 }}>
            Weights: inflation 25 · currency 20 · bond trust 15 · fiscal 25 · reformer 15 (renormalized over
            available factors - see <Link href="/methodology">methodology</Link>). Momentum {scored.momentum != null ? `${scored.momentum > 0 ? '+' : ''}${scored.momentum.toFixed(1)}` : '-'}:{' '}
            {scored.momentumDetail}
          </div>
        </div>

        {/* ── kill criteria ── */}
        <div className="panel panel-pad">
          <div className="panel-title">Kill criteria - what would make this thesis wrong</div>
          {scored.killCriteria.map((k) => (
            <div className="kill-item" key={k.id}>
              <span className={`kill-status kill-${k.status}`}>
                {k.status === 'ok' ? '● HOLDS' : k.status === 'near' ? '▲ NEAR' : k.status === 'tripped' ? '✕ TRIPPED' : '? UNKNOWN'}
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{k.label}</div>
                <div className="dim xs">{k.detail}</div>
              </div>
            </div>
          ))}
          <div className="muted xs" style={{ marginTop: 10 }}>
            A kill criterion tripping means the reform setup is broken - the playbook says exit, not
            &ldquo;average down.&rdquo; {curated?.killCriteriaWatch?.length ? <>Curator notes: {curated.killCriteriaWatch.join(' · ')}</> : null}
          </div>
        </div>
      </div>

      {/* ── trend charts ── */}
      <TrendCharts inflation={quant.inflation} fiscal={quant.fiscal} fxOfficial={quant.fxOfficial} nowYear={year} />
      <p className="muted xs" style={{ marginTop: 6 }}>
        Parallel-rate gap and sovereign spread have no free historical API - Meridian tracks their <i>current</i> curated
        values (scorecard above) rather than pretending to chart them.
      </p>

      {history.length >= 3 && (
        <div className="panel panel-pad" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <span className="panel-title" style={{ marginBottom: 0 }}>Quant score history</span>
          <Sparkline points={history} />
          <span className="muted xs" style={{ maxWidth: 520 }}>
            The screen&rsquo;s quant-only score recomputed for each past year from the same IMF series - the level+trend
            math the momentum view uses, applied backwards. Annual data, so turns show up late.
          </span>
        </div>
      )}

      {curated && (
        <div className="grid2" style={{ marginTop: 16 }}>
          {/* ── situation report ── */}
          <div className="panel panel-pad">
            <div className="panel-title">Situation report (curated {curated.asOf})</div>
            <ul className="bullets small dim">
              {curated.developments.map((d, i) => <li key={i}>{renderWithLinks(d)}</li>)}
            </ul>
            {curated.imfProgram && (
              <>
                <hr className="sep" />
                <div className="small"><b className="mono xs">IMF</b> <span className="dim">{curated.imfProgram}</span></div>
              </>
            )}
            {curated.countryRisk.rating && (
              <div className="small" style={{ marginTop: 6 }}><b className="mono xs">RATING</b> <span className="dim">{curated.countryRisk.rating}</span></div>
            )}
          </div>

          {/* ── sources ── */}
          <div className="panel panel-pad">
            <div className="panel-title">Sources for the curated overlay</div>
            <ul className="plain source-list">
              {curated.sources.map((s, i) => (
                <li key={i}>
                  <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a>
                  {s.date && <span className="muted"> · {s.date}</span>}
                  {s.supports && <div className="muted xs">supports: {s.supports}</div>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ── how to actually play it ── */}
      <div className="panel panel-pad" style={{ marginTop: 16 }}>
        <div className="panel-title">How to actually play it - for a US retail investor</div>
        <div className="playbook-tier easy">
          <b className="mono xs" style={{ color: 'var(--green)' }}>EASY - US-LISTED ETF</b>
          <div className="small dim" style={{ marginTop: 4 }}>
            {curated?.access?.etfStatus === 'active' && curated.access.etfTicker ? (
              <>
                <b>{curated.access.etfTicker}</b> ({curated.access.etfName}) trades on US exchanges - one ticker in a
                normal brokerage account. It buys the local <i>stock market</i>, which is a leveraged bet on the
                macro turnaround but not the same thing: sector mix, index concentration, and the fund&rsquo;s FX
                treatment all add noise.{depth ? ` Depth gauge: it trades ${depth.pctBelowHigh >= 0 ? 'at' : `${Math.abs(depth.pctBelowHigh).toFixed(0)}% below`} its 5-year high (as of ${depth.asOf}); the closer to the high, the more of the story is already paid for.` : ''} {curated.access.accessNotes}
              </>
            ) : curated?.access?.etfStatus === 'closed' ? (
              <>The single-country ETF that used to cover this market (<b>{curated.access.etfTicker}</b>) has been <b>liquidated</b> - thin AUM is
                itself a signal about investability. {curated.access.accessNotes}</>
            ) : curated ? (
              <>No US-listed single-country ETF. {curated.access.accessNotes}</>
            ) : (
              <>Not curated - check whether a US-listed single-country ETF exists before assuming access.</>
            )}
          </div>
        </div>
        <div className="playbook-tier harder">
          <b className="mono xs" style={{ color: 'var(--yellow)' }}>HARDER - USD SOVEREIGN BONDS (&ldquo;paid to wait&rdquo;)</b>
          <div className="small dim" style={{ marginTop: 4 }}>
            {bondsNote ?? `Dollar-denominated sovereign bonds pay a fat coupon while you wait for the turnaround - if it comes, spreads
            compress and the bonds rally; if it doesn't, the coupon cushions (some of) the pain. But individual EM sovereigns are
            an awkward retail product: many US brokers don't offer them, minimum lots are often $1,000–$200,000, and pricing is
            opaque. Realistic access is a fund (EMB-style broad EM debt) - which dilutes the single-country thesis.`}
          </div>
        </div>
        <div className="playbook-tier bad">
          <b className="mono xs" style={{ color: 'var(--red)' }}>USUALLY A BAD IDEA - LOCAL CURRENCY</b>
          <div className="small dim" style={{ marginTop: 4 }}>
            Holding the local currency (or unhedged local-currency deposits/bonds) means fighting structural
            depreciation: high-inflation currencies fall against the dollar over time <i>by construction</i> - that&rsquo;s
            what inflation differentials do. The juicy local interest rate is compensation for that expected fall, not
            free money (ask anyone who did the carry trade into a devaluation). Even in successful turnarounds the
            currency often keeps sliding in nominal terms while stocks and USD bonds re-rate. Retail access is poor and
            spreads are wide - the playbook treats local currency as the weakest expression of this thesis.
          </div>
        </div>
        <p className="muted xs" style={{ marginTop: 8 }}>
          None of this is a recommendation - it&rsquo;s a map of the instruments and their honest trade-offs. Position
          sizing, entry, and whether to act at all are your call.
        </p>
      </div>

      {/* ── data quality ── */}
      <div className="panel panel-pad" style={{ marginTop: 16 }}>
        <div className="panel-title">Data quality</div>
        <div className="small dim">
          Factor coverage {scored.coverage}/5 · latest quant year {scored.dataYears.latest}
          {Number(scored.dataYears.latest) >= year && ' (IMF estimate, not an actual print)'} · momentum window vs {scored.dataYears.prior}.
          Quant factors are annual IMF WEO / World Bank data - public-data grade with a lag, not a Bloomberg terminal.
          {curated
            ? ` Curated overlay reviewed ${curated.asOf}; qualitative facts go stale fast - check the sources above before acting.`
            : ' No curated overlay: parallel-FX and reformer factors are simply unknown here.'}
        </div>
      </div>
    </>
  );
}

/** Renders "text [source: url]" development strings with a clickable link. */
function renderWithLinks(text: string) {
  const m = text.match(/^(.*?)\s*\[source:\s*(https?:\/\/\S+?)\s*\]\s*$/);
  if (!m) return text;
  return (
    <>
      {m[1]}{' '}
      <a href={m[2]} target="_blank" rel="noreferrer" className="xs mono">[src]</a>
    </>
  );
}
