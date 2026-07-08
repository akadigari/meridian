import { getBacktest } from '@/lib/data';

/** The hindsight event study, rendered warts-first. */
export default function BacktestPanel() {
  const bt = getBacktest();
  if (!bt) {
    return (
      <div className="panel panel-pad" style={{ marginTop: 16 }}>
        <div className="panel-title">Does the playbook actually work? (hindsight event study)</div>
        <p className="small dim">
          Not generated yet: run <code>npm run fetch-prices</code> then <code>npm run backtest</code>.
        </p>
      </div>
    );
  }

  const primary = bt.sensitivity.find((s) => s.minMomentum === 12) ?? bt.sensitivity[0];

  return (
    <div className="panel panel-pad" style={{ marginTop: 16 }}>
      <div className="panel-title">Does the playbook actually work? The honest math (hindsight event study)</div>
      <p className="small dim" style={{ maxWidth: 880 }}>
        We replayed the screen&rsquo;s own signal backwards over every country with a live US ETF: distress two years
        ago (the TURNAROUND thresholds), strong quant-score improvement since, buy the following April, hold 12
        months, measure against EEM. The answer across {bt.events.length} events:{' '}
        <b style={{ color: 'var(--text)' }}>
          a {primary.hitRate}% hit rate and about {primary.avgExcessPct !== undefined && primary.avgExcessPct >= 0 ? '+' : ''}{primary.avgExcessPct}% average excess return
        </b>{' '}
        - a mild lean, not an edge. We show it because an honest tool reports its own weak evidence instead of
        implying a backtest it does not have.
      </p>

      <div className="grid2" style={{ marginTop: 12 }}>
        <div>
          <div className="panel-title">Sensitivity (nothing is fitted)</div>
          <table className="data">
            <thead>
              <tr>
                <th style={{ cursor: 'default' }}>Momentum ≥</th>
                <th style={{ cursor: 'default' }}>n</th>
                <th style={{ cursor: 'default' }}>Hit rate</th>
                <th style={{ cursor: 'default' }}>Avg excess</th>
                <th style={{ cursor: 'default' }}>Median</th>
              </tr>
            </thead>
            <tbody>
              {bt.sensitivity.map((s) => (
                <tr key={s.minMomentum}>
                  <td className="mono">+{s.minMomentum}</td>
                  <td className="mono">{s.n}</td>
                  <td className="mono">{s.hitRate ?? '-'}%</td>
                  <td className="mono" style={{ color: (s.avgExcessPct ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {(s.avgExcessPct ?? 0) >= 0 ? '+' : ''}{s.avgExcessPct}%
                  </td>
                  <td className="mono">{(s.medianExcessPct ?? 0) >= 0 ? '+' : ''}{s.medianExcessPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="panel-title" style={{ marginTop: 16 }}>Why you should not trust this too much</div>
          <ul className="bullets xs dim">
            {bt.caveats.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div className="panel-title">Every event, best momentum first</div>
          <table className="data" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ cursor: 'default' }}>ETF</th>
                <th style={{ cursor: 'default' }}>Signal yr</th>
                <th style={{ cursor: 'default' }}>Mom.</th>
                <th style={{ cursor: 'default' }}>12m return</th>
                <th style={{ cursor: 'default' }}>vs EEM</th>
              </tr>
            </thead>
            <tbody>
              {bt.events.map((e) => (
                <tr key={`${e.ticker}${e.year}`} title={`${e.country}: ${e.distress}; window ${e.window}`}>
                  <td className="mono">{e.ticker}</td>
                  <td className="mono">{e.year}</td>
                  <td className="mono">+{e.momentum.toFixed(0)}</td>
                  <td className="mono">{e.fwdReturnPct >= 0 ? '+' : ''}{e.fwdReturnPct}%</td>
                  <td className="mono" style={{ color: e.excessPct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {e.excessPct >= 0 ? '+' : ''}{e.excessPct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted xs" style={{ marginTop: 8 }}>
            Hover a row for the distress detail and trade window. The Greece 2013 row (-52% vs EEM) is the museum
            piece: a screen that looked right and a country that broke anyway. Generated {bt.generatedAt.slice(0, 10)};
            method and thresholds in <code>scripts/backtest.mjs</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
