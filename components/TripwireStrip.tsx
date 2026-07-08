import Link from 'next/link';
import { getScoredCountries } from '@/lib/data';

const SHORT: Record<string, string> = {
  reformer: 'reformer', gap: 'currency gap', fiscal: 'budget', risk: 'country risk',
};

/** One quiet line, only when a curated country has a kill criterion near or tripped. */
export default function TripwireStrip() {
  const hot = getScoredCountries()
    .filter((c) => c.curated)
    .map((c) => ({
      c,
      tripped: c.killCriteria.filter((k) => k.status === 'tripped'),
      near: c.killCriteria.filter((k) => k.status === 'near'),
    }))
    .filter((x) => x.tripped.length || x.near.length);
  if (!hot.length) return null;

  return (
    <p className="xs mono" style={{ margin: '12px 2px 0', color: 'var(--yellow)' }}>
      ▲ TRIPWIRES{' '}
      {hot.map((x, i) => (
        <span key={x.c.iso3}>
        {i > 0 && <span className="muted"> · </span>}
          <Link href={`/country/${x.c.iso3}`} style={{ color: x.tripped.length ? 'var(--red)' : 'var(--yellow)' }}>
            {x.c.name}
          </Link>
          <span className="muted">
            {' ('}
            {[...x.tripped.map((k) => `${SHORT[k.id]} TRIPPED`), ...x.near.map((k) => `${SHORT[k.id]} near`)].join(', ')}
            {')'}
          </span>
        </span>
      ))}
      <span className="muted"> - detail on each country page</span>
    </p>
  );
}
