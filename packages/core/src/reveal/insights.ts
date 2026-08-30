/**
 * What all the sessions together say (PRD §18, §19).
 *
 * Kept pure and out of the database layer so it can be tested with rows in an
 * array rather than a Postgres instance, and so the shape of the answer is
 * decided here rather than in SQL.
 *
 * The ordering is deliberate. §19 singles out one number as "particularly
 * important" — the share of players who did not realise the team-development
 * element was intentional until the reveal — because it is the only one that
 * tests the actual proposition. Everything else is context for it.
 *
 * Medians rather than means throughout: with a handful of sessions, one
 * abandoned game or one that ran long over lunch drags an average somewhere
 * untrue.
 */

export interface SessionRow {
  /** The `metrics` JSON stored against a finished game. Shape is not trusted. */
  metrics: Record<string, unknown>;
  finishedAt: string;
}

export interface DebriefRow {
  knewBefore: 'no' | 'suspected' | 'yes';
  sawSomething: boolean;
  playAgain: boolean;
  willChange?: string | null;
  at: string;
}

export interface Insights {
  sessions: number;
  answers: number;
  /** The one §19 calls particularly important. Null until somebody answers. */
  surprisedPct: number | null;
  suspectedPct: number | null;
  knewPct: number | null;
  sawSomethingPct: number | null;
  playAgainPct: number | null;
  completionPct: number | null;
  solvedPct: number | null;
  medianMinutes: number | null;
  /** Of eight. The headline team number. */
  medianMomentsReached: number | null;
  medianDominance: number | null;
  totalPassedOver: number;
  medianPlayers: number | null;
  /** Most recent first. The qualitative half, and usually the useful half. */
  changes: { text: string; at: string }[];
  /**
   * Set when a baseline is in force. The page must say so: a figure that
   * silently excludes half the record is worse than no figure.
   */
  since?: string;
}

export function computeInsights(sessions: SessionRow[], debriefs: DebriefRow[]): Insights {
  const num = (r: SessionRow, key: string): number | undefined => {
    const v = r.metrics[key];
    return typeof v === 'number' ? v : undefined;
  };
  const bool = (r: SessionRow, key: string): boolean | undefined => {
    const v = r.metrics[key];
    return typeof v === 'boolean' ? v : undefined;
  };
  const pct = (n: number, of: number) => (of === 0 ? null : Math.round((n / of) * 100));
  const share = (want: DebriefRow['knewBefore']) =>
    pct(debriefs.filter((d) => d.knewBefore === want).length, debriefs.length);

  return {
    sessions: sessions.length,
    answers: debriefs.length,
    surprisedPct: share('no'),
    suspectedPct: share('suspected'),
    knewPct: share('yes'),
    sawSomethingPct: pct(debriefs.filter((d) => d.sawSomething).length, debriefs.length),
    playAgainPct: pct(debriefs.filter((d) => d.playAgain).length, debriefs.length),
    completionPct: pct(
      sessions.filter((r) => bool(r, 'reachedReveal') === true).length,
      sessions.length,
    ),
    solvedPct: pct(sessions.filter((r) => bool(r, 'solved') === true).length, sessions.length),
    medianMinutes: median(sessions.map((r) => num(r, 'durationMinutes'))),
    medianMomentsReached: median(sessions.map((r) => num(r, 'momentsReached'))),
    medianDominance: median(sessions.map((r) => num(r, 'dominance'))),
    totalPassedOver: sessions.reduce((n, r) => n + (num(r, 'momentsPassedOver') ?? 0), 0),
    medianPlayers: median(sessions.map((r) => num(r, 'humanPlayers'))),
    changes: debriefs
      .filter((d) => (d.willChange ?? '').trim().length > 0)
      .map((d) => ({ text: (d.willChange ?? '').trim(), at: d.at })),
  };
}

function median(values: (number | undefined)[]): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number').sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  const value =
    nums.length % 2 === 1 ? (nums[mid] ?? 0) : ((nums[mid - 1] ?? 0) + (nums[mid] ?? 0)) / 2;
  return Math.round(value * 100) / 100;
}

/**
 * A reading of the headline number, so the page says what it means rather than
 * leaving a percentage to be interpreted differently every time it is looked at.
 */
export function readSurprise(i: Insights): string {
  if (i.surprisedPct === null) return 'No answers yet.';
  if (i.answers < 10)
    return `Only ${String(i.answers)} answers so far — too few to read anything into.`;
  if (i.surprisedPct >= 70) return 'The surprise is landing. This is the proposition working.';
  if (i.surprisedPct >= 40)
    return 'Roughly half saw it coming. Worth asking how they were told about the session.';
  return 'Most people knew. Something upstream — the invitation, the framing — is giving it away.';
}
