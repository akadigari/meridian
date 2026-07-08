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
        A free research tool for one of the most interesting stories in economics: what happens when a broke,
        high-inflation country gets a leader who actually fixes it. Every country on Earth is scored 0–100 on
        five plain questions - <b>is inflation falling</b>, <b>is the currency honest</b>, <b>do bond markets
        trust it</b>, <b>is the budget balanced</b>, <b>is a serious reformer in power</b> - from public IMF
        and World Bank data that refreshes itself weekly, with an AI analyst reading the same numbers and
        explaining what it sees, source by source. It exists for curiosity and learning, not trading: a high
        score means the turnaround story checks out on the fundamentals, nothing more.
        {' '}New to the jargon? The <Link href="/methodology#glossary">60-second glossary</Link> translates
        every term on this page.
        {curated
          ? ` Qualitative factors (parallel-rate gap, reformer) are hand-curated with sources for ${Object.keys(curated.countries).length} shortlist countries (as of ${curated.asOf}); everything else is scored from APIs alone.`
          : ' Curated qualitative overlay not yet generated - all scores are API-only.'}
      </p>
      <TopFive />
      <TripwireStrip />
      <ScreenTabs countries={countries} generatedAt={snap.generatedAt} />
    </>
  );
}
