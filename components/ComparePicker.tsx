'use client';

import { useRouter } from 'next/navigation';

export default function ComparePicker({
  options, a, b,
}: {
  options: { iso3: string; name: string }[];
  a: string;
  b: string;
}) {
  const router = useRouter();
  const nav = (na: string, nb: string) => router.push(`/compare?a=${na}&b=${nb}`);
  const selStyle: React.CSSProperties = {
    background: 'var(--bg-raised)', color: 'var(--text)', border: '1px solid var(--border-strong)',
    borderRadius: 6, padding: '7px 10px', fontFamily: 'var(--mono)', fontSize: 12,
  };
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', margin: '16px 0' }}>
      <select style={selStyle} value={a} onChange={(e) => nav(e.target.value, b)} aria-label="first country">
        {options.map((o) => <option key={o.iso3} value={o.iso3}>{o.name}</option>)}
      </select>
      <span className="mono" style={{ color: 'var(--accent)' }}>vs</span>
      <select style={selStyle} value={b} onChange={(e) => nav(a, e.target.value)} aria-label="second country">
        {options.map((o) => <option key={o.iso3} value={o.iso3}>{o.name}</option>)}
      </select>
      <button className="btn ghost" style={{ padding: '6px 12px' }} onClick={() => nav(b, a)}>⇄ swap</button>
    </div>
  );
}
