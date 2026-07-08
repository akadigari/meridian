// Shared types for Meridian.

/** A year → value series, e.g. { "2023": 133.5, "2024": 219.9 } */
export type Series = Record<string, number>;

/** Raw quantitative data for one country, straight from the free APIs. */
export interface QuantData {
  iso3: string;
  name: string;
  /** IMF WEO PCPIPCH - CPI inflation, period average, % (incl. IMF estimates) */
  inflation?: Series;
  /** IMF WEO GGXCNL_NGDP - general govt net lending(+)/borrowing(−), % of GDP */
  fiscal?: Series;
  /** IMF WEO NGDP_RPCH - real GDP growth, % */
  growth?: Series;
  /** IMF WEO BCA_NGDPD - current account balance, % of GDP */
  currentAccount?: Series;
  /** IMF WEO GGXWDG_NGDP - general govt gross debt, % of GDP */
  debt?: Series;
  /** World Bank FI.RES.TOTL.MO - reserves in months of imports (latest) */
  reservesMonths?: { value: number; year: string };
  /** World Bank PA.NUS.FCRF - official exchange rate, LCU per USD, annual avg */
  fxOfficial?: Series;
  /** open.er-api.com spot LCU per USD (as-of the snapshot) */
  fxSpot?: number;
}

export interface CuratedSource {
  title: string;
  url: string;
  date?: string;
  supports?: string;
}

/** Hand-curated qualitative overlay for shortlist countries. */
export interface CuratedOverlay {
  iso3: string;
  asOf: string; // date the curation was last reviewed
  reformer: {
    exists: boolean;
    name?: string;
    role?: string;
    inPower: boolean;
    /** 0–100: how serious/credible the reform program is */
    score: number;
    nextElection?: string;
    notes: string;
  };
  parallelFx: {
    hasParallelMarket: boolean;
    officialRate?: number | null;
    parallelRate?: number | null;
    /** % premium of parallel over official; 0 when unified */
    gapPct: number | null;
    notes: string;
  };
  countryRisk: {
    spreadBps: number | null;
    trend: 'falling' | 'stable' | 'rising' | 'unknown';
    rating?: string;
    notes: string;
  };
  imfProgram?: string;
  latestInflation?: {
    yoyPct: number | null;
    monthlyPct: number | null;
    asOf: string;
    trend: 'falling' | 'stable' | 'rising' | 'unknown';
    notes?: string;
  };
  fiscalNote?: string;
  developments: string[];
  killCriteriaWatch: string[];
  access: {
    etfTicker?: string | null;
    etfName?: string | null;
    etfStatus?: 'active' | 'closed' | 'none';
    accessNotes: string;
  };
  sources: CuratedSource[];
}

export type Confidence = 'api' | 'curated' | 'proxy' | 'missing';

export interface FactorScore {
  /** 0–100, higher = better on the reform playbook */
  score: number | null;
  /** traffic light derived from score */
  light: 'green' | 'yellow' | 'red' | 'gray';
  /** where the number came from & caveats */
  confidence: Confidence;
  detail: string;
  asOf?: string;
}

export interface KillCriterion {
  id: string;
  label: string;
  status: 'ok' | 'near' | 'tripped' | 'unknown';
  detail: string;
}

export type Signal = 'SETUP INTACT' | 'WATCH' | 'STAND DOWN' | 'UNRATED';

export interface ScoredCountry {
  iso3: string;
  name: string;
  composite: number | null;
  factors: {
    inflation: FactorScore;
    currency: FactorScore;
    bondTrust: FactorScore;
    fiscal: FactorScore;
    reformer: FactorScore;
  };
  /** composite delta vs ~2 years ago, quant factors only. Positive = improving. */
  momentum: number | null;
  momentumDetail: string;
  signal: Signal;
  killCriteria: KillCriterion[];
  curated: boolean;
  /** was in macro distress ~2y ago → a real "turnaround" candidate, not a stable rich country */
  turnaroundCandidate: boolean;
  dataYears: { latest: string; prior: string };
  /** number of the 5 factors with real (non-missing) data */
  coverage: number;
}
