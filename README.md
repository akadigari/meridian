<p align="center">
  <img src="docs/banner.svg" alt="Meridian - reform-turnaround macro screen" width="100%"/>
</p>

<p align="center">
  <img src="https://github.com/emirichu/meridian/actions/workflows/ci.yml/badge.svg" alt="ci"/>
  <img src="https://github.com/emirichu/meridian/actions/workflows/refresh-data.yml/badge.svg" alt="data refresh"/>
  <img src="https://img.shields.io/badge/next.js-15-0e2c3f?style=flat-square&logo=nextdotjs&logoColor=e8c877" alt="Next.js 15"/>
  <img src="https://img.shields.io/badge/data-auto--refreshes%20weekly-35d6a5?style=flat-square" alt="auto-refresh"/>
  <img src="https://img.shields.io/badge/api%20keys-none%20required-55c6dd?style=flat-square" alt="no keys"/>
  <img src="https://img.shields.io/badge/backtest-honest%20(thin%20edge)-e0c060?style=flat-square" alt="honest backtest"/>
  <img src="https://img.shields.io/badge/financial%20advice-absolutely%20not-f0645a?style=flat-square" alt="not advice"/>
  <img src="https://img.shields.io/badge/license-MIT-8a713b?style=flat-square" alt="MIT"/>
</p>

# Meridian

Screens **every country on Earth** for "reform-turnaround" potential (the Argentina-Milei playbook:
kill the deficit, free the currency, crush inflation), ranks them 0-100 on live IMF and World Bank
data, curates the qualitative layer with sources, and ships an AI analyst whose every claim carries
a citation. Zero API keys needed. Styled like an observatory recovered from the sea floor.

> A discretionary macro screening heuristic. Not a backtested edge. Not financial advice.
> A high score means "ranks well on the reform-playbook fundamentals", NOT "will make money."
> The methodology page even backtests itself against its own thesis and reports the thin result.

---

## The thesis

When a broke, high-inflation country gets a serious reformer who fixes the fundamentals - kills the
deficit, frees the currency, crushes inflation - its assets can re-rate upward, and investors who
recognized the setup early can benefit. Argentina 2024–25 (Milei: fiscal surplus, crawling-peg exit,
inflation from 25%/month to low single digits, ARGT more than doubling) is the template.

Honest caveats, stated up front and repeated inside the app:

- The pattern is real but **rare**, and the sample of clean historical cases is tiny.
- Nothing here is backtested as a strategy. The scoring curves are judgment calls.
- By the time a country *screens well*, part of the move has usually happened. A high score /
  "SETUP INTACT" is a **continuation bet** - the setup holds - not evidence the asset is cheap.
  Valuation is not in the model at all.
- The quant data is annual (IMF WEO, with current-year values being IMF **estimates**). A coup or a
  devaluation shows up in headlines months before it shows up here.

## What it does

| Feature | Where |
|---|---|
| The Trident Five: the analyst's ranked top picks with why + key risk | `/` (top card) |
| Tripwire strip: curated countries with kill criteria near/tripped | `/` (only when non-empty) |
| All-country screen, ranked leaderboard with factor breakdown | `/` (Leaderboard tab) |
| Momentum view - rate of change, who's improving fastest | `/` (Momentum tab) |
| World map heatmap, click-through to country detail | `/` (Map tab) |
| Country card: 5-factor scorecard, signal, kill criteria, trend charts, score-history sparkline, ETF depth gauge, "how to play it" | `/country/ARG` etc. |
| The Duel: two countries side by side, factor by factor | `/compare?a=ARG&b=GHA` |
| Weight sandbox (re-rank live) + hindsight event-study backtest | `/methodology` |
| AI analyst: cited best-guess with bull/bear case, confidence, priced-in note | `/analyst` |
| Methodology / honesty page | `/methodology` |
| JSON API | `GET /api/countries`, `GET /api/country/:iso3`, `GET/POST /api/analyst` |

## The five factors (weights in `lib/scoring.ts`)

| # | Factor | Weight | Source |
|---|---|---|---|
| A | **Inflation falling** - 45% level, 55% trajectory | 25 | IMF WEO (automated, all countries) |
| B | **Currency honesty** - official-vs-parallel gap | 20 | Curated gap on shortlist; official-depreciation **proxy** elsewhere |
| C | **Bond-market trust** - sovereign USD spread | 15 | Curated spread on shortlist; balance-sheet **proxy** elsewhere |
| D | **Fiscal balance** - 60% level, 40% trajectory | 25 | IMF WEO (automated, all countries) |
| E | **Serious reformer in power** | 15 | **Curated only** - no API measures political will |

**Automated vs curated - the honest split.** Factors A and D are pure API data for ~197 countries.
Factors B, C, E rely on things no free API publishes (parallel rates, EMBI spreads, "is this person
for real"), so Meridian hand-curates them **with sources attached** for a shortlist of active reform
stories (`data/curated.json`), and everywhere else either uses a clearly-labeled proxy or admits
ignorance. Every number in the UI is tagged `API` / `CURATED` / `PROXY` / `NO DATA`. Countries
without the curated overlay are **UNRATED** - they get a score, not a verdict, because a verdict
without the qualitative homework would be fake precision.

**Momentum.** The leaderboard ranks *level* (who fits the playbook now). The momentum view ranks
*rate of change* (quant-only score today minus ~2 years ago) - catching the next turnaround while
it's still mid-swing is the entire point of the exercise. The `TURNAROUND` badge marks countries
that were in genuine distress (inflation ≥20% or deficit ≤−5% GDP) two years ago, so stable rich
countries don't read as reform stories.

**Signals & kill criteria.** Curated countries get SETUP INTACT / WATCH / STAND DOWN, driven by the
composite plus four explicit kill criteria: reformer loses power · currency gap reopens (>8% near,
>15% tripped) · budget flips back to deficit (or deteriorates >1.5pp over the window) · country
risk blows out (near: >700bps, or >500bps and rising; tripped: >900bps, or >800bps and rising).
SETUP INTACT additionally requires all four criteria to be *monitorable* - if we can't watch an
exit condition (no spread data, no gap number), the best a country can get is WATCH. Each country
page shows which are close to tripping. Tripped = thesis broken = the playbook says exit, not
"average down."

## The AI analyst

`/analyst` feeds the top-ranked countries' factor data **plus live web research** (Claude's
server-side web-search tool - the reformer's political standing, elections, latest inflation
prints, IMF/rating news) into Claude and demands:

- a top pick + runners-up,
- a bull case AND a bear case where **every claim cites a data point or a source URL**,
- an explicit "what's already priced in,"
- a confidence level with reasoning, and
- a list of evidence gaps - what it could **not** verify.

It is labeled *AI analysis / opinion* everywhere because that's what it is. The repo ships with a
cached `data/analysis.json` (generated at build time with real research and real URLs) so the tab
works with no API key; the **Regenerate** button re-runs it live when `ANTHROPIC_API_KEY` is set.
LLMs can misread sources; the citations exist so you can check them, and you should.

## Data sources (all free)

| Source | Used for | Key needed | Caveat |
|---|---|---|---|
| IMF WEO DataMapper API | inflation, fiscal, growth, current acct, debt - all countries | no | annual; current year = IMF estimate |
| World Bank API | reserves (months of imports), official FX | no | 1–2 year lag |
| open.er-api.com | spot FX snapshot | no | fetched into the snapshot; not currently rendered in the UI |
| FRED | US context series (optional) | optional | fetched into the snapshot; not currently rendered in the UI |
| Curated research (`data/curated.json`) | parallel gaps, spreads, reformers, ETF access | - | goes stale; dated + sourced |

This is public-data grade, not a Bloomberg terminal: no market prices, no positioning, no real-time
spreads, and no free historical series for parallel-rate gaps or per-country EMBI spreads (which is
why those are point-in-time curated values, not charts).

## Running it

```bash
npm install
npm run prepare-map     # builds public/map/countries-110m.json (ISO3-tagged topojson)
npm run fetch-data      # pulls a fresh IMF/World Bank/FX snapshot -> data/snapshot.json
npm run fetch-prices    # optional: monthly ETF closes (Yahoo, no key) -> data/prices.json
npm run backtest        # optional: hindsight event study -> data/backtest.json
npm run dev             # http://localhost:3000
```

No keys required for the dashboard. Optional `.env` (see `.env.example`):
`ANTHROPIC_API_KEY` enables live AI-analyst regeneration; `FRED_API_KEY` adds US context series.

## How it stays fresh

Three layers, updated on three honest clocks:

| Layer | What | How it updates |
|---|---|---|
| Quant (IMF, World Bank, FX, ETF prices, backtest) | `data/snapshot.json`, `data/prices.json`, `data/backtest.json` | **GitHub Action, Mondays 06:17 UTC** (`.github/workflows/refresh-data.yml`), auto-commits only when data changed. Or run `npm run fetch-data && npm run fetch-prices && npm run backtest` yourself. |
| Curated overlay (reformers, parallel gaps, spreads, ETF status) | `data/curated.json` | Deliberately manual: it is sourced research, not an API pull. Each entry is dated; the UI treats staleness as a first-class fact. |
| AI analysis + Trident Five | `data/analysis.json` | The Regenerate button on `/analyst` (needs `ANTHROPIC_API_KEY`), which re-runs live web research and re-validates the output before caching. |

The server watches file mtimes, so refreshed data shows up without a restart. On a Vercel/Netlify
deploy, the Action's weekly commit triggers a redeploy automatically: push once, it stays alive.

## Ship it to GitHub

```bash
cd meridian
git remote add origin git@github.com:emirichu/meridian.git
git push -u origin main
```

Then in the repo settings enable Actions (it will ask on first run). The `refresh data` workflow
also has a manual "Run workflow" button for an instant refresh. To deploy: import the repo in
Vercel, zero config needed, every weekly data commit redeploys the site.

## Where the logic lives

- **`lib/scoring.ts` - the entire methodology in one heavily-commented file**: weights, scoring
  curves, kill-criteria thresholds, signal bands, momentum. Change a number, refresh, re-rank.
  Disagreeing with this file is using it correctly.
- `lib/data.ts` - loads snapshot + curated overlay, joins, memoizes.
- `lib/analyst.ts` - the AI analyst prompt and generation pipeline.
- `data/curated.json` - the qualitative overlay, every entry dated and sourced.
- `scripts/fetch-data.mjs` - the API puller.
- `scripts/backtest.mjs` - the hindsight event study, all the math in one unfitted file. Its own
  headline result: ~52-57% hit rate and roughly +2-4% average excess vs EEM across 28
  survivor-biased events. A mild lean, not an edge - and it says so on the methodology page.

## What this tool can and cannot tell you

**Can:** rank all countries on one inspectable yardstick; surface improving fundamentals before
they're consensus; tell you exactly which numbers are data vs judgment vs proxy; give you explicit
exit conditions.

**Cannot:** tell you what's priced in (no valuation anywhere in the model); see intra-year turns
(annual data + estimates); replace market data; predict anything. The score describes the setup.
Outcomes are politics, luck, and prices - and the responsibility for acting on any of this is
entirely yours.
