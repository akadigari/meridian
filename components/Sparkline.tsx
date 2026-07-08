import { scoreColor } from './ui';

/** Tiny server-rendered score-history sparkline (no client JS, no deps). */
export default function Sparkline({
  points, width = 220, height = 40,
}: {
  points: { year: number; score: number }[];
  width?: number;
  height?: number;
}) {
  if (points.length < 3) return null;
  const xs = points.map((p) => p.year);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const pad = 3;
  const x = (yr: number) => pad + ((yr - minX) / (maxX - minX)) * (width - 2 * pad);
  const y = (s: number) => height - pad - (Math.max(0, Math.min(100, s)) / 100) * (height - 2 * pad);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.year).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const first = points[0];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <svg width={width} height={height} style={{ display: 'block' }} role="img"
        aria-label={`Quant score history ${first.year} to ${last.year}`}>
        <line x1={pad} x2={width - pad} y1={y(50)} y2={y(50)} stroke="#1d4a66" strokeDasharray="3 3" strokeWidth={0.75} />
        <path d={d} fill="none" stroke="#55c6dd" strokeWidth={1.6} />
        <circle cx={x(last.year)} cy={y(last.score)} r={2.6} fill={scoreColor(last.score)} />
      </svg>
      <span className="mono xs muted">
        {first.year}: {first.score.toFixed(0)} → {last.year}: <span style={{ color: scoreColor(last.score) }}>{last.score.toFixed(0)}</span>
      </span>
    </span>
  );
}
