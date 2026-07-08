import Link from 'next/link';
import { WEIGHTS, SIGNAL_BANDS, MOMENTUM_WINDOW } from '@/lib/scoring';
import { getSnapshot, getCurated, getScoredCountries } from '@/lib/data';
import { FACTOR_ORDER } from '@/components/ui';
import WeightSandbox, { type SandboxCountry } from '@/components/WeightSandbox';
import BacktestPanel from '@/components/BacktestPanel';

export const dynamic = 'force-dynamic';

export default function MethodologyPage() {
  const snap = getSnapshot();
  const curated = getCurated();
  const sandbox: SandboxCountry[] = getScoredCountries()
    .filter((c) => c.composite != null)
    .map((c) => ({
      iso3: c.iso3,
      name: c.name,
      curated: c.curated,
      factors: Object.fromEntries(FACTOR_ORDER.map((k) => [k, c.factors[k].score])) as SandboxCountry['factors'],
    }));

  return (
    <>
      <h1 className="page-title">METHODOLOGY - READ THIS BEFORE TRUSTING A NUMBER</h1>

      <div className="panel panel-pad" style={{ marginTop: 18 }}>
        <div className="panel-title">The thesis, stated honestly</div>
        <p className="small dim" style={{ maxWidth: 880 }}>
          When a broke, high-inflation country gets a serious reformer who fixes the fundamentals - kills the
          deficit, frees the currency, crushes inflation - its assets can re-rate upward, and investors who
          recognized the setup early can benefit. Argentina 2024–25 is the template everyone has in mind.
          Meridian scores every country on how well it currently fits that template. That is <i>all</i> it does.
          It is a <b>discretionary screening heuristic</b>: the pattern is real but rare, the sample size of clean
          historical cases is small, nothing here is backtested as a trading strategy, and a high score is a
          <b> continuation bet</b> - it says the setup ranks well <i>today</i>, after the market has had time to
          notice. It does not say the assets are cheap, and it is not financial advice.
        </p>
      </div>

      <div className="panel panel-pad" style={{ marginTop: 16 }} id="glossary">
        <div className="panel-title">The 60-second glossary - every term on this site, translated</div>
        <div className="grid2">
          <ul className="bullets small dim">
            <li><b>Inflation</b>: how fast prices rise. 2% is calm; 200% means money loses half its value in months. &ldquo;Falling&rdquo; is the whole game here.</li>
            <li><b>Fiscal balance / deficit / surplus</b>: what a government earns minus what it spends, as a share of the economy (GDP). Spending more than you earn = deficit. Chronic deficits get financed by printing money, which causes the inflation above.</li>
            <li><b>Parallel (black-market) exchange rate</b>: when a government pretends its currency is worth more than it is, a street market appears with the real price. The gap between the official and street rate measures how big the lie is.</li>
            <li><b>Sovereign spread</b>: the extra interest a country must pay to borrow dollars compared to the US government. 400bps = 4 percentage points extra. Big spread = lenders expect default.</li>
            <li><b>bps (basis points)</b>: hundredths of a percentage point. 100bps = 1%.</li>
          </ul>
          <ul className="bullets small dim">
            <li><b>IMF program</b>: an emergency loan from the International Monetary Fund that comes with homework - the country must hit agreed targets to keep receiving money. Passing &ldquo;reviews&rdquo; is evidence the reform is real.</li>
            <li><b>ETF</b>: a fund that trades like a single stock and holds a whole country&rsquo;s stock market. The easiest window into how investors feel about a country.</li>
            <li><b>Re-rate</b>: when markets decide a country is less risky than they thought and reprice everything upward at once.</li>
            <li><b>Composite score</b>: our 0–100 weighted average of the five factor scores.</li>
            <li><b>Momentum</b>: today&rsquo;s quant score minus the score two years ago. Positive = the story is improving; the leaderboard tells you who is good, momentum tells you who is <i>getting</i> good.</li>
          </ul>
        </div>
        <p className="muted xs" style={{ marginTop: 6 }}>
          Reading the code instead? There is a beginner-friendly tour of every file in <code>docs/CODE_TOUR.md</code>.
        </p>
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="panel panel-pad">
          <div className="panel-title">The five factors &amp; weights</div>
          <table className="data">
            <thead><tr><th style={{ cursor: 'default' }}>Factor</th><th style={{ cursor: 'default' }}>Weight</th><th style={{ cursor: 'default' }}>Source</th></tr></thead>
            <tbody>
              <tr><td>Inflation falling <span className="muted xs">(45% level / 55% trajectory)</span></td><td className="mono">{WEIGHTS.inflation}</td><td><span className="conf-tag conf-api">API</span> IMF WEO</td></tr>
              <tr><td>Currency honesty <span className="muted xs">(parallel gap where curated; else depreciation proxy)</span></td><td className="mono">{WEIGHTS.currency}</td><td><span className="conf-tag conf-curated">CURATED</span> + <span className="conf-tag conf-proxy">PROXY</span></td></tr>
              <tr><td>Bond-market trust <span className="muted xs">(spread where curated; else balance-sheet proxy)</span></td><td className="mono">{WEIGHTS.bondTrust}</td><td><span className="conf-tag conf-curated">CURATED</span> + <span className="conf-tag conf-proxy">PROXY</span></td></tr>
              <tr><td>Fiscal balance <span className="muted xs">(60% level / 40% trajectory)</span></td><td className="mono">{WEIGHTS.fiscal}</td><td><span className="conf-tag conf-api">API</span> IMF WEO</td></tr>
              <tr><td>Serious reformer</td><td className="mono">{WEIGHTS.reformer}</td><td><span className="conf-tag conf-curated">CURATED</span> only</td></tr>
            </tbody>
          </table>
          <p className="muted xs" style={{ marginTop: 10 }}>
            Missing factors renormalize the remaining weights (a country needs ≥45 weight-points of real data to get
            a composite at all). Every curve and threshold lives in <code>lib/scoring.ts</code> - one commented file.
            Change it, re-rank, disagree: that&rsquo;s the intended workflow.
          </p>
        </div>

        <div className="panel panel-pad">
          <div className="panel-title">Automated vs curated - where each number comes from</div>
          <ul className="bullets small dim">
            <li><b>Automated (all ~{Object.keys(snap.countries).length} countries):</b> inflation, fiscal balance, growth,
              current account, debt from the IMF WEO DataMapper (annual; current-year values are IMF <i>estimates</i>);
              reserves and official FX from the World Bank. These drive the all-country ranking.</li>
            <li><b>Curated overlay ({curated ? Object.keys(curated.countries).length : 0} shortlist countries, as of {curated?.asOf ?? '-'}):</b> parallel-rate
              gap, sovereign spread, reformer identity/credibility, IMF program, ETF access - researched by hand
              with sources attached, because no free API publishes them. Marked <span className="conf-tag conf-curated">CURATED</span> everywhere.</li>
            <li><b>Proxies (everything else):</b> where a curated value doesn&rsquo;t exist, currency honesty falls back to
              official-rate depreciation (blind to rigged pegs!) and bond trust to a reserves/current-account/debt/growth
              composite (balance-sheet health, not the market&rsquo;s opinion). Marked <span className="conf-tag conf-proxy">PROXY</span> and
              scored with no pretense of being the real thing.</li>
            <li><b>Signals (SETUP INTACT / WATCH / STAND DOWN) exist only for curated countries.</b> Everything else is
              UNRATED: we&rsquo;ll give a score from public data, but a verdict requires the qualitative homework.</li>
          </ul>
        </div>
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="panel panel-pad">
          <div className="panel-title">Momentum - catching the next one early</div>
          <p className="small dim">
            The leaderboard ranks <b>level</b>: who fits the playbook <i>now</i>. Momentum ranks <b>rate of change</b>:
            the quant-only score today minus the same score {MOMENTUM_WINDOW} years ago. A country at 45 that was at
            25 is a more interesting turnaround candidate than one sitting at 70 for a decade - the whole edge, if
            there is one, is recognizing improvement before it&rsquo;s consensus. The TURNAROUND badge marks countries
            that were in genuine macro distress (inflation ≥20% or deficit ≤−5% of GDP) {MOMENTUM_WINDOW} years ago,
            so stable rich countries don&rsquo;t masquerade as reform stories.
          </p>
        </div>
        <div className="panel panel-pad">
          <div className="panel-title">Signals &amp; kill criteria</div>
          <p className="small dim">
            SETUP INTACT (composite ≥{SIGNAL_BANDS.setupIntact}, live reformer, nothing tripped, and <i>all four kill
            criteria monitorable</i> - if we can&rsquo;t watch an exit condition, we don&rsquo;t hand out the full green
            light) · WATCH (≥{SIGNAL_BANDS.watch}, or something near/unknown) · STAND DOWN (kill criterion tripped or
            composite &lt;{SIGNAL_BANDS.watch}).
            The kill criteria are the discipline half of the playbook: <b>reformer loses power · currency gap reopens
            (&gt;8% near, &gt;15% tripped) · budget flips back to deficit (or deteriorates &gt;1.5pp) · country risk
            blows out (near: &gt;700bps, or &gt;500bps and rising; tripped: &gt;900bps, or &gt;800bps and rising)</b>.
            Each country page shows which are close. A tripped criterion means the thesis is broken - the playbook
            answer is exit, not hope.
          </p>
        </div>
      </div>

      <div className="panel panel-pad" style={{ marginTop: 16 }}>
        <div className="panel-title">Disagree with the weights? Prove it (live sandbox)</div>
        <p className="small dim" style={{ maxWidth: 880, marginBottom: 12 }}>
          The five weights are judgment calls, so here is the dial instead of a defense. Drag and watch the top 12
          re-rank in real time, using the exact factor scores and renormalization the engine uses. This changes
          nothing in the app; it exists to show how much (or little) the podium depends on our choices.
        </p>
        <WeightSandbox countries={sandbox} />
      </div>

      <BacktestPanel />

      <div className="panel panel-pad" style={{ marginTop: 16 }}>
        <div className="panel-title">The AI analyst</div>
        <p className="small dim" style={{ maxWidth: 880 }}>
          The <Link href="/analyst">analyst</Link> feeds the top-ranked countries&rsquo; factor data plus live web research
          (via Claude&rsquo;s server-side web-search tool) into an LLM and demands: a top pick with runners-up, a bull case
          and a bear case where <b>every claim cites a data point or URL</b>, an explicit &ldquo;what&rsquo;s already priced
          in,&rdquo; a confidence level, and a list of what it could not verify. It is labeled AI opinion because that is
          what it is. LLMs can misread sources and web results can be wrong or stale - the citations exist so you can
          check them, and you should.
        </p>
      </div>

      <div className="panel panel-pad" style={{ marginTop: 16 }}>
        <div className="panel-title">What this tool can and cannot tell you</div>
        <div className="grid2">
          <div>
            <b className="mono xs" style={{ color: 'var(--green)' }}>CAN</b>
            <ul className="bullets small dim">
              <li>Rank all countries on the same reform-playbook yardstick, with the reasoning inspectable.</li>
              <li>Spot improving fundamentals (momentum) that headlines haven&rsquo;t caught up with.</li>
              <li>Tell you exactly which numbers are real data, which are curated judgment, and which are proxies.</li>
              <li>Give you explicit exit conditions instead of vibes.</li>
            </ul>
          </div>
          <div>
            <b className="mono xs" style={{ color: 'var(--red)' }}>CANNOT</b>
            <ul className="bullets small dim">
              <li>Tell you whether the trade is already priced in - valuation is not in the model at all.</li>
              <li>See intra-year turns: quant data is annual with IMF estimates; a coup or devaluation shows up here last.</li>
              <li>Replace a Bloomberg terminal: no market prices, no positioning, no flows, no real-time spreads.</li>
              <li>Predict anything. The score describes the setup; outcomes are politics, luck, and prices.</li>
            </ul>
          </div>
        </div>
        <p className="muted xs" style={{ marginTop: 8 }}>
          Data snapshot {snap.generatedAt.slice(0, 10)}. Sources: {Object.values(snap.sources).filter(Boolean).map((s) => s!.name).join(' · ')}.
          Public-data grade - expect revisions, lags, and the occasional howler.
        </p>
      </div>
    </>
  );
}
