'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { ScoredCountry } from '@/lib/types';
import { scoreColor } from './ui';

interface Props {
  countries: ScoredCountry[];
}

interface GeoFeature {
  type: 'Feature';
  id?: string | number;
  properties: { iso3?: string; name?: string };
  geometry: GeoJSON.Geometry;
}

export default function WorldMap({ countries }: Props) {
  const router = useRouter();
  const [features, setFeatures] = useState<GeoFeature[] | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; c: ScoredCountry | null; name: string } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const byIso = useMemo(() => {
    const m = new Map<string, ScoredCountry>();
    for (const c of countries) m.set(c.iso3, c);
    return m;
  }, [countries]);

  useEffect(() => {
    let alive = true;
    fetch('/map/countries-110m.json')
      .then((r) => r.json())
      .then((topo) => {
        if (!alive) return;
        const fc = feature(topo, topo.objects.countries) as unknown as { features: GeoFeature[] };
        setFeatures(fc.features);
      })
      .catch(() => setFeatures([]));
    return () => { alive = false; };
  }, []);

  const W = 960, H = 470;
  const path = useMemo(() => {
    const proj = geoNaturalEarth1().fitExtent([[4, 4], [W - 4, H - 4]], { type: 'Sphere' });
    return geoPath(proj);
  }, []);

  if (!features) return <div className="dim small" style={{ padding: 40, textAlign: 'center' }}>Loading map…</div>;

  return (
    <div className="map-wrap" ref={wrapRef}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {features.map((f, i) => {
          const iso3 = f.properties.iso3;
          const c = iso3 ? byIso.get(iso3) : undefined;
          const fill = c?.composite != null ? scoreColor(c.composite) : '#0d2433';
          return (
            <path
              key={iso3 ?? i}
              d={path(f as never) ?? undefined}
              fill={fill}
              fillOpacity={c?.composite != null ? 0.78 : 1}
              stroke="#041019"
              strokeWidth={0.5}
              style={{ cursor: c ? 'pointer' : 'default' }}
              onMouseMove={(e) => {
                const rect = wrapRef.current?.getBoundingClientRect();
                if (!rect) return;
                setTip({
                  x: e.clientX - rect.left + 12,
                  y: e.clientY - rect.top + 12,
                  c: c ?? null,
                  name: c?.name ?? f.properties.name ?? 'Unknown',
                });
              }}
              onMouseLeave={() => setTip(null)}
              onClick={() => c && router.push(`/country/${c.iso3}`)}
            />
          );
        })}
      </svg>
      {tip && (
        <div className="map-tooltip" style={{ left: tip.x, top: tip.y }}>
          <div className="mono" style={{ fontWeight: 700 }}>{tip.name}</div>
          {tip.c ? (
            <>
              <div>
                Score: <span className="mono" style={{ color: scoreColor(tip.c.composite) }}>
                  {tip.c.composite?.toFixed(0) ?? '-'}
                </span>
                {' · '}Momentum: <span className="mono">{tip.c.momentum != null ? (tip.c.momentum > 0 ? '+' : '') + tip.c.momentum.toFixed(1) : '-'}</span>
              </div>
              <div className="muted xs">{tip.c.signal}{tip.c.curated ? ' · curated' : ' · automated only'} - click for detail</div>
            </>
          ) : (
            <div className="muted xs">No data</div>
          )}
        </div>
      )}
      <div className="legend" style={{ marginTop: 10, justifyContent: 'center' }}>
        <span>0</span>
        {[10, 25, 40, 55, 70, 85].map((s) => (
          <span key={s} className="legend-swatch" style={{ background: scoreColor(s) }} />
        ))}
        <span>100</span>
        <span style={{ marginLeft: 12 }}>■ gray = no data</span>
      </div>
    </div>
  );
}
