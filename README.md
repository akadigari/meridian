<p align="center">
  <img src="docs/banner.svg" alt="Meridian - reform-turnaround macro screen" width="100%"/>
</p>

<p align="center">
  <img src="https://github.com/akadigari/meridian/actions/workflows/ci.yml/badge.svg" alt="ci"/>
  <img src="https://github.com/akadigari/meridian/actions/workflows/refresh-data.yml/badge.svg" alt="data refresh"/>
  <img src="https://img.shields.io/badge/api%20keys-none%20required-55c6dd?style=flat-square" alt="no keys"/>
  <img src="https://img.shields.io/badge/backtest-honest%20(thin%20edge)-e0c060?style=flat-square" alt="honest backtest"/>
  <img src="https://img.shields.io/badge/financial%20advice-absolutely%20not-f0645a?style=flat-square" alt="not advice"/>
  <img src="https://img.shields.io/badge/license-MIT-8a713b?style=flat-square" alt="MIT"/>
</p>

# Meridian

Live site: **[meridian-zeta-neon.vercel.app](https://meridian-zeta-neon.vercel.app)**

**Meridian is a free research dashboard that scores every country on the reform-turnaround playbook: a broke, high-inflation country gets a leader who actually fixes it.** Argentina under Milei is the template. Kill the deficit, free the currency, crush inflation, and the country's assets can re-rate. Meridian scores ~197 countries 0-100 on live IMF and World Bank data that refreshes itself weekly, layers hand-researched context on top with sources attached, and has an AI analyst that reads the same numbers plus fresh web research and explains what it sees, with citations.

> A high score means "the turnaround story checks out on the fundamentals." It does NOT mean "will make money." This is a research tool, not a backtested edge, and not financial advice. The methodology page backtests the thesis against itself and reports the thin result honestly.

## Why I built this

I'm an econ major, and Argentina 2024-25 was the most interesting macro story of my degree: fiscal surplus, crawling-peg exit, inflation falling from 25% a month to low single digits, ARGT more than doubling. I wanted a screen that answers one question: which country might be next? I couldn't find a free one, so I built it.

New to finance? The site has a [60-second glossary](https://meridian-zeta-neon.vercel.app/methodology#glossary) that translates every term, and [docs/CODE_TOUR.md](docs/CODE_TOUR.md) walks the whole codebase in plain English.

## What it does

| Feature | Where |
|---|---|
| The Trident Five: the analyst's ranked top picks, with why and the key risk | `/` (top card) |
| Tripwire strip: curated countries with exit conditions close to tripping | `/` (only shows when non-empty) |
| Ranked leaderboard of all countries with factor breakdown | `/` (Leaderboard tab) |
| Momentum view: who is improving fastest | `/` (Momentum tab) |
| World map heatmap, click through to any country | `/` (Map tab) |
| Country page: 5-factor scorecard, signal, kill criteria, trend charts, score history, ETF depth, "how to play it" | `/country/ARG` etc. |
| The Duel: two countries side by side, factor by factor | `/compare?a=ARG&b=GHA` |
| Weight sandbox (re-rank live) and a hindsight backtest | `/methodology` |
| AI analyst: cited best guess with bull case, bear case, and confidence | `/analyst` |
| JSON API | `GET /api/countries`, `GET /api/country/:iso3`, `GET/POST /api/analyst` |

## The five factors

Weights live in `lib/scoring.ts`.

| # | Factor | Weight | Source |
|---|---|---|---|
| A | **Inflation falling** (45% level, 55% trajectory) | 25 | IMF WEO (automated, all countries) |
| B | **Currency honesty** (official vs parallel gap) | 20 | Hand-researched on the shortlist; depreciation proxy elsewhere |
| C | **Bond-market trust** (sovereign USD spread) | 15 | Hand-researched on the shortlist; balance-sheet proxy elsewhere |
| D | **Fiscal balance** (60% level, 40% trajectory) | 25 | IMF WEO (automated, all countries) |
| E | **Serious reformer in power** | 15 | Hand-researched only. No API measures political will |

**The honest split.** Factors A and D are pure API data for every country. Factors B, C, and E depend on things no free API publishes: parallel exchange rates, EMBI spreads, and whether a reformer is for real. So I research those by hand for the shortlist of active reform stories in `data/curated.json`, with a source and a date on every entry. Everywhere else the site either uses a clearly labeled proxy or admits it doesn't know. Every number in the UI is tagged `API`, `CURATED`, `PROXY`, or `NO DATA`. Countries without the curated homework are marked **UNRATED**: they get a score, not a verdict, because a verdict without the research would be fake precision.

**Momentum.** The leaderboard ranks who fits the playbook right now. The momentum view ranks rate of change (today's quant score minus ~2 years ago), which is how you catch a turnaround while it is still mid-swing. The `TURNAROUND` badge marks countries that were in real distress two years ago (inflation at 20%+ or a deficit worse than 5% of GDP), so stable rich countries don't read as reform stories.

**Signals and kill criteria.** Curated countries get SETUP INTACT, WATCH, or STAND DOWN. The signal comes from the composite score plus four explicit exit conditions: the reformer loses power, the currency gap reopens (over 8% is near, over 15% is tripped), the budget flips back toward deficit (or worsens by 1.5 points over the window), or country risk blows out (near: over 700bps, or over 500bps and rising; tripped: over 900bps, or over 800bps and rising). SETUP INTACT also requires that all four conditions can actually be monitored. If there is no spread data or no gap number to watch, the best a country can get is WATCH. Each country page shows which conditions are close to tripping. Tripped means the thesis is broken, and the playbook says exit, not "average down."

## The AI analyst

`/analyst` feeds the top-ranked countries' factor data plus live web research (the reformer's political standing, elections, the latest inflation prints, IMF and ratings news) into Claude and demands: a top pick and runners-up, a bull case AND a bear case where every claim cites a data point or a source URL, an explicit "what's already priced in," a confidence level with reasoning, and a list of what it could not verify.

It is labeled AI analysis everywhere because that's what it is. The repo ships with a cached `data/analysis.json` (generated with real research and real URLs) so the tab works with no API key. The Regenerate button re-runs it live when `ANTHROPIC_API_KEY` is set. LLMs can misread sources. The citations exist so you can check them, and you should.

## Honest caveats

Stated up front and repeated inside the app:

- The pattern is real but rare, and the sample of clean historical cases is tiny.
- Nothing here is backtested as a strategy. The scoring curves are judgment calls.
- By the time a country screens well, part of the move has usually happened. A high score is a continuation bet (the setup holds), not evidence the asset is cheap. Valuation is not in the model at all.
- The quant data is annual (IMF WEO, and the current year is an IMF estimate). A coup or a devaluation shows up in headlines months before it shows up here.

## Data sources (all free)

| Source | Used for | Key needed | Caveat |
|---|---|---|---|
| IMF WEO DataMapper API | inflation, fiscal, growth, current account, debt | no | annual; current year is an estimate |
| World Bank API | reserves (months of imports), official FX | no | 1-2 year lag |
| open.er-api.com | spot FX snapshot | no | fetched into the snapshot, not rendered yet |
| FRED | US context series | optional | fetched into the snapshot, not rendered yet |
| My curated research (`data/curated.json`) | parallel gaps, spreads, reformers, ETF access | - | goes stale; every entry is dated and sourced |

This is public-data grade, not a Bloomberg terminal. No market prices, no positioning, no real-time spreads, and no free historical series for parallel-rate gaps or per-country EMBI spreads. That's why those are point-in-time researched values instead of charts.

## Run it locally

```bash
npm install
npm run prepare-map     # builds public/map/countries-110m.json (ISO3-tagged topojson)
npm run fetch-data      # pulls a fresh IMF/World Bank/FX snapshot -> data/snapshot.json
npm run fetch-prices    # optional: monthly ETF closes (Yahoo, no key) -> data/prices.json
npm run backtest        # optional: hindsight event study -> data/backtest.json
npm run dev             # http://localhost:3000
```

No keys required for the dashboard. Optional `.env` (see `.env.example`): `ANTHROPIC_API_KEY` turns on live AI-analyst regeneration, `FRED_API_KEY` adds US context series.

## How it stays fresh

| Layer | What | How it updates |
|---|---|---|
| Quant (IMF, World Bank, FX, ETF prices, backtest) | `data/snapshot.json`, `data/prices.json`, `data/backtest.json` | GitHub Action, Mondays 06:17 UTC (`.github/workflows/refresh-data.yml`). Commits only when the data changed. You can also run the fetch scripts yourself. |
| Curated overlay (reformers, parallel gaps, spreads, ETF status) | `data/curated.json` | Manual on purpose. It is sourced research, not an API pull. Every entry is dated, and the UI treats staleness as a fact worth showing. |
| AI analysis and the Trident Five | `data/analysis.json` | The Regenerate button on `/analyst` (needs `ANTHROPIC_API_KEY`). Re-runs the web research and validates the output before caching. |

The server watches file timestamps, so refreshed data shows up without a restart. On Vercel, the weekly data commit triggers a redeploy on its own.

## Deploy your own

It's a normal Next.js app. Import the repo in Vercel with zero config and deploy. Enable Actions in the repo settings so the weekly refresh runs (the workflow also has a manual "Run workflow" button).

## Where the logic lives

- `lib/scoring.ts` is the entire methodology in one heavily commented file: weights, scoring curves, kill-criteria thresholds, signal bands, momentum. If you disagree with a weight, change it and refresh. The whole site re-ranks.
- `lib/data.ts` loads the snapshot and the curated overlay, joins them, and memoizes.
- `lib/analyst.ts` is the AI analyst prompt and generation pipeline.
- `data/curated.json` is the qualitative overlay, every entry dated and sourced.
- `scripts/fetch-data.mjs` pulls the APIs.
- `scripts/backtest.mjs` is the hindsight event study, all the math in one file. Its headline result: about a 52-57% hit rate and roughly +2-4% average excess return vs EEM across 28 survivor-biased events. That is a mild lean, not an edge, and the methodology page says so.

## What this can and can't tell you

**Can:** rank every country on one inspectable yardstick, surface improving fundamentals before they're consensus, show you exactly which numbers are data vs judgment vs proxy, and give you explicit exit conditions.

**Can't:** tell you what's priced in (there is no valuation in the model), see intra-year turns (the data is annual and partly estimated), replace market data, or predict anything. The score describes the setup. Outcomes are politics, luck, and prices, and acting on any of this is entirely your own call.
