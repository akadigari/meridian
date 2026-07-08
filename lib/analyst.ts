// AI Analyst - grounded best-guess generation.
//
// Pipeline: hard factor data (top-ranked countries) + curated overlay w/ sources
//   → Claude with the server-side web-search tool (live research, URLs kept)
//   → strict JSON verdict where every claim carries a citation.
//
// The app ships with a cached data/analysis.json so it works without a key;
// POST /api/analyst regenerates live when ANTHROPIC_API_KEY is set.
import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { getScoredCountries, getCurated, getSnapshot, nowYear } from './data';
import { FACTOR_ORDER, FACTOR_LABELS } from '@/components/ui';

export interface AnalysisClaim { claim: string; source: string }
export interface Analysis {
  generatedAt: string;
  generatedBy: string;
  method: 'live-api' | 'build-time';
  disclaimer: string;
  topPick: {
    iso3: string; country: string;
    verdict: string;
    bullCase: AnalysisClaim[];
    bearCase: AnalysisClaim[];
    pricedIn: string;
    confidence: 'low' | 'medium' | 'high';
    confidenceWhy: string;
  };
  runnersUp: { iso3: string; country: string; summary: string; keyRisk: string }[];
  /** The Trident Five: ranked top picks for the home-page card. */
  topFive?: { iso3: string; country: string; why: string; keyRisk: string }[];
  evidenceGaps: string[];
  sources: { title: string; url: string; date?: string }[];
}

const ANALYSIS_PATH = path.join(process.cwd(), 'data', 'analysis.json');

export function buildAnalystContext(topN = 8): string {
  const scored = getScoredCountries().filter((c) => c.composite != null).slice(0, 25);
  const curated = getCurated();
  const snap = getSnapshot();
  const year = nowYear();

  // Focus set: top-ranked curated countries + top turnaround candidates.
  const focus = scored
    .filter((c) => c.curated || c.turnaroundCandidate)
    .slice(0, topN);

  const lines: string[] = [];
  lines.push(`DATA SNAPSHOT: ${snap.generatedAt} - IMF WEO (values for ${year} are IMF estimates) + World Bank.`);
  lines.push(`SCORING: 0-100 on 5 factors - inflation falling(25), currency honesty(20), bond-market trust(15), fiscal(25), serious reformer(15).`);
  lines.push('');
  for (const c of focus) {
    lines.push(`## ${c.name} (${c.iso3}) - composite ${c.composite}, momentum ${c.momentum ?? '-'}, signal ${c.signal}`);
    for (const k of FACTOR_ORDER) {
      const f = c.factors[k];
      lines.push(`- ${FACTOR_LABELS[k]}: ${f.score?.toFixed(0) ?? 'n/a'} [${f.confidence}] ${f.detail}`);
    }
    for (const kc of c.killCriteria) lines.push(`- KILL[${kc.label}]: ${kc.status} - ${kc.detail}`);
    const cur = curated?.countries?.[c.iso3];
    if (cur) {
      lines.push(`- Curated (as of ${cur.asOf}): reformer=${cur.reformer.name ?? 'none'} (${cur.reformer.score}/100, inPower=${cur.reformer.inPower}, next election ${cur.reformer.nextElection ?? '?'}); IMF: ${cur.imfProgram ?? 'n/a'}; spread=${cur.countryRisk.spreadBps ?? '?'}bps ${cur.countryRisk.trend}; FX gap=${cur.parallelFx.gapPct ?? '?'}%`);
      lines.push(`- ETF access: ${cur.access.etfStatus === 'active' ? `${cur.access.etfTicker} (${cur.access.etfName})` : cur.access.etfStatus ?? 'unknown'} - ${cur.access.accessNotes}`);
      for (const d of cur.developments.slice(0, 5)) lines.push(`- DEV: ${d}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

const ANALYST_SYSTEM = `You are the AI analyst inside Meridian, a reform-turnaround macro screen. You produce a grounded BEST GUESS about which country currently offers the most interesting reform-turnaround setup - clearly labeled as AI analysis/opinion, NOT a prediction, recommendation, or financial advice.

Iron rules:
1. EVERY claim must cite either (a) a specific data point from the provided factor data, written as "data: ..." or (b) a source you actually found via web search, written as its URL. No unsupported claims. NEVER fabricate a fact, number, quote, or source.
2. Use web search to check the CURRENT qualitative picture the data can't see: is the reformer still in power, upcoming elections, latest inflation prints, IMF program news, rating actions, capital controls. Keep every URL you rely on.
3. Give the BEAR case with the same seriousness as the bull case - what breaks the thesis, which kill criteria are closest to tripping.
4. Say explicitly what is likely ALREADY PRICED IN (asset performance to date; a great story everyone knows is not an edge).
5. If evidence is thin or conflicting, say so and lower your confidence. "low" confidence is a perfectly good answer.
6. Output ONLY the JSON object requested, no prose around it.
7. Style: never use em dashes anywhere in your output; use commas, periods, or plain hyphens instead.`;

function analystUserPrompt(context: string): string {
  return `Here is the current factor data and curated research for the top-ranked countries on the screen:

${context}

Task: (1) Research the current situation of the 3-5 strongest candidates with web search. (2) Pick the single most interesting reform-turnaround setup and 2-3 runners-up. (3) Return ONLY this JSON (no markdown fences):

{
  "topPick": {
    "iso3": "...", "country": "...",
    "verdict": "2-3 sentence bottom line",
    "bullCase": [{"claim": "...", "source": "data: ... OR https://..."}, ...4-6 items],
    "bearCase": [{"claim": "...", "source": "data: ... OR https://..."}, ...3-5 items],
    "pricedIn": "what the market has already rewarded - be specific about asset moves to date, with a source",
    "confidence": "low|medium|high",
    "confidenceWhy": "1-2 sentences"
  },
  "runnersUp": [{"iso3": "...", "country": "...", "summary": "...", "keyRisk": "..."}, ...2-3 items],
  "topFive": [{"iso3": "...", "country": "...", "why": "one sentence with the specific numbers that justify the rank", "keyRisk": "one sentence"}, ...exactly 5 items, ranked: the top pick first, then runners-up, then the next-best setup. Rank by setup quality, momentum, and whether a US investor can actually express the trade],
  "evidenceGaps": ["what you could not verify or what data is stale", ...],
  "sources": [{"title": "...", "url": "https://...", "date": "..."}, ... every web source you used]
}`;
}

export async function generateAnalysis(): Promise<Analysis> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not set - cannot regenerate. The cached analysis (data/analysis.json) still works.');
  }
  const client = new Anthropic();
  const context = buildAnalystContext();

  let messages: Anthropic.MessageParam[] = [{ role: 'user', content: analystUserPrompt(context) }];
  let finalMsg: Anthropic.Message | null = null;

  // Server-side web search runs a server loop; continue on pause_turn.
  for (let i = 0; i < 5; i++) {
    const stream = client.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 32000,
      thinking: { type: 'adaptive' },
      system: ANALYST_SYSTEM,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 14 } as Anthropic.Messages.ToolUnion],
      messages,
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'pause_turn') {
      messages = [...messages, { role: 'assistant', content: msg.content }];
      continue;
    }
    finalMsg = msg;
    break;
  }
  if (!finalMsg) throw new Error('Analyst run did not complete (too many continuations).');
  if (finalMsg.stop_reason === 'refusal') throw new Error('Model declined the request.');

  const text = finalMsg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
  const parsed = extractJSON(text);
  validateAnalysisShape(parsed);

  const analysis: Analysis = {
    generatedAt: new Date().toISOString(),
    generatedBy: `Claude (claude-opus-4-8) via /api/analyst with live web search`,
    method: 'live-api',
    disclaimer:
      'AI ANALYSIS / OPINION grounded in the screen data and cited web research. Not a prediction, not a recommendation, not financial advice. Verify sources before acting.',
    ...parsed,
  } as Analysis;

  // Best-effort cache: a read-only filesystem must not discard a successful
  // multi-minute generation - the caller still gets the analysis.
  try {
    fs.writeFileSync(ANALYSIS_PATH, JSON.stringify(analysis, null, 2));
  } catch (e) {
    console.error(`analyst: could not cache to ${ANALYSIS_PATH}:`, e);
  }
  return analysis;
}

function extractJSON(text: string): Record<string, unknown> {
  // The model is told to output bare JSON, but be tolerant of fences/preamble.
  const cleaned = text.replace(/```json|```/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Analyst output contained no JSON object.');
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** Reject malformed LLM output BEFORE it can be persisted and poison /analyst. */
function validateAnalysisShape(a: Record<string, unknown>): void {
  const fail = (msg: string) => {
    throw new Error(`Analyst output failed validation (${msg}) - nothing was cached; try regenerating.`);
  };
  const tp = a.topPick as Record<string, unknown> | undefined;
  if (!tp || typeof tp !== 'object') fail('missing topPick');
  for (const k of ['iso3', 'country', 'verdict', 'pricedIn', 'confidence', 'confidenceWhy']) {
    if (typeof tp![k] !== 'string' || !(tp![k] as string).length) fail(`topPick.${k} missing`);
  }
  if (!['low', 'medium', 'high'].includes(tp!.confidence as string)) fail('topPick.confidence not low|medium|high');
  for (const k of ['bullCase', 'bearCase'] as const) {
    const arr = tp![k];
    if (!Array.isArray(arr) || !arr.length) fail(`topPick.${k} empty`);
    for (const c of arr as unknown[]) {
      const cc = c as Record<string, unknown>;
      if (typeof cc?.claim !== 'string' || typeof cc?.source !== 'string') fail(`topPick.${k} entry missing claim/source`);
    }
  }
  if (!Array.isArray(a.runnersUp)) fail('runnersUp missing');
  if (!Array.isArray(a.evidenceGaps)) fail('evidenceGaps missing');
  if (a.topFive !== undefined) {
    if (!Array.isArray(a.topFive) || !a.topFive.length) fail('topFive present but empty');
    for (const p of a.topFive as unknown[]) {
      const pp = p as Record<string, unknown>;
      for (const k of ['iso3', 'country', 'why', 'keyRisk']) {
        if (typeof pp?.[k] !== 'string' || !(pp[k] as string).length) fail(`topFive entry missing ${k}`);
      }
    }
  }
  const sources = a.sources;
  if (!Array.isArray(sources) || !sources.length) fail('sources empty');
  for (const s of sources as unknown[]) {
    const ss = s as Record<string, unknown>;
    if (typeof ss?.url !== 'string' || typeof ss?.title !== 'string') fail('sources entry missing url/title');
  }
}
