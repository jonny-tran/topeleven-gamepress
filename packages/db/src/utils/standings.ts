import type { Match, MatchResult, Team } from "../schema/tournament";

export interface Standing {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  fairPlayPoints: number; // lower is better
  /** Set of team IDs that this team is tied with */
  tiedWith: Set<string>;
  /** If true, manual draw decision is needed (3+ way tie survived all criteria) */
  needsManualDecision: boolean;
  /** Head-to-head rank within tied group (only meaningful when tiedWith.size > 0) */
  h2hRank?: number;
}

/**
 * Aggregates match results for a list of teams.
 */
export function aggregateMatches(
  teams: Team[],
  matches: Match[],
  results: MatchResult[]
): Map<string, Standing> {
  const resultMap = new Map(results.map((r) => [r.matchId, r]));
  const standings = new Map<string, Standing>();

  // Initialize standings
  for (const t of teams) {
    standings.set(t.id, {
      teamId: t.id,
      teamName: t.name,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0,
      fairPlayPoints: 0,
      tiedWith: new Set(),
      needsManualDecision: false,
    });
  }

  // Aggregate each match
  for (const m of matches) {
    if (m.status !== "completed") continue;
    const r = resultMap.get(m.id);
    if (!r || r.homeScore === null || r.awayScore === null) continue;

    const homeStanding = standings.get(m.homeTeamId);
    const awayStanding = standings.get(m.awayTeamId);
    if (!homeStanding || !awayStanding) continue;

    // Update goals
    homeStanding.goalsFor += r.homeScore;
    homeStanding.goalsAgainst += r.awayScore;
    awayStanding.goalsFor += r.awayScore;
    awayStanding.goalsAgainst += r.homeScore;

    // Update played
    homeStanding.played += 1;
    awayStanding.played += 1;

    // Update W/D/L and points
    if (r.homeScore > r.awayScore) {
      homeStanding.won += 1;
      homeStanding.points += 3;
      awayStanding.lost += 1;
    } else if (r.homeScore < r.awayScore) {
      awayStanding.won += 1;
      awayStanding.points += 3;
      homeStanding.lost += 1;
    } else {
      homeStanding.drawn += 1;
      awayStanding.drawn += 1;
      homeStanding.points += 1;
      awayStanding.points += 1;
    }

    // Update fair-play points
    homeStanding.fairPlayPoints +=
      (r.homeYellowCards ?? 0) +
      (r.homeRedCards2Y ?? 0) * 2 +
      (r.homeRedCardsDirect ?? 0) * 3;
    awayStanding.fairPlayPoints +=
      (r.awayYellowCards ?? 0) +
      (r.awayRedCards2Y ?? 0) * 2 +
      (r.awayRedCardsDirect ?? 0) * 3;
  }

  // Calculate goal diff
  for (const s of standings.values()) {
    s.goalDiff = s.goalsFor - s.goalsAgainst;
  }

  return standings;
}

/**
 * Computes H2H map for a group of teams.
 */
function computeH2H(
  teams: Team[],
  matches: Match[],
  results: MatchResult[]
): Map<string, Map<string, { played: number; won: number; drawn: number; lost: number; gf: number; ga: number; pts: number }>> {
  const resultMap = new Map(results.map((r) => [r.matchId, r]));
  const h2h = new Map<string, Map<string, { played: number; won: number; drawn: number; lost: number; gf: number; ga: number; pts: number }>>();

  for (const t of teams) {
    h2h.set(t.id, new Map());
    for (const other of teams) {
      if (other.id !== t.id) {
        h2h.get(t.id)!.set(other.id, { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 });
      }
    }
  }

  for (const m of matches) {
    if (m.status !== "completed") continue;
    const r = resultMap.get(m.id);
    if (!r || r.homeScore === null || r.awayScore === null) continue;

    const homeH2H = h2h.get(m.homeTeamId)?.get(m.awayTeamId);
    const awayH2H = h2h.get(m.awayTeamId)?.get(m.homeTeamId);
    if (!homeH2H || !awayH2H) continue;

    homeH2H.played += 1;
    awayH2H.played += 1;
    homeH2H.gf += r.homeScore;
    homeH2H.ga += r.awayScore;
    awayH2H.gf += r.awayScore;
    awayH2H.ga += r.homeScore;

    if (r.homeScore > r.awayScore) {
      homeH2H.won += 1; homeH2H.pts += 3;
      awayH2H.lost += 1;
    } else if (r.homeScore < r.awayScore) {
      awayH2H.won += 1; awayH2H.pts += 3;
      homeH2H.lost += 1;
    } else {
      homeH2H.drawn += 1; awayH2H.drawn += 1;
      homeH2H.pts += 1; awayH2H.pts += 1;
    }
  }

  return h2h;
}

/**
 * Applies the 6 tie-breaker criteria:
 * 1. Points
 * 2. H2H (auto for 2 teams; flag for 3+)
 * 3. Goal diff (overall)
 * 4. Goals for (overall)
 * 5. Fair-play points (lower is better)
 * 6. Manual draw (flag)
 */
export function rankTeams(standings: Standing[]): Standing[] {
  const sorted = [...standings];

  // 1. Sort by points
  sorted.sort((a, b) => b.points - a.points);

  // Group by points
  function findTiedGroups(s: Standing[]): Standing[][] {
    const groups: Standing[][] = [];
    let i = 0;
    while (i < s.length) {
      const first = s[i]!;
      const tied: Standing[] = [first];
      let j = i + 1;
      while (j < s.length && s[j]!.points === first.points) {
        tied.push(s[j]!);
        j++;
      }
      if (tied.length > 1) groups.push(tied);
      i = j;
    }
    return groups;
  }

  // Recursively apply sub-criteria to a group of tied teams
  function resolveTie(tied: Standing[], criteria: number): { resolved: Standing[]; needsDecision: boolean } {
    if (tied.length === 1) {
      return { resolved: tied, needsDecision: false };
    }

    if (criteria === 2) {
      // H2H: for 2 teams, compare directly. For 3+, flag.
      if (tied.length === 2) {
        const t1 = tied[0]!;
        const t2 = tied[1]!;
        if (t1.h2hRank !== undefined && t2.h2hRank !== undefined) {
          if (t1.h2hRank !== t2.h2hRank) {
            return { resolved: t1.h2hRank < t2.h2hRank ? [t1, t2] : [t2, t1], needsDecision: false };
          }
        }
        // H2H tied, fall through
        return resolveTie(tied, 3);
      } else {
        // 3+ team tie: cannot use H2H cleanly, flag
        for (const t of tied) t.needsManualDecision = true;
        return { resolved: tied, needsDecision: true };
      }
    }

    // Sort by criteria
    let sortedTied: Standing[];
    if (criteria === 3) sortedTied = [...tied].sort((a, b) => b.goalDiff - a.goalDiff);
    else if (criteria === 4) sortedTied = [...tied].sort((a, b) => b.goalsFor - a.goalsFor);
    else if (criteria === 5) sortedTied = [...tied].sort((a, b) => a.fairPlayPoints - b.fairPlayPoints);
    else {
      for (const t of tied) t.needsManualDecision = true;
      return { resolved: tied, needsDecision: true };
    }

    // Check if all tied on this criteria
    const groups: Standing[][] = [];
    let i = 0;
    while (i < sortedTied.length) {
      const val = criteria === 3 ? sortedTied[i]!.goalDiff : criteria === 4 ? sortedTied[i]!.goalsFor : sortedTied[i]!.fairPlayPoints;
      const group: Standing[] = [sortedTied[i]!];
      let j = i + 1;
      while (j < sortedTied.length) {
        const nextVal = criteria === 3 ? sortedTied[j]!.goalDiff : criteria === 4 ? sortedTied[j]!.goalsFor : sortedTied[j]!.fairPlayPoints;
        if (nextVal === val) { group.push(sortedTied[j]!); j++; }
        else break;
      }
      groups.push(group);
      i = j;
    }

    if (groups.length === 1) {
      return resolveTie(tied, criteria + 1);
    }
    return { resolved: sortedTied, needsDecision: false };
  }

  const pointGroups = findTiedGroups(sorted);
  const result: Standing[] = [];

  let ptr = 0;
  for (const group of pointGroups) {
    while (ptr < sorted.length && sorted[ptr]!.points !== group[0]!.points) {
      result.push(sorted[ptr]!);
      ptr++;
    }
    const { resolved } = resolveTie(group, 2);
    result.push(...resolved);
    ptr += group.length;
  }

  while (ptr < sorted.length) {
    result.push(sorted[ptr]!);
    ptr++;
  }

  // Build tiedWith sets
  for (let i = 0; i < result.length; i++) {
    const curr = result[i]!;
    curr.tiedWith = new Set();
    for (let j = 0; j < result.length; j++) {
      if (i !== j && result[j]!.points === curr.points) {
        curr.tiedWith.add(result[j]!.teamId);
      }
    }
  }

  return result;
}

/**
 * Calculates and ranks group standings from pre-fetched data.
 */
export function calculateGroupStandingFromData(
  teams: Team[],
  matches: Match[],
  results: MatchResult[]
): Standing[] {
  const standings = aggregateMatches(teams, matches, results);
  const h2hMap = computeH2H(teams, matches, results);

  // Set H2H rank for 2-team ties
  for (const s of standings.values()) {
    const h2h = h2hMap.get(s.teamId);
    const tiedIds = [...s.tiedWith];
    if (tiedIds.length === 1) {
      const oppH2H = h2h?.get(tiedIds[0]!);
      if (oppH2H) {
        s.h2hRank = -oppH2H.pts; // negative so ascending gives higher pts first
      }
    }
  }

  return rankTeams([...standings.values()]);
}
