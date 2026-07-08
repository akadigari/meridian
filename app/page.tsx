import Link from 'next/link';
import { getScoredCountries, getSnapshot, getCurated } from '@/lib/data';
import ScreenTabs from '@/components/ScreenTabs';
import TopFive from '@/components/TopFive';
import TripwireStrip from '@/components/TripwireStrip';

export const dynamic = 'force-dynamic';

export default function ScreenPage() {
  const countries = getScoredCountries();
  const snap = getSnapshot();
  const curated = getCurated();

  return (
    <>
      <h1 className="page-title">THE SCREEN</h1>
      <p className="page-sub">
        Sometimes a broke country gets a leader who actually fixes it: prices stop exploding, the budget
        balances, and everything the country owns gets revalued. Meridian watches all 197 countries for that
        story. Five simple checks, one score out of 100, refreshed automatically every week, and an AI analyst
        that must show a source for every claim. It is a free research tool for learning, not investing
        advice. New to the words? Read the <Link href="/methodology#glossary">60-second glossary</Link>.
      </p>
      <TopFive />
      <TripwireStrip />
      <ScreenTabs countries={countries} generatedAt={snap.generatedAt} />
    </>
  );
}
