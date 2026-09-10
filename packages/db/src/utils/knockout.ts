import type { MatchResult } from "../schema/tournament";

/**
 * Fair-play card points:
 * Yellow = 1, Red 2Y = 2, Red Direct = 3
 * Lower is better.
 */
export function calcCardPoints(
  result: MatchResult
): { home: number; away: number } {
  return {
    home:
      (result.homeYellowCards ?? 0) * 1 +
      (result.homeRedCards2Y ?? 0) * 2 +
      (result.homeRedCardsDirect ?? 0) * 3,
    away:
      (result.awayYellowCards ?? 0) * 1 +
      (result.awayRedCards2Y ?? 0) * 2 +
      (result.awayRedCardsDirect ?? 0) * 3,
  };
}

export interface KnockoutResult {
  winnerTeamId: string;
  pendingDraw: boolean;
  reason: string;
}

/**
 * Resolves a 2-legged knockout tie.
 *
 * Rules:
 * 1. Aggregate total goals across both legs.
 * 2. If aggregate is not tied: higher goals wins.
 * 3. If aggregate is tied: compare fair-play points across BOTH legs.
 *    (lower is better)
 * 4. If fair-play also tied: pendingDraw = true (admin must pick).
 */
export function resolveKnockoutWinner(
  homeTeamId: string,
  awayTeamId: string,
  leg1Result: MatchResult | null,
  leg2Result: MatchResult | null
): KnockoutResult {
  if (!leg1Result || !leg2Result) {
    return {
      winnerTeamId: "",
      pendingDraw: true,
      reason: "Both legs must be completed",
    };
  }

  const leg1Home = leg1Result.homeScore ?? 0;
  const leg1Away = leg1Result.awayScore ?? 0;
  const leg2Home = leg2Result.homeScore ?? 0;
  const leg2Away = leg2Result.awayScore ?? 0;

  // Leg 1: home at homeTeamId's home
  // Leg 2: away at homeTeamId's home (so awayTeamId is home in leg 2)
  const homeTotal = leg1Home + leg2Away;
  const awayTotal = leg1Away + leg2Home;

  if (homeTotal > awayTotal) {
    return {
      winnerTeamId: homeTeamId,
      pendingDraw: false,
      reason: `Aggregate: ${homeTotal}-${awayTotal}`,
    };
  }
  if (awayTotal > homeTotal) {
    return {
      winnerTeamId: awayTeamId,
      pendingDraw: false,
      reason: `Aggregate: ${awayTotal}-${homeTotal}`,
    };
  }

  // Aggregate tied — compare fair-play across both legs
  const fp1 = calcCardPoints(leg1Result);
  const fp2 = calcCardPoints(leg2Result);
  const homeFP = fp1.home + fp2.away;
  const awayFP = fp1.away + fp2.home;

  if (homeFP < awayFP) {
    return {
      winnerTeamId: homeTeamId,
      pendingDraw: false,
      reason: `Aggregate tied ${homeTotal}-${awayTotal}, fair-play: ${homeFP} < ${awayFP}`,
    };
  }
  if (awayFP < homeFP) {
    return {
      winnerTeamId: awayTeamId,
      pendingDraw: false,
      reason: `Aggregate tied ${homeTotal}-${awayTotal}, fair-play: ${awayFP} < ${homeFP}`,
    };
  }

  // Both aggregate and fair-play tied — admin must decide
  return {
    winnerTeamId: "",
    pendingDraw: true,
    reason: `Aggregate tied ${homeTotal}-${awayTotal}, fair-play tied ${homeFP}-${awayFP}`,
  };
}

/**
 * Bracket slot definitions for knockout rounds.
 */
export interface BracketSlot {
  slot: string;
  stage: "round_of_16" | "quarter" | "semi" | "third_place" | "final";
  round: number;
  leg: 1 | 2;
  nextSlot: string | null; // which slot the winner advances to
}

export const BRACKET_SLOTS: BracketSlot[] = [
  // Round of 16 (8 matches, 2 legs each)
  { slot: "R16_1", stage: "round_of_16", round: 1, leg: 1, nextSlot: "QF_A1" },
  { slot: "R16_2", stage: "round_of_16", round: 1, leg: 1, nextSlot: "QF_A1" },
  { slot: "R16_3", stage: "round_of_16", round: 1, leg: 1, nextSlot: "QF_A2" },
  { slot: "R16_4", stage: "round_of_16", round: 1, leg: 1, nextSlot: "QF_A2" },
  { slot: "R16_5", stage: "round_of_16", round: 1, leg: 1, nextSlot: "QF_B1" },
  { slot: "R16_6", stage: "round_of_16", round: 1, leg: 1, nextSlot: "QF_B1" },
  { slot: "R16_7", stage: "round_of_16", round: 1, leg: 1, nextSlot: "QF_B2" },
  { slot: "R16_8", stage: "round_of_16", round: 1, leg: 1, nextSlot: "QF_B2" },
  // R16 Leg 2
  { slot: "R16_1L2", stage: "round_of_16", round: 1, leg: 2, nextSlot: "QF_A1" },
  { slot: "R16_2L2", stage: "round_of_16", round: 1, leg: 2, nextSlot: "QF_A1" },
  { slot: "R16_3L2", stage: "round_of_16", round: 1, leg: 2, nextSlot: "QF_A2" },
  { slot: "R16_4L2", stage: "round_of_16", round: 1, leg: 2, nextSlot: "QF_A2" },
  { slot: "R16_5L2", stage: "round_of_16", round: 1, leg: 2, nextSlot: "QF_B1" },
  { slot: "R16_6L2", stage: "round_of_16", round: 1, leg: 2, nextSlot: "QF_B1" },
  { slot: "R16_7L2", stage: "round_of_16", round: 1, leg: 2, nextSlot: "QF_B2" },
  { slot: "R16_8L2", stage: "round_of_16", round: 1, leg: 2, nextSlot: "QF_B2" },

  // Quarter-finals (4 matches)
  { slot: "QF_A1", stage: "quarter", round: 1, leg: 1, nextSlot: "SF_1" },
  { slot: "QF_A2", stage: "quarter", round: 1, leg: 1, nextSlot: "SF_1" },
  { slot: "QF_B1", stage: "quarter", round: 1, leg: 1, nextSlot: "SF_2" },
  { slot: "QF_B2", stage: "quarter", round: 1, leg: 1, nextSlot: "SF_2" },
  // QF Leg 2
  { slot: "QF_A1L2", stage: "quarter", round: 1, leg: 2, nextSlot: "SF_1" },
  { slot: "QF_A2L2", stage: "quarter", round: 1, leg: 2, nextSlot: "SF_1" },
  { slot: "QF_B1L2", stage: "quarter", round: 1, leg: 2, nextSlot: "SF_2" },
  { slot: "QF_B2L2", stage: "quarter", round: 1, leg: 2, nextSlot: "SF_2" },

  // Semi-finals (2 matches)
  { slot: "SF_1", stage: "semi", round: 1, leg: 1, nextSlot: "FINAL" },
  { slot: "SF_2", stage: "semi", round: 1, leg: 1, nextSlot: "FINAL" },
  // SF Leg 2
  { slot: "SF_1L2", stage: "semi", round: 1, leg: 2, nextSlot: "FINAL" },
  { slot: "SF_2L2", stage: "semi", round: 1, leg: 2, nextSlot: "FINAL" },

  // Final & Third Place
  { slot: "FINAL", stage: "final", round: 1, leg: 1, nextSlot: null },
  { slot: "FINALL2", stage: "final", round: 1, leg: 2, nextSlot: null },
  { slot: "3RD", stage: "third_place", round: 1, leg: 1, nextSlot: null },
  { slot: "3RDL2", stage: "third_place", round: 1, leg: 2, nextSlot: null },
];

/**
 * R16 pairing to bracket slot mapping.
 * Based on the official bracket layout.
 */
export const R16_TO_QF_MAP: Record<string, [string, string]> = {
  // Dynamic pairings from matrix go to these slots
  "R16_1": ["QF_A1", "QF_A1L2"],
  "R16_2": ["QF_A1", "QF_A1L2"],
  "R16_3": ["QF_A2", "QF_A2L2"],
  "R16_4": ["QF_A2", "QF_A2L2"],
  "R16_5": ["QF_B1", "QF_B1L2"],
  "R16_6": ["QF_B1", "QF_B1L2"],
  "R16_7": ["QF_B2", "QF_B2L2"],
  "R16_8": ["QF_B2", "QF_B2L2"],
};

/**
 * Gets the leg 2 slot corresponding to a leg 1 slot.
 */
export function getLeg2Slot(slot: string): string {
  if (slot.endsWith("L2")) return slot;
  return slot + "L2";
}
