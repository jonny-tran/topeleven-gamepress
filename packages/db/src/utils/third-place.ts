import type { Standing } from "./standings";
import { calculateGroupStandingFromData } from "./standings";
import type { Team, Match, MatchResult, TournamentGroup } from "../schema/tournament";

export interface ThirdPlaceResult extends Standing {
  groupCode: string;
}

/**
 * Ranks the 6 third-place teams from all groups.
 * Pure function - takes pre-fetched data.
 */
export function rankThirdPlaceTeamsFromData(
  groups: TournamentGroup[],
  getTeamsInGroup: (groupId: string) => Team[],
  getCompletedMatches: (groupId: string) => { matches: Match[]; results: MatchResult[] }
): ThirdPlaceResult[] {
  const thirdPlaceTeams: ThirdPlaceResult[] = [];

  for (const group of groups) {
    const groupTeams = getTeamsInGroup(group.id);
    if (groupTeams.length === 0) continue;

    const { matches, results } = getCompletedMatches(group.id);
    const standings = calculateGroupStandingFromData(groupTeams, matches, results);
    const third = standings[2]; // index 2 = 3rd place
    if (third) {
      thirdPlaceTeams.push({
        ...third,
        groupCode: group.code,
      });
    }
  }

  // Sort by criteria: Points -> GD -> GF -> FairPlay
  return [...thirdPlaceTeams].sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    if (a.goalDiff !== b.goalDiff) return b.goalDiff - a.goalDiff;
    if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
    return a.fairPlayPoints - b.fairPlayPoints;
  });
}
