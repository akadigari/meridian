import { NextResponse } from 'next/server';
import { getScoredCountries, getSnapshot } from '@/lib/data';

export const dynamic = 'force-dynamic';

/** GET /api/countries - the full scored leaderboard. */
export async function GET() {
  const snap = getSnapshot();
  return NextResponse.json({
    generatedAt: snap.generatedAt,
    disclaimer: 'Discretionary macro screening heuristic. Not financial advice.',
    countries: getScoredCountries(),
  });
}
