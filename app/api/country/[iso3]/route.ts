import { NextResponse } from 'next/server';
import { getCountry } from '@/lib/data';

export const dynamic = 'force-dynamic';

/** GET /api/country/:iso3 - scored + raw + curated detail for one country. */
export async function GET(_req: Request, { params }: { params: Promise<{ iso3: string }> }) {
  const { iso3 } = await params;
  const data = getCountry(iso3);
  if (!data) return NextResponse.json({ error: `Unknown country: ${iso3}` }, { status: 404 });
  return NextResponse.json({
    disclaimer: 'Discretionary macro screening heuristic. Not financial advice. Factor confidence tags: api | curated | proxy | missing.',
    ...data,
  });
}
