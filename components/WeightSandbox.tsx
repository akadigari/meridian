'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { WEIGHTS } from '@/lib/scoring';
import { FACTOR_ORDER, FACTOR_LABELS, scoreColor } from './ui';

export interface SandboxCountry {
  iso3: string;
  name: string;
  curated: boolean;
  factors: Record<(typeof FACTOR_ORDER)[number], number | null>;
}

/** Weight sliders + live re-rank. The point: the ranking is a choice, and here is the dial. */
export default function WeightSandbox({ countries }: { countries: SandboxCountry[] }) {
  const [w, setW] = useState<Record<string, number>>({ ...WEIGHTS });

  const ranked = useMemo(() => {
    const out = countries.map((c) => {
      let ws = 0, ss = 0;
      for (const k of FACTOR_ORDER) {
        const s = c.factors[k];
        if (s != null && w[k] > 0) { ws += w[k]; ss += w[k] * s; }
      }
      return { ...c, composite: ws >= 45 ? ss / ws : null };
    }).filter((c) => c.composite != null);
    out.sort((a, b) => (b.composite ?? 0) - (a.composite ?? 0));
    return out.slice(0, 12);
  }, [countries, w]);

  const isDefault = FACTOR_ORDER.every((k) => w[k] === (WEIGHTS as Record<string, number>)[k]);

  return (
    <div className="grid2">
      <div>
        {FACTOR_ORDER.map((k) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0' }}>
            <span className="mono xs" style={{ width: 150, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {FACTOR_LABELS[k]}
            </span>
            <input
              type="range" min={0} max={40} step={1} value={w[k]}
              onChange={(e) => setW({ ...w, [k]: Number(e.target.value) })}
              style={{ flex: 1, accentColor: 'var(--accent)' }}
              aria-label={`${FACTOR_LABELS[k]} weight`}
            />
            <span className="mono small" style={{ width: 26, textAlign: 'right', color: 'var(--accent-bright)' }}>{w[k]}</span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
          <button className="btn ghost" style={{ padding: '6px 12px' }} onClick={() => setW({ ...WEIGHTS })} disabled={isDefault}>
            reset to shipped weights
          </button>
          <span className="muted xs">weights renormalize over available factors, same as the real engine</span>
        </div>
      </div>
      <div>
        <ol style={{ paddingLeft: 24 }}>
          {ranked.map((c) => (
            <li key={c.iso3} style={{ margin: '5px 0', fontSize: 13 }}>
              <Link href={`/country/${c.iso3}`} style={{ color: 'var(--text)' }}>{c.name}</Link>{' '}
              <span className="mono" style={{ color: scoreColor(c.composite) }}>{c.composite!.toFixed(0)}</span>
              {!c.curated && <span className="muted xs"> (uncurated)</span>}
            </li>
          ))}
        </ol>
        <p className="muted xs" style={{ marginTop: 8 }}>
          Top 12 under your weights{isDefault ? ' (currently the shipped ones)' : ''}. If a small nudge reshuffles the
          podium, treat the podium accordingly.
        </p>
      </div>
    </div>
  );
}
