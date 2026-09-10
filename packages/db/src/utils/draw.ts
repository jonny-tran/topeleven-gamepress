import type { Team } from "../schema/tournament";

/**
 * Fisher-Yates shuffle for randomizing a team pool.
 */
export function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

/**
 * Shuffles teams in a pot for display purposes.
 * Returns a new shuffled array (does not mutate input).
 */
export function shufflePot(teams: Team[]): Team[] {
  return shuffleArray(teams);
}

/**
 * Draw state tracking for sequential draw.
 * Models the current position in the draw process.
 *
 * Draw order: Group (outer loop) → Pot (inner loop).
 *   Bảng A: Pot 1 → 2 → 3 → 4
 *   Bảng B: Pot 1 → 2 → 3 → 4
 *   ...
 *   Bảng F: auto-fill (no manual draw)
 *
 * State variables:
 *   currentGroupIndex  — which group (0–5)
 *   currentPot        — which pot (1–4), always = 1 after advancing group
 *   currentStep       — how many teams have been placed (0–24)
 */
export interface DrawState {
  /** Current group index (0–5); frozen at 5 (Bảng F) once all A–E are done */
  currentGroupIndex: number;
  /** Current pot number (1–4); always 1 when entering a new group */
  currentPot: number;
  /** All teams that have been assigned to groups */
  assignedTeams: Team[];
  /** Remaining teams per pot (key = pot number) */
  remainingByPot: Map<number, Team[]>;
  /** Teams assigned per group code (key = group code like 'A', 'B', ...) */
  groups: Map<string, Team[]>;
  /** Whether draw is complete (24 teams assigned) */
  isComplete: boolean;
}

export const GROUP_CODES = ["A", "B", "C", "D", "E", "F"] as const;
export const POT_NUMBERS = [1, 2, 3, 4] as const;

/**
 * Initializes a draw state from a list of all 24 teams.
 * All teams start unassigned.
 */
export function initDrawState(allTeams: Team[]): DrawState {
  const remainingByPot = new Map<number, Team[]>();
  for (const pot of POT_NUMBERS) {
    remainingByPot.set(pot, allTeams.filter((t) => t.pot === pot));
  }
  const groups = new Map<string, Team[]>();
  for (const code of GROUP_CODES) {
    groups.set(code, []);
  }
  return {
    currentGroupIndex: 0,
    currentPot: 1,
    assignedTeams: [],
    remainingByPot,
    groups,
    isComplete: false,
  };
}

/**
 * Returns the current group code (A–F).
 * When currentGroupIndex === 5 (Bảng F), the system auto-fills.
 */
export function getCurrentGroupCode(state: DrawState): string {
  return GROUP_CODES[state.currentGroupIndex]!;
}

/**
 * Returns true if the current group is Bảng F (index 5),
 * meaning auto-fill mode is active.
 */
export function isLastGroup(state: DrawState): boolean {
  return state.currentGroupIndex === 5;
}

/**
 * Gets the current position in the group (1-4) based on how many teams have been assigned.
 */
export function getCurrentPositionInGroup(state: DrawState): number {
  const groupCode = getCurrentGroupCode(state);
  return (state.groups.get(groupCode)?.length ?? 0) + 1;
}

/**
 * Finds the next valid team from the pot that does NOT share an association
 * code with any team already in the target group.
 */
export function findValidTeam(
  teamsInPot: Team[],
  targetGroup: Team[]
): Team | null {
  for (const candidate of teamsInPot) {
    const hasConflict = targetGroup.some(
      (t) => t.associationCode === candidate.associationCode
    );
    if (!hasConflict) {
      return candidate;
    }
  }
  return null;
}

/**
 * Gets teams remaining in the current pot that are valid for the target group.
 */
export function getValidTeamsForGroup(
  teamsInPot: Team[],
  targetGroup: Team[]
): Team[] {
  return teamsInPot.filter(
    (candidate) =>
      !targetGroup.some((t) => t.associationCode === candidate.associationCode)
  );
}

/**
 * Gets teams remaining in the current pot that CONFLICT with the target group.
 */
export function getConflictingTeams(
  teamsInPot: Team[],
  targetGroup: Team[]
): Team[] {
  return teamsInPot.filter((candidate) =>
    targetGroup.some((t) => t.associationCode === candidate.associationCode)
  );
}

/**
 * Performs one draw step: assigns a team to the current group.
 * Automatically skips association conflicts.
 *
 * Order: Group (outer) → Pot (inner).
 * When the current group has 4 teams → advance to next group (pot resets to 1).
 * When all A–E groups are filled → switch to auto-fill mode for group F.
 */
export function performDrawStep(
  state: DrawState,
  teamId: string
): { state: DrawState; drawnTeam: Team | null; skipped: Team[]; error: string | null } {
  if (state.isComplete) {
    return { state, drawnTeam: null, skipped: [], error: "Draw is already complete" };
  }

  const groupCode = getCurrentGroupCode(state);
  const pot = state.currentPot;
  const remaining = state.remainingByPot.get(pot) ?? [];
  const targetGroup = state.groups.get(groupCode) ?? [];

  const team = remaining.find((t) => t.id === teamId);
  if (!team) {
    return { state, drawnTeam: null, skipped: [], error: "Team not found in current pot" };
  }

  // Check if this is a conflict (only for A–E; F is auto-fill so skip check)
  const isConflict = !isLastGroup(state) && targetGroup.some(
    (t) => t.associationCode === team.associationCode
  );

  if (isConflict) {
    return {
      state,
      drawnTeam: null,
      skipped: [],
      error: `Team conflicts with existing team in group ${groupCode} (same association)`,
    };
  }

  // Update remaining
  const newRemaining = remaining.filter((t) => t.id !== teamId);
  const newRemainingByPot = new Map(state.remainingByPot);
  newRemainingByPot.set(pot, newRemaining);

  // Update groups
  const newGroups = new Map(state.groups);
  newGroups.set(groupCode, [...targetGroup, team]);

  // Update assigned
  const newAssigned = [...state.assignedTeams, team];

  // ── Determine next position (Group-first order) ──────────────────────────
  const filledInCurrentGroup = newGroups.get(groupCode)!.length;
  let newGroupIndex = state.currentGroupIndex;
  let newPot = state.currentPot;

  if (filledInCurrentGroup >= 4) {
    // Current group is full (4 teams) → move to next group, pot resets to 1
    newGroupIndex = state.currentGroupIndex + 1;
    newPot = 1;
  } else {
    // Group not yet full → stay in same group, advance to next pot
    newPot = state.currentPot + 1;
  }

  // If we just finished group E (index 4), switch to auto-fill for group F (index 5)
  const isComplete = newGroupIndex >= 6;

  return {
    state: {
      currentGroupIndex: newGroupIndex,
      currentPot: newPot,
      assignedTeams: newAssigned,
      remainingByPot: newRemainingByPot,
      groups: newGroups,
      isComplete,
    },
    drawnTeam: team,
    skipped: [],
    error: null,
  };
}

/**
 * Auto-draws the next team in the current pot, skipping conflicts.
 * Randomly picks from valid teams.
 *
 * For group F (last group): picks any remaining team from the current pot
 * (no conflict check needed — F is auto-filled last).
 */
export function autoPickTeam(state: DrawState): {
  pickedTeam: Team | null;
  skipped: Team[];
  state: DrawState;
  error: string | null;
} {
  if (state.isComplete) {
    return { pickedTeam: null, skipped: [], state, error: "Draw is complete" };
  }

  const groupCode = getCurrentGroupCode(state);
  const pot = state.currentPot;
  const remaining = state.remainingByPot.get(pot) ?? [];
  const targetGroup = state.groups.get(groupCode) ?? [];

  // Group F: just pick any remaining team from the current pot
  if (isLastGroup(state)) {
    if (remaining.length === 0) {
      return {
        pickedTeam: null,
        skipped: [],
        state,
        error: `No more teams left for Pot ${pot} when filling Bảng ${groupCode}`,
      };
    }
    const shuffled = shuffleArray(remaining);
    const picked = shuffled[0]!;
    const result = performDrawStep(state, picked.id);
    return {
      pickedTeam: result.drawnTeam,
      skipped: result.skipped,
      state: result.state,
      error: result.error,
    };
  }

  // Groups A–E: skip association conflicts
  const validTeams = getValidTeamsForGroup(remaining, targetGroup);
  const conflictingTeams = getConflictingTeams(remaining, targetGroup);

  if (validTeams.length === 0) {
    return {
      pickedTeam: null,
      skipped: conflictingTeams,
      state,
      error: `Không có đội hợp lệ trong Pot ${pot} cho Bảng ${groupCode}. Tất cả các đội còn lại đều cùng liên đoàn với một đội trong bảng.`,
    };
  }

  // Randomly pick from valid teams
  const shuffled = shuffleArray(validTeams);
  const picked = shuffled[0]!;

  const result = performDrawStep(state, picked.id);
  return {
    pickedTeam: result.drawnTeam,
    skipped: result.skipped,
    state: result.state,
    error: result.error,
  };
}

/**
 * Checks if the draw can proceed (at least one valid team in current pot).
 */
export function canProceed(state: DrawState): boolean {
  if (state.isComplete) return false;
  const groupCode = getCurrentGroupCode(state);
  const pot = state.currentPot;
  const remaining = state.remainingByPot.get(pot) ?? [];
  const targetGroup = state.groups.get(groupCode) ?? [];
  // Bảng F always auto-proceeds (no conflict blocking needed from UI)
  if (isLastGroup(state)) return remaining.length > 0;
  return getValidTeamsForGroup(remaining, targetGroup).length > 0;
}

/**
 * Returns a human-readable description of the current draw step.
 */
export function describeCurrentStep(state: DrawState): string {
  if (state.isComplete) return "Bốc thăm hoàn tất";
  const groupCode = getCurrentGroupCode(state);
  if (isLastGroup(state)) {
    const pot = state.currentPot;
    return `Tự động điền Bảng ${groupCode} — Pot ${pot}`;
  }
  const pot = state.currentPot;
  return `Bốc Pot ${pot} cho Bảng ${groupCode}`;
}
