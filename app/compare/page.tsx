import Link from 'next/link';
import { getCountry, getScoredCountries, nowYear } from '@/lib/data';
import { quantHistory } from '@/lib/scoring';
import { SignalBadge, FACTOR_ORDER, FACTOR_LABELS, scoreColor, MomentumCell } from '@/components/ui';
import Sparkline from '@/components/Sparkline';
import ComparePicker from '@/components/ComparePicker';

export const dynamic = 'force-dynamic';

function Column({ iso3 }: { iso3: string }) {
  const data = getCountry(iso3);
  if (!data) return <div className="panel panel-pad muted">Unknown country: {iso3}</div>;
  const { scored, quant } = data;
  const year = nowYear();
  const history = quantHistory(quant, year - 12, year);
  return (
    <div className="panel panel-pad">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h2 className="serif" style={{ fontSize: 19, letterSpacing: '0.05em' }}>
          <Link href={`/country/${scored.iso3}`} style={{ color: 'var(--text)' }}>{scored.name}</Link>
        </h2>
        <span className="score-big" style={{ color: scoreColor(scored.composite), fontSize: 22 }}>
          {scored.composite?.toFixed(0) ?? '-'}
        </span>
        <SignalBadge signal={scored.signal} />
      </div>
      <div className="mono xs muted" style={{ margin: '4px 0 10px' }}>
        momentum <MomentumCell v={scored.momentum} /> · coverage {scored.coverage}/5
        {scored.curated ? ' · curated' : ' · automated only'}
      </div>
      {FACTOR_ORDER.map((k) => {
        const f = scored.factors[k];
        return (
          <div className="factor-row" key={k} style={{ padding: '9px 0' }}>
            <span className={`light ${f.light}`} style={{ marginTop: 5, flexShrink: 0 }} />
            <div className="factor-name" style={{ width: 130 }}>{FACTOR_LABELS[k]}</div>
            <div className="factor-score" style={{ color: scoreColor(f.score) }}>{f.score?.toFixed(0) ?? '-'}</div>
          </div>
        );
      })}
      <div style={{ marginTop: 12 }}>
        {history.length >= 3
          ? <Sparkline points={history} width={190} height={34} />
          : <span className="muted xs">no score history</span>}
      </div>
      <div className="xs dim" style={{ marginTop: 10 }}>
        Kill criteria: {scored.killCriteria.map((kc) => `${kc.label.split(' ')[0].toLowerCase()} ${kc.status}`).join(' · ')}
      </div>
    </div>
  );
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const { a = 'ARG', b = 'GHA' } = await searchParams;
  const options = getScoredCountries()
    .filter((c) => c.composite != null)
    .map((c) => ({ iso3: c.iso3, name: c.name }))
    .sort((x, y) => x.name.localeCompare(y.name));

  return (
    <>
      <h1 className="page-title">THE DUEL</h1>
      <p className="page-sub">
        Two countries, factor by factor, on the same yardstick. Hover nothing, trust nothing: click through to the
        country pages for the detail and the sources behind every number.
      </p>
      <ComparePicker options={options} a={a.toUpperCase()} b={b.toUpperCase()} />
      <div className="grid2">
        <Column iso3={a.toUpperCase()} />
        <Column iso3={b.toUpperCase()} />
      </div>
    </>
  );
}
