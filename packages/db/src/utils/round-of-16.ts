import type { Standing } from "./standings";

/**
 * Round of 16 pairing matrix derived from the official draw table.
 *
 * Each key is a comma-separated list of the 4 groups whose third-place teams
 * qualify for the knockout round.
 *
 * Each value maps the group code of the group winner (A-D) to the group code
 * of the third-place opponent they face.
 *
 * The 4 fixed pairings (not dependent on third-place teams) are:
 *   E-1 vs A-2  (Nhất E – Nhì A)
 *   F-1 vs B-2  (Nhất F – Nhì B)
 *   C-2 vs D-2  (Nhì C – Nhì D)
 *   E-2 vs F-2  (Nhì E – Nhì F)
 */

export interface R16Pairing {
  group: string;
  winner: string; // group code of the group winner
  opponentGroup: string; // group code of the third-place or runner-up opponent
  isFixed: boolean;
}

// 15-case matrix from the official draw table
const R16_MATRIX: Record<string, Record<string, string>> = {
  "A,B,C,D": { A: "C", B: "D", C: "A", D: "B" },
  "A,B,C,E": { A: "C", B: "E", C: "A", D: "B" },
  "A,B,C,F": { A: "C", B: "F", C: "A", D: "B" },
  "A,B,D,E": { A: "D", B: "E", C: "A", D: "B" },
  "A,B,D,F": { A: "D", B: "F", C: "A", D: "B" },
  "A,B,E,F": { A: "E", B: "F", C: "A", D: "B" },
  "A,C,D,E": { A: "C", B: "D", C: "A", D: "E" },
  "A,C,D,F": { A: "C", B: "D", C: "A", D: "F" },
  "A,C,E,F": { A: "C", B: "E", C: "A", D: "F" },
  "A,D,E,F": { A: "D", B: "E", C: "A", D: "F" },
  "B,C,D,E": { A: "C", B: "D", C: "B", D: "E" },
  "B,C,D,F": { A: "C", B: "D", C: "B", D: "F" },
  "B,C,E,F": { A: "C", B: "E", C: "B", D: "F" },
  "B,D,E,F": { A: "D", B: "E", C: "B", D: "F" },
  "C,D,E,F": { A: "C", B: "D", C: "E", D: "F" },
};

/**
 * Fixed pairings (not dependent on which groups have qualifying third-place teams).
 * These are always:
 *   E-1 vs A-2, F-1 vs B-2, C-2 vs D-2, E-2 vs F-2
 */
const FIXED_PAIRINGS: R16Pairing[] = [
  { group: "E", winner: "E", opponentGroup: "A", isFixed: true },
  { group: "F", winner: "F", opponentGroup: "B", isFixed: true },
  { group: "C", winner: "C", opponentGroup: "D", isFixed: true },
  { group: "E", winner: "E", opponentGroup: "F", isFixed: true },
];

/**
 * Build the R16 matrix key from a set of 4 group codes.
 * Key must be in sorted alphabetical order.
 */
export function buildMatrixKey(qualifyingGroupCodes: string[]): string {
  return [...qualifyingGroupCodes].sort().join(",");
}

/**
 * Gets the 4 dynamic pairings for groups A-D from the matrix.
 */
export function getDynamicPairings(
  qualifyingGroupCodes: string[]
): R16Pairing[] {
  const key = buildMatrixKey(qualifyingGroupCodes);
  const mapping = R16_MATRIX[key];
  if (!mapping) {
    throw new Error(`Invalid qualifying groups: ${key}. Must be exactly 4 groups from A-F.`);
  }

  return Object.entries(mapping).map(([winnerGroup, opponentGroup]) => ({
    group: winnerGroup,
    winner: winnerGroup,
    opponentGroup,
    isFixed: false,
  }));
}

/**
 * Gets all 8 R16 pairings (4 dynamic + 4 fixed).
 */
export function getAllR16Pairings(
  qualifyingGroupCodes: string[]
): R16Pairing[] {
  return [...getDynamicPairings(qualifyingGroupCodes), ...FIXED_PAIRINGS];
}

export interface StandingWithGroup extends Standing {
  groupCode: string;
}

export function getQualifyingThirdPlaceGroupCodes(
  thirdPlaceStandings: StandingWithGroup[]
): string[] {
  return thirdPlaceStandings.slice(0, 4).map((s) => s.groupCode);
}
