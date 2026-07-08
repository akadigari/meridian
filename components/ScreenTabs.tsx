'use client';

// The big interactive table: leaderboard / momentum / map tabs, filters, sorting.
// Runs in the browser ('use client') because it responds to clicks.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ScoredCountry } from '@/lib/types';
import { FactorBars, MomentumCell, SignalBadge, scoreColor, FACTOR_ORDER, FACTOR_LABELS } from './ui';
import WorldMap from './WorldMap';

type View = 'leaderboard' | 'momentum' | 'map';
type Filter = 'all' | 'turnaround' | 'curated';
type SortKey = 'composite' | 'momentum' | 'name' | (typeof FACTOR_ORDER)[number];

// Module scope so React doesn't remount every header cell on each render.
function Th({
  k, sort, desc, onSort, children,
}: {
  k: SortKey; sort: SortKey; desc: boolean; onSort: (k: SortKey) => void; children: React.ReactNode;
}) {
  return (
    <th className={sort === k ? 'sorted' : ''} onClick={() => onSort(k)}>
      {children}{sort === k ? (desc ? ' ▾' : ' ▴') : ''}
    </th>
  );
}

export default function ScreenTabs({ countries, generatedAt }: { countries: ScoredCountry[]; generatedAt: string }) {
  const router = useRouter();
  const [view, setView] = useState<View>('leaderboard');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<SortKey>('composite');
  const [desc, setDesc] = useState(true);

  const filtered = useMemo(() => {
    let list = countries.filter((c) => c.composite != null);
    if (filter === 'turnaround') list = list.filter((c) => c.turnaroundCandidate);
    if (filter === 'curated') list = list.filter((c) => c.curated);
    const get = (c: ScoredCountry): number | string => {
      if (sort === 'name') return c.name;
      if (sort === 'composite') return c.composite ?? -1;
      if (sort === 'momentum') return c.momentum ?? -999;
      return c.factors[sort].score ?? -1;
    };
    list.sort((a, b) => {
      const va = get(a), vb = get(b);
      const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return desc ? -cmp : cmp;
    });
    return list;
  }, [countries, filter, sort, desc]);

  const clickSort = (k: SortKey) => {
    if (sort === k) setDesc(!desc);
    else { setSort(k); setDesc(k !== 'name'); }
  };
  const th = { sort, desc, onSort: clickSort };

  return (
    <>
      <div className="tabbar">
        <button className={`tab ${view === 'leaderboard' ? 'active' : ''}`} onClick={() => { setView('leaderboard'); setSort('composite'); setDesc(true); }}>
          Leaderboard
        </button>
        <button className={`tab ${view === 'momentum' ? 'active' : ''}`} onClick={() => { setView('momentum'); setSort('momentum'); setDesc(true); }}>
          Momentum
        </button>
        <button className={`tab ${view === 'map' ? 'active' : ''}`} onClick={() => setView('map')}>
          World Map
        </button>
        <span style={{ flex: 1 }} />
        <span className="chip-row" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {(['all', 'turnaround', 'curated'] as Filter[]).map((f) => (
            <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? `All (${countries.filter((c) => c.composite != null).length})` : f === 'turnaround' ? 'Turnaround candidates' : 'Curated shortlist'}
            </button>
          ))}
        </span>
      </div>

      {view === 'map' ? (
        <div className="panel panel-pad">
          <WorldMap countries={countries} />
        </div>
      ) : (
        <div className="panel" style={{ overflowX: 'auto' }}>
          <table className="data">
            <thead>
              <tr>
                <th style={{ cursor: 'default' }}>#</th>
                <Th k="name" {...th}>Country</Th>
                <Th k="composite" {...th}>Score</Th>
                {view === 'momentum' && <Th k="momentum" {...th}>Momentum Δ</Th>}
                <th style={{ cursor: 'default' }}>Factors</th>
                <Th k="inflation" {...th}>Inflation</Th>
                <Th k="currency" {...th}>Currency</Th>
                <Th k="bondTrust" {...th}>Bond&nbsp;trust</Th>
                <Th k="fiscal" {...th}>Fiscal</Th>
                <Th k="reformer" {...th}>Reformer</Th>
                {view === 'leaderboard' && <Th k="momentum" {...th}>Momentum Δ</Th>}
                <th style={{ cursor: 'default' }}>Signal</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.iso3} className="row" onClick={() => router.push(`/country/${c.iso3}`)}>
                  <td className="rank">{i + 1}</td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{c.name}</span>{' '}
                    <span className="muted mono xs">{c.iso3}</span>
                    {c.turnaroundCandidate && <span className="badge turnaround" style={{ marginLeft: 8 }}>TURNAROUND</span>}
                  </td>
                  <td>
                    <span className="score-big" style={{ color: scoreColor(c.composite) }}>
                      {c.composite?.toFixed(0) ?? '-'}
                    </span>
                  </td>
                  {view === 'momentum' && <td><MomentumCell v={c.momentum} /></td>}
                  <td><FactorBars c={c} /></td>
                  {FACTOR_ORDER.map((k) => (
                    <td key={k} className="mono" title={`${FACTOR_LABELS[k]} - ${c.factors[k].detail}`}>
                      <span style={{ color: scoreColor(c.factors[k].score) }}>
                        {c.factors[k].score?.toFixed(0) ?? '-'}
                      </span>
                      {c.factors[k].confidence === 'proxy' && <span className="muted xs" title="proxy - see methodology">*</span>}
                      {c.factors[k].confidence === 'curated' && <span className="xs" style={{ color: 'var(--blue)' }} title="curated overlay">†</span>}
                    </td>
                  ))}
                  {view === 'leaderboard' && <td><MomentumCell v={c.momentum} /></td>}
                  <td><SignalBadge signal={c.signal} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="muted xs" style={{ marginTop: 10 }}>
        Data: IMF + World Bank, snapshot {new Date(generatedAt).toISOString().slice(0, 10)} (current-year numbers
        are IMF estimates) · <span className="mono">*</span> = rough proxy · <span className="mono" style={{ color: 'var(--blue)' }}>†</span> = hand-researched
        with sources · Momentum = score change over two years · countries we have not researched by hand say UNRATED.
      </p>
    </>
  );
}
