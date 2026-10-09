// Pure discipline ranking for /app/peringkat. Input is one status sequence per tracked
// employee (the month's attendance_logs.status values in work_date order), output is the
// on-time share, the counts and the streak. No I/O: unit-tested in tests/leaderboard.test.ts.
//
// What counts: only days the person was expected at work and the result is known.
//   PRESENT -> on time, LATE -> late, ABSENT -> missed. Approved leave, sick, permit, a holiday
//   or an off day (LEAVE, SICK, PERMIT, HOLIDAY, OFF) are excused: they are not in the
//   denominator and they neither extend nor break a streak.

export interface LeaderboardSource {
  userId: number;
  name: string;
  branchName: string | null;
  /** Comma separated statuses in work_date order, e.g. "PRESENT,LATE,HOLIDAY,PRESENT". */
  statuses: string;
}

export interface LeaderboardEntry {
  userId: number;
  name: string;
  branchName: string | null;
  present: number;
  late: number;
  absent: number;
  excused: number;
  /** present + late + absent: the days that count. */
  obligated: number;
  /** present / obligated as a whole percent, null when nothing counted yet. */
  onTimePct: number | null;
  /** Consecutive on-time days up to the latest counted day. */
  streak: number;
  /** Longest on-time run in the period. */
  bestStreak: number;
  /** 1-based, ties share a rank (1, 1, 3). Null for people without enough counted days. */
  rank: number | null;
}

export interface Leaderboard {
  ranked: LeaderboardEntry[];
  /** People without enough counted days yet, alphabetical. */
  unranked: LeaderboardEntry[];
  /** Counted days a person needs to be ranked (3, or fewer when nobody has 3 yet). */
  minDays: number;
}

const EXCUSED = new Set(['LEAVE', 'SICK', 'PERMIT', 'HOLIDAY', 'OFF']);

export function parseStatuses(statuses: string | null | undefined): string[] {
  if (!statuses) return [];
  return statuses
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Current and best run of on-time days. Excused days are skipped, LATE and ABSENT reset the run. */
export function computeStreaks(statuses: readonly string[]): { current: number; best: number } {
  let current = 0;
  let best = 0;
  for (const status of statuses) {
    if (status === 'PRESENT') {
      current += 1;
      if (current > best) best = current;
    } else if (status === 'LATE' || status === 'ABSENT') {
      current = 0;
    }
    // Excused or unknown statuses leave the run as it is.
  }
  return { current, best };
}

function toEntry(source: LeaderboardSource): LeaderboardEntry {
  const statuses = parseStatuses(source.statuses);
  let present = 0;
  let late = 0;
  let absent = 0;
  let excused = 0;
  for (const status of statuses) {
    if (status === 'PRESENT') present += 1;
    else if (status === 'LATE') late += 1;
    else if (status === 'ABSENT') absent += 1;
    else if (EXCUSED.has(status)) excused += 1;
  }
  const obligated = present + late + absent;
  const { current, best } = computeStreaks(statuses);
  return {
    userId: source.userId,
    name: source.name,
    branchName: source.branchName,
    present,
    late,
    absent,
    excused,
    obligated,
    onTimePct: obligated > 0 ? Math.round((present / obligated) * 100) : null,
    streak: current,
    bestStreak: best,
    rank: null,
  };
}

/** Exact ratio used for ordering; the rounded percent is only for display. */
function ratio(entry: LeaderboardEntry): number {
  return entry.obligated > 0 ? entry.present / entry.obligated : 0;
}

function compareByName(a: LeaderboardEntry, b: LeaderboardEntry): number {
  return a.name.localeCompare(b.name, 'id');
}

/**
 * Orders by on-time share (higher first), then fewer absences, then fewer late days, then more
 * counted days (more evidence), then name. People are ranked only from `minDays` counted days,
 * so one lucky on-time day cannot top the board; `minDays` is 3, or the highest count anyone has
 * when the month is young.
 */
export function rankEmployees(sources: readonly LeaderboardSource[], preferredMinDays = 3): Leaderboard {
  const entries = sources.map(toEntry);
  const maxObligated = entries.reduce((max, e) => Math.max(max, e.obligated), 0);
  const minDays = Math.max(1, Math.min(preferredMinDays, maxObligated));

  const eligible = maxObligated === 0 ? [] : entries.filter((e) => e.obligated >= minDays);
  const unranked = entries.filter((e) => maxObligated === 0 || e.obligated < minDays).sort(compareByName);

  eligible.sort((a, b) => {
    const byRatio = ratio(b) - ratio(a);
    if (byRatio !== 0) return byRatio;
    // Same on-time share: someone who came late still came, so fewer absences ranks first.
    if (a.absent !== b.absent) return a.absent - b.absent;
    if (a.late !== b.late) return a.late - b.late;
    if (a.obligated !== b.obligated) return b.obligated - a.obligated;
    return compareByName(a, b);
  });

  // Competition ranking: a person's rank is 1 + the number of people strictly better than them,
  // "strictly better" meaning a different (ratio, late, absent) triple that sorts earlier.
  let previous: LeaderboardEntry | null = null;
  let previousRank = 0;
  const ranked = eligible.map((entry, index) => {
    const tied =
      previous !== null &&
      ratio(previous) === ratio(entry) &&
      previous.late === entry.late &&
      previous.absent === entry.absent;
    const rank = tied ? previousRank : index + 1;
    previous = entry;
    previousRank = rank;
    return { ...entry, rank };
  });

  return { ranked, unranked, minDays };
}

/** Top-3 highlight: the first three ranked people (a tie on rank 3 can show a fourth). */
export function podium(board: Leaderboard): LeaderboardEntry[] {
  return board.ranked.filter((e) => e.rank !== null && e.rank <= 3).slice(0, 3);
}
