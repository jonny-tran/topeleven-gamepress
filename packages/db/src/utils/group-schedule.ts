import { nextWeekday } from "./date-skip";
import type { Team, NewMatch } from "../schema/tournament";
import { nanoid } from "nanoid";

/**
 * Generates 6 match-days (3 rounds × 2 legs) for a group of 4 teams.
 *
 * Team positions in group: 1, 2, 3, 4
 *
 * Leg 1:
 *   Round 1: 1 vs 2, 3 vs 4
 *   Round 2: 4 vs 1, 2 vs 3
 *   Round 3: 1 vs 3, 4 vs 2
 *
 * Leg 2 (home/away reversed):
 *   Round 1: 2 vs 1, 4 vs 3
 *   Round 2: 1 vs 4, 3 vs 2
 *   Round 3: 3 vs 1, 2 vs 4
 */
export function generateGroupSchedule(
  teams: Team[],
  tournamentId: string,
  groupId: string,
  startDate: Date
): NewMatch[] {
  // Sort teams by position (1-4)
  const sorted = [...teams].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const t1 = sorted[0]!;
  const t2 = sorted[1]!;
  const t3 = sorted[2]!;
  const t4 = sorted[3]!;

  const schedule: Array<{ round: number; leg: number; home: Team; away: Team }> = [
    // Leg 1
    { round: 1, leg: 1, home: t1, away: t2 },
    { round: 1, leg: 1, home: t3, away: t4 },
    { round: 2, leg: 1, home: t4, away: t1 },
    { round: 2, leg: 1, home: t2, away: t3 },
    { round: 3, leg: 1, home: t1, away: t3 },
    { round: 3, leg: 1, home: t4, away: t2 },
    // Leg 2 (home/away reversed)
    { round: 1, leg: 2, home: t2, away: t1 },
    { round: 1, leg: 2, home: t4, away: t3 },
    { round: 2, leg: 2, home: t1, away: t4 },
    { round: 2, leg: 2, home: t3, away: t2 },
    { round: 3, leg: 2, home: t3, away: t1 },
    { round: 3, leg: 2, home: t2, away: t4 },
  ];

  return schedule.map((s) => {
    const isLeg2 = s.leg === 2;
    const groupRound = isLeg2 ? s.round + 3 : s.round;
    const dayOffset = (groupRound - 1) * 7;
    const matchDate = nextWeekday(startDate, dayOffset + 1);

    return {
      id: nanoid(),
      tournamentId,
      stage: "group" as const,
      groupId,
      round: groupRound,
      leg: s.leg,
      homeTeamId: s.home.id,
      awayTeamId: s.away.id,
      matchDate,
      matchTime: null,
      status: "pending" as const,
      winnerTeamId: null,
      bracketSlot: null,
    };
  });
}
