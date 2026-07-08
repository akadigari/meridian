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
        Every country, scored 0–100 on the reform-turnaround playbook: <b>inflation falling</b>, <b>honest
        currency</b>, <b>bond-market trust</b>, <b>budget discipline</b>, <b>a serious reformer in power</b>.
        The thesis: when a broke, high-inflation country gets a reformer who actually fixes the fundamentals,
        its assets can re-rate - and the screen tries to spot that setup while it&rsquo;s forming. It is a
        heuristic for further homework, not an oracle: a high score says the <i>setup</i> ranks well, and by
        the time a setup screens well, part of the move is usually already priced.
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
