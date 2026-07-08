import { getAnalysis } from '@/lib/data';
import AnalystView from '@/components/AnalystView';
import type { Analysis } from '@/lib/analyst';

export const dynamic = 'force-dynamic';

export default function AnalystPage() {
  const analysis = getAnalysis() as unknown as Analysis | null;
  const hasKey = !!process.env.ANTHROPIC_API_KEY;

  return (
    <>
      <h1 className="page-title">AI ANALYST</h1>
      <p className="page-sub">
        Takes the top-ranked countries, runs live web research for the qualitative picture the APIs can&rsquo;t see
        (reformer&rsquo;s political standing, elections, latest prints, IMF and rating news), feeds both the hard factor
        data and the research to Claude, and asks for a ranked best-guess where <b>the bull and bear cases cite a
        data point or a source URL for every claim</b> - plus a confidence level, what&rsquo;s already priced in, and a
        list of what it could not verify.
      </p>
      <AnalystView initial={analysis} hasKey={hasKey} />
    </>
  );
}
