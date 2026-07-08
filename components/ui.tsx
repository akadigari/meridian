import type { FactorScore, ScoredCountry, Signal } from '@/lib/types';

export function SignalBadge({ signal }: { signal: Signal }) {
  const cls =
    signal === 'SETUP INTACT' ? 'setup' : signal === 'WATCH' ? 'watch' : signal === 'STAND DOWN' ? 'stand' : 'unrated';
  return <span className={`badge ${cls}`}>{signal}</span>;
}

const LIGHT_COLOR: Record<FactorScore['light'], string> = {
  green: 'var(--green)',
  yellow: 'var(--yellow)',
  red: 'var(--red)',
  gray: 'var(--gray)',
};

export const FACTOR_ORDER = ['inflation', 'currency', 'bondTrust', 'fiscal', 'reformer'] as const;
export const FACTOR_LABELS: Record<(typeof FACTOR_ORDER)[number], string> = {
  inflation: 'Inflation falling',
  currency: 'Currency honesty',
  bondTrust: 'Bond-market trust',
  fiscal: 'Fiscal balance',
  reformer: 'Serious reformer',
};

/** Five mini bars, one per factor, heights = scores. */
export function FactorBars({ c }: { c: ScoredCountry }) {
  return (
    <span className="fbars" title={FACTOR_ORDER.map((k) => `${FACTOR_LABELS[k]}: ${c.factors[k].score?.toFixed(0) ?? '-'}`).join('\n')}>
      {FACTOR_ORDER.map((k) => {
        const f = c.factors[k];
        const h = f.score == null ? 2 : Math.max(2, (f.score / 100) * 20);
        return (
          <span
            key={k}
            className="fbar"
            style={{ height: `${h}px`, background: LIGHT_COLOR[f.light], opacity: f.score == null ? 0.35 : 0.95 }}
          />
        );
      })}
    </span>
  );
}

export function MomentumCell({ v }: { v: number | null }) {
  if (v == null) return <span className="mom-zero">-</span>;
  const cls = v > 1 ? 'mom-pos' : v < -1 ? 'mom-neg' : 'mom-zero';
  return <span className={cls}>{v > 0 ? '+' : ''}{v.toFixed(1)}</span>;
}

// Literal hexes (not CSS vars) because these also paint SVG `fill` attributes.
export function scoreColor(score: number | null): string {
  if (score == null) return '#46606c';
  if (score >= 70) return '#35d6a5';
  if (score >= 55) return '#8fce87';
  if (score >= 40) return '#e0c060';
  if (score >= 25) return '#e8925a';
  return '#f0645a';
}
