'use client';

// Renders the AI analyst's report: top pick, cited bull/bear cases, sources.

import { useState } from 'react';
import Link from 'next/link';
import type { Analysis, AnalysisClaim } from '@/lib/analyst';

function Cite({ source, sources }: { source: string; sources: Analysis['sources'] }) {
  if (source.startsWith('http')) {
    const idx = sources.findIndex((s) => s.url === source);
    return (
      <sup>
        <a href={source} target="_blank" rel="noreferrer" title={source}>
          [{idx >= 0 ? idx + 1 : 'src'}]
        </a>
      </sup>
    );
  }
  return <span className="muted xs mono" title="from the screen's factor data"> [{source}]</span>;
}

function ClaimList({ claims, sources, color }: { claims: AnalysisClaim[]; sources: Analysis['sources']; color: string }) {
  return (
    <ul className="bullets small" style={{ marginTop: 6 }}>
      {claims.map((c, i) => (
        <li key={i} className="analyst-claim dim" style={{ borderLeft: `2px solid ${color}`, paddingLeft: 10, listStyle: 'none', marginLeft: -18 }}>
          {c.claim}
          <Cite source={c.source} sources={sources} />
        </li>
      ))}
    </ul>
  );
}

export default function AnalystView({ initial, hasKey }: { initial: Analysis | null; hasKey: boolean }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/analyst', { method: 'POST' });
      const text = await res.text();
      let body: Analysis & { error?: string };
      try {
        body = JSON.parse(text);
      } catch {
        throw new Error(`HTTP ${res.status} - non-JSON response (gateway timeout?): ${text.slice(0, 120)}`);
      }
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setAnalysis(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!analysis) {
    return (
      <div className="panel panel-pad">
        <p className="dim small">
          No analysis has been generated yet. {hasKey
            ? 'Click regenerate to run one.'
            : 'Set ANTHROPIC_API_KEY in .env and restart, or check that data/analysis.json exists.'}
        </p>
        {hasKey && <button className="btn" style={{ marginTop: 10 }} onClick={regenerate} disabled={busy}>{busy ? 'Researching… (can take minutes)' : 'Generate analysis'}</button>}
        {error && <p className="callout warn" style={{ marginTop: 10 }}>{error}</p>}
      </div>
    );
  }

  const conf = analysis.topPick.confidence;
  const confN = conf === 'high' ? 3 : conf === 'medium' ? 2 : 1;

  return (
    <>
      <div className="callout" style={{ margin: '16px 0' }}>
        <b className="mono xs" style={{ color: 'var(--accent)' }}>AI ANALYSIS / OPINION</b> - grounded in the screen&rsquo;s
        factor data plus cited web research. It is a best guess with sources, <b>not</b> a prediction, a recommendation, or
        financial advice. Generated {new Date(analysis.generatedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC by{' '}
        {analysis.generatedBy}{analysis.method === 'build-time' ? ' (cached build-time run - regenerate for fresh research)' : ''}.
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <button className="btn" onClick={regenerate} disabled={busy || !hasKey}
          title={hasKey ? 'Re-run live research + analysis' : 'Set ANTHROPIC_API_KEY to enable live regeneration'}>
          {busy ? 'Researching… (can take minutes)' : 'Regenerate with live research'}
        </button>
        {!hasKey && <span className="muted xs">Set <code>ANTHROPIC_API_KEY</code> in <code>.env</code> to enable live regeneration.</span>}
        {error && <span className="xs" style={{ color: 'var(--red)' }}>{error}</span>}
      </div>

      <div className="panel panel-pad" style={{ borderColor: 'var(--accent-dim)' }}>
        <div className="panel-title" style={{ color: 'var(--accent)' }}>Top pick - best guess, not a promise</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <h2 className="mono" style={{ fontSize: 20 }}>
            <Link href={`/country/${analysis.topPick.iso3}`}>{analysis.topPick.country}</Link>
          </h2>
          <span className="mono xs muted">confidence:</span>
          <span className="confidence-meter" title={analysis.topPick.confidenceWhy}>
            {[1, 2, 3].map((n) => <span key={n} className={`confidence-pip ${n <= confN ? 'on' : ''}`} />)}
          </span>
          <span className="mono xs" style={{ color: 'var(--accent)' }}>{conf.toUpperCase()}</span>
        </div>
        <p className="small" style={{ margin: '10px 0 4px', maxWidth: 900 }}>{analysis.topPick.verdict}</p>
        <p className="muted xs">{analysis.topPick.confidenceWhy}</p>

        <div className="grid2" style={{ marginTop: 14 }}>
          <div>
            <div className="panel-title" style={{ color: 'var(--green)' }}>Bull case - every claim cited</div>
            <ClaimList claims={analysis.topPick.bullCase} sources={analysis.sources} color="var(--green)" />
          </div>
          <div>
            <div className="panel-title" style={{ color: 'var(--red)' }}>Bear case - what breaks it</div>
            <ClaimList claims={analysis.topPick.bearCase} sources={analysis.sources} color="var(--red)" />
          </div>
        </div>

        <hr className="sep" />
        <div className="small dim">
          <b className="mono xs" style={{ color: 'var(--yellow)' }}>ALREADY PRICED IN: </b>
          {analysis.topPick.pricedIn}
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="panel panel-pad">
          <div className="panel-title">Runners-up</div>
          {analysis.runnersUp.map((r) => (
            <div key={r.iso3} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <b><Link href={`/country/${r.iso3}`}>{r.country}</Link></b>
              <div className="small dim" style={{ marginTop: 3 }}>{r.summary}</div>
              <div className="xs" style={{ color: 'var(--red)', marginTop: 3 }}>Key risk: {r.keyRisk}</div>
            </div>
          ))}
        </div>
        <div className="panel panel-pad">
          <div className="panel-title">Evidence gaps - what the analyst could not verify</div>
          <ul className="bullets small dim">
            {analysis.evidenceGaps.map((g, i) => <li key={i}>{g}</li>)}
          </ul>
          <p className="muted xs" style={{ marginTop: 8 }}>
            Thin evidence is reported, not papered over. If this list is long, trust the analysis less.
          </p>
        </div>
      </div>

      <div className="panel panel-pad" style={{ marginTop: 16 }}>
        <div className="panel-title">Sources used ({analysis.sources.length})</div>
        <ol className="source-list" style={{ paddingLeft: 20 }}>
          {analysis.sources.map((s, i) => (
            <li key={i}>
              <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a>
              {s.date && <span className="muted"> · {s.date}</span>}
              <div className="muted xs mono" style={{ wordBreak: 'break-all' }}>{s.url}</div>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
