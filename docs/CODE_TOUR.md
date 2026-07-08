# Code tour for beginners

Never read a codebase before? Start here. This walks the whole project in the
order that makes sense, in plain English. Nothing in here assumes you know
finance or React.

## The one-paragraph version

Meridian is a website that downloads free economic data about every country,
gives each country a score based on five simple questions (is inflation
falling? is the currency honest? do bond markets trust it? is the budget
balanced? is a serious reformer in charge?), and shows the results as tables,
a map, and country pages. An AI analyst reads the same data plus fresh web
research and writes an opinion with citations. A robot on GitHub re-downloads
the data every Monday so the site stays current by itself.

## How the data flows

```
 IMF + World Bank + FX APIs          Yahoo prices           web research (AI agents)
          |                              |                          |
   scripts/fetch-data.mjs        scripts/fetch-prices.mjs      (done by hand/agents)
          |                              |                          |
   data/snapshot.json              data/prices.json          data/curated.json
          \_____________________________|__________________________/
                                    |
                             lib/data.ts  (loads the files)
                                    |
                             lib/scoring.ts  (turns numbers into scores)
                                    |
                    app/ pages + components/ (what you see in the browser)
```

## Read the files in this order

1. **`lib/scoring.ts`** - the heart. One file, heavily commented, no tricks.
   Every score on the site comes from the functions here. If you only read
   one file, read this one. Try changing a number in `WEIGHTS` at the top,
   refresh the site, and watch the whole ranking reshuffle.

2. **`scripts/fetch-data.mjs`** - the downloader. Plain JavaScript that calls
   free public APIs (no accounts, no keys) and saves the results into one
   JSON file. Run it yourself with `npm run fetch-data` and watch it print
   what it grabs.

3. **`lib/data.ts`** - the loader. Reads the JSON files from disk, hands them
   to the scoring engine, and caches the result so pages render fast. The
   "mtime" logic just means: if a file changed on disk, reload it.

4. **`app/page.tsx`** - the home page. In Next.js, every folder under `app/`
   is a page on the site. This file fetches the scored countries and passes
   them to the components that draw the tables and map.

5. **`components/`** - the visual pieces. Each file is one piece of UI:
   `ScreenTabs.tsx` is the big sortable table, `WorldMap.tsx` draws the map,
   `TopFive.tsx` is the ranked picks card, `Sparkline.tsx` is the tiny
   history chart. Files that start with `'use client'` run in your browser
   (they respond to clicks); files without it run on the server (they just
   produce HTML).

6. **`lib/analyst.ts`** - the AI part. Builds a big text prompt out of the
   score data, sends it to Claude with web search turned on, and demands the
   answer come back as JSON where every claim has a source. The
   `validateAnalysisShape` function refuses to save anything malformed.

7. **`scripts/backtest.mjs`** - the honesty check. Replays the scoring math
   over past years and asks: when the screen flashed "turnaround" before,
   did that country's fund actually beat the average afterwards? (Answer:
   only slightly, and the file lists every reason to distrust even that.)

## Words the code uses (plain English)

| Word | Meaning |
|---|---|
| component | a reusable piece of the page, written as a function that returns HTML-ish code (JSX) |
| server component | runs on the server, produces HTML, cannot respond to clicks |
| client component | ships to the browser, can respond to clicks and re-render (`'use client'` at the top) |
| API route | a URL like `/api/countries` that returns raw JSON instead of a page (`app/api/.../route.ts`) |
| props | the inputs a component receives, like function arguments |
| interface / type | a description of a data shape so the editor can catch mistakes before you run anything |
| snapshot | our word for "the JSON file of downloaded data, frozen at one moment" |
| composite | our word for "the weighted average of the five factor scores" |
| momentum | our word for "today's quant score minus the score two years ago" |
| piecewise linear | fancy words for "connect the dots": we pick anchor points like (inflation 2% = score 100, inflation 80% = score 10) and draw straight lines between them |

## Safe things to try first

- Change a weight in `WEIGHTS` in `lib/scoring.ts`, save, refresh.
- Change a color in `app/globals.css` (all colors are named at the top).
- Add a country to the shortlist: copy an entry in `data/curated.json`,
  fill in your own research, save, refresh. It instantly gets a signal.
- Run `npm run fetch-data` and diff `data/snapshot.json` in git to see
  exactly what changed.

## What keeps it updating by itself

`.github/workflows/refresh-data.yml` is a scheduled robot on GitHub. Every
Monday it downloads fresh data, re-runs the backtest, and commits the result
back to the repo, but only if something actually changed. If the site is
deployed on Vercel, that commit automatically redeploys the site. No server
to maintain, nothing to remember.
