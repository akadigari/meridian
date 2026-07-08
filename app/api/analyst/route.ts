import { NextResponse } from 'next/server';
import { getAnalysis } from '@/lib/data';
import { generateAnalysis } from '@/lib/analyst';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // live research + generation can take minutes

/** GET /api/analyst - the cached analysis (ships with the repo). */
export async function GET() {
  const analysis = getAnalysis();
  if (!analysis) return NextResponse.json({ error: 'No analysis generated yet.' }, { status: 404 });
  return NextResponse.json(analysis);
}

/** POST /api/analyst - regenerate live (requires ANTHROPIC_API_KEY). */
export async function POST() {
  try {
    const analysis = await generateAnalysis();
    return NextResponse.json(analysis);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes('ANTHROPIC_API_KEY') ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
