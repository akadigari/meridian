'use client';

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid,
} from 'recharts';
import type { Series } from '@/lib/types';

function seriesToRows(s: Series | undefined, from: number, to: number) {
  if (!s) return [];
  const rows: { year: string; value: number }[] = [];
  for (let y = from; y <= to; y++) {
    const v = s[String(y)];
    if (v != null && isFinite(v)) rows.push({ year: String(y), value: Math.round(v * 10) / 10 });
  }
  return rows;
}

function Chart({
  title, series, from, to, color, unit, estFrom, refZero,
}: {
  title: string;
  series: Series | undefined;
  from: number;
  to: number;
  color: string;
  unit: string;
  estFrom: number;
  refZero?: boolean;
}) {
  const rows = seriesToRows(series, from, to);
  if (rows.length < 3) {
    return (
      <div className="panel panel-pad">
        <div className="panel-title">{title}</div>
        <div className="muted small" style={{ padding: '30px 0', textAlign: 'center' }}>No data</div>
      </div>
    );
  }
  return (
    <div className="panel panel-pad">
      <div className="panel-title">{title}</div>
      <ResponsiveContainer width="100%" height={190}>
        <LineChart data={rows} margin={{ top: 6, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#0f2e40" vertical={false} />
          <XAxis dataKey="year" tick={{ fill: '#5f8089', fontSize: 10, fontFamily: 'monospace' }} tickLine={false} axisLine={{ stroke: '#1d4a66' }} />
          <YAxis tick={{ fill: '#5f8089', fontSize: 10, fontFamily: 'monospace' }} tickLine={false} axisLine={false} width={52} />
          <Tooltip
            contentStyle={{ background: '#071925', border: '1px solid #1d4a66', borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: '#93b2b6', fontFamily: 'monospace' }}
            formatter={(v: number) => [`${v}${unit}`, title]}
          />
          {refZero && <ReferenceLine y={0} stroke="#5f8089" strokeDasharray="4 3" />}
          <ReferenceLine x={String(estFrom)} stroke="#8a713b" strokeDasharray="3 3"
            label={{ value: 'IMF est. →', fill: '#8a713b', fontSize: 9, position: 'insideTopLeft' }} />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 2.5, fill: color }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function TrendCharts({
  inflation, fiscal, fxOfficial, nowYear,
}: {
  inflation?: Series;
  fiscal?: Series;
  fxOfficial?: Series;
  nowYear: number;
}) {
  const from = nowYear - 9;
  return (
    <div className="grid3" style={{ marginTop: 16 }}>
      <Chart title="Inflation, % (IMF WEO)" series={inflation} from={from} to={nowYear + 1} color="#f0645a" unit="%" estFrom={nowYear - 1} />
      <Chart title="Fiscal balance, % of GDP" series={fiscal} from={from} to={nowYear + 1} color="#35d6a5" unit="% GDP" estFrom={nowYear - 1} refZero />
      <Chart title="Official FX, LCU per USD (World Bank)" series={fxOfficial} from={from} to={nowYear} color="#55c6dd" unit="" estFrom={nowYear} />
    </div>
  );
}
