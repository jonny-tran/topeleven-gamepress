import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, envelopedManagerProcedure, envelopedPublicProcedure } from "../index";
import {
  requireTournamentManage,
  requireTournamentRead,
} from "../access";
import { tournament, tournamentGroup, team, match, type NewMatch } from "@topEleven-gamepress/db/schema";
import {
  initDrawState,
  shufflePot,
  autoPickTeam,
  describeCurrentStep,
  getCurrentGroupCode,
  isLastGroup,
  getCurrentPositionInGroup,
  getValidTeamsForGroup,
  getConflictingTeams,
  GROUP_CODES,
  POT_NUMBERS,
  type DrawState,
} from "@topEleven-gamepress/db/utils/draw";
import { generateGroupSchedule } from "@topEleven-gamepress/db/utils/group-schedule";

/** Serializable version of DrawState for tRPC */
export interface DrawStateDTO {
  currentGroupIndex: number;
  currentGroupCode: string;
  currentPot: number;
  currentPosition: number;
  assignedTeams: Array<{
    id: string;
    name: string;
    pot: number;
    groupCode: string;
    position: number;
    associationCode: string;
  }>;
  remainingByPot: Record<number, Array<{ id: string; name: string; associationCode: string }>>;
  groups: Record<string, Array<{ id: string; name: string; pot: number; position: number; associationCode: string }>>;
  validTeamsForCurrentGroup: Array<{ id: string; name: string; associationCode: string }>;
  conflictingTeamsForCurrentGroup: Array<{ id: string; name: string; associationCode: string }>;
  isComplete: boolean;
  currentStepDescription: string;
  canProceed: boolean;
  totalSteps: number;
  completedSteps: number;
  /** Tournament status (setup | draw_in_progress | draw_completed | ...). Present in getState response only. */
  tournamentStatus?: string;
  /** Whether the tournament is publicly visible. Present in getState response only. */
  isPublic?: boolean;
}

function toDTO(state: DrawState): DrawStateDTO {
  const remainingByPot: DrawStateDTO["remainingByPot"] = {};
  for (const pot of POT_NUMBERS) {
    remainingByPot[pot] = (state.remainingByPot.get(pot) ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      associationCode: t.associationCode,
    }));
  }

  const groups: DrawStateDTO["groups"] = {};
  for (const code of GROUP_CODES) {
    groups[code] = (state.groups.get(code) ?? []).map((t, idx) => ({
      id: t.id,
      name: t.name,
      pot: t.pot,
      position: idx + 1,
      associationCode: t.associationCode,
    }));
  }

  // Compute valid / conflicting teams for the current group from the current pot.
  // Bảng F is auto-fill: all remaining teams are valid (no conflict checks).
  const validTeamsForCurrentGroup: DrawStateDTO["validTeamsForCurrentGroup"] = [];
  const conflictingTeamsForCurrentGroup: DrawStateDTO["conflictingTeamsForCurrentGroup"] = [];
  if (!state.isComplete) {
    const potRemaining = state.remainingByPot.get(state.currentPot) ?? [];
    if (isLastGroup(state)) {
      // Auto-fill: anything left in this pot is fair game
      validTeamsForCurrentGroup.push(
        ...potRemaining.map((t) => ({
          id: t.id,
          name: t.name,
          associationCode: t.associationCode,
        }))
      );
    } else {
      const currentGroupTeams = state.groups.get(getCurrentGroupCode(state)) ?? [];
      validTeamsForCurrentGroup.push(
        ...getValidTeamsForGroup(potRemaining, currentGroupTeams).map((t) => ({
          id: t.id,
          name: t.name,
          associationCode: t.associationCode,
        }))
      );
      conflictingTeamsForCurrentGroup.push(
        ...getConflictingTeams(potRemaining, currentGroupTeams).map((t) => ({
          id: t.id,
          name: t.name,
          associationCode: t.associationCode,
        }))
      );
    }
  }

  return {
    currentGroupIndex: state.currentGroupIndex,
    currentGroupCode: getCurrentGroupCode(state),
    currentPot: state.currentPot,
    currentPosition: getCurrentPositionInGroup(state),
    assignedTeams: state.assignedTeams.map((t) => {
      const groupCode = GROUP_CODES.find(
        (c) => state.groups.get(c)?.some((g) => g.id === t.id)
      ) ?? "?";
      const position = state.groups.get(groupCode)?.findIndex((g) => g.id === t.id) ?? 0;
      return {
        id: t.id,
        name: t.name,
        pot: t.pot,
        groupCode,
        position: position + 1,
        associationCode: t.associationCode,
      };
    }),
    remainingByPot,
    groups,
    validTeamsForCurrentGroup,
    conflictingTeamsForCurrentGroup,
    isComplete: state.isComplete,
    currentStepDescription: describeCurrentStep(state),
    canProceed: (() => {
      if (state.isComplete) return false;
      const potRemaining = state.remainingByPot.get(state.currentPot) ?? [];
      // Bảng F auto-fills as long as current pot still has teams
      if (isLastGroup(state)) return potRemaining.length > 0;
      const currentGroupTeams = state.groups.get(getCurrentGroupCode(state)) ?? [];
      return getValidTeamsForGroup(potRemaining, currentGroupTeams).length > 0;
    })(),
    totalSteps: 24,
    completedSteps: state.assignedTeams.length,
  };
}

export const drawRouter = router({
  /**
   * Trạng thái bốc thăm hiện tại.
   *
   * Trả về cả danh sách 24 đội và bảng đã xếp, nên cần quyền xem giải:
   * giải công khai thì mọi khách xem được, bản nháp thì chỉ chủ giải và admin.
   */
  getState: envelopedPublicProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireTournamentRead(ctx, input.tournamentId);

      // Get tournament
      const t = await ctx.db.query.tournament.findFirst({
        where: eq(tournament.id, input.tournamentId),
      });
      if (!t) throw new Error("Tournament not found");

      // Get all teams
      const allTeams = await ctx.db.query.team.findMany({
        where: eq(team.tournamentId, input.tournamentId),
      });

      // Check which teams are already assigned
      const assignedTeams = allTeams.filter((t) => t.groupId !== null);
      const unassignedTeams = allTeams.filter((t) => t.groupId === null);

      if (assignedTeams.length === 0) {
        // Not started
        const state = initDrawState(unassignedTeams.length > 0 ? unassignedTeams : allTeams);
        return { ...toDTO(state), started: false, tournamentStatus: t.status, isPublic: t.isPublic };
      }

      if (assignedTeams.length === 24) {
        // Complete
        const state = initDrawState([]);
        // Manually reconstruct groups into state so toDTO() can return them.
        state.groups = new Map<string, typeof assignedTeams>();
        for (const code of GROUP_CODES) state.groups.set(code, []);
        for (const t of assignedTeams) {
          const g = await ctx.db.query.tournamentGroup.findFirst({
            where: eq(tournamentGroup.id, t.groupId!),
          });
          if (g) {
            state.groups.get(g.code)?.push(t);
          }
        }
        return {
          ...toDTO({ ...state, isComplete: true, assignedTeams }),
          started: true,
          tournamentStatus: t.status,
          isPublic: t.isPublic,
        };
      }

      // In progress - reconstruct state
      const state = initDrawState(unassignedTeams);
      for (const t of assignedTeams) {
        const g = await ctx.db.query.tournamentGroup.findFirst({
          where: eq(tournamentGroup.id, t.groupId!),
        });
        if (g) {
          const groupTeams = state.groups.get(g.code) ?? [];
          groupTeams.push(t);
          state.groups.set(g.code, groupTeams);
          state.assignedTeams.push(t);
          // Remove from remaining
          const remaining = state.remainingByPot.get(t.pot) ?? [];
          state.remainingByPot.set(t.pot, remaining.filter((r) => r.id !== t.id));
        }
      }
      // Recompute current position (Group-first order: Group A→B→...→E, then F auto-fill).
      // Each group needs 4 teams (one per pot 1→4). So:
      //   N=1-4   → Group A, pots 1→2→3→4
      //   N=5-8   → Group B, pots 1→2→3→4
      //   ...
      //   N=17-20 → Group E, pots 1→2→3→4
      //   N=21-24 → Group F, auto-fill pots 1→2→3→4
      const assignedCount = assignedTeams.length;
      const currentGroupIndex = Math.min(Math.floor((assignedCount) / 4), 5);
      const positionInGroup = assignedCount % 4; // 0,1,2,3
      const currentPot = positionInGroup + 1;   // 1,2,3,4
      state.currentGroupIndex = currentGroupIndex;
      state.currentPot = currentPot;

      return { ...toDTO(state), started: true, tournamentStatus: t.status, isPublic: t.isPublic };
    }),

  /** Shuffle the current pot and return the shuffled order */
  shufflePot: envelopedManagerProcedure
    .input(z.object({ tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireTournamentManage(ctx, input.tournamentId);
      const allTeams = await ctx.db.query.team.findMany({
        where: eq(team.tournamentId, input.tournamentId),
      });
      const assignedIds = new Set(
        allTeams.filter((t) => t.groupId !== null).map((t) => t.id)
      );
      const unassigned = allTeams.filter((t) => !assignedIds.has(t.id));

      // Find current pot from state
      const state = initDrawState(unassigned);
      for (const t of allTeams) {
        if (t.groupId) {
          const g = await ctx.db.query.tournamentGroup.findFirst({
            where: eq(tournamentGroup.id, t.groupId),
          });
          if (g) {
            const gt = state.groups.get(g.code) ?? [];
            gt.push(t);
            state.groups.set(g.code, gt);
            state.assignedTeams.push(t);
            const rem = state.remainingByPot.get(t.pot) ?? [];
            state.remainingByPot.set(t.pot, rem.filter((r) => r.id !== t.id));
          }
        }
      }

      // Find current position based on assigned count:
      //   0 assigned → Group A, Pot 1
      //   1-3 assigned → Group A, Pot (count+1)
      //   4 assigned → Group B, Pot 1
      //   20 assigned → Group F (auto-fill), Pot 1
      //   24 assigned → complete
      const assignedCount = state.assignedTeams.length;
      if (assignedCount >= 24) {
        state.isComplete = true;
      } else {
        state.currentGroupIndex = Math.min(Math.floor(assignedCount / 4), 5);
        state.currentPot = (assignedCount % 4) + 1;
      }

      const pot = state.currentPot;
      const remaining = state.remainingByPot.get(pot) ?? [];
      const shuffled = shufflePot(remaining);

      return {
        pot,
        teams: shuffled.map((t) => ({ id: t.id, name: t.name, associationCode: t.associationCode })),
        currentGroupCode: getCurrentGroupCode(state),
        stepDescription: describeCurrentStep(state),
      };
    }),

  /** Auto-pick (random) a team from current pot, skipping conflicts */
  autoPick: envelopedManagerProcedure
    .input(z.object({ tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireTournamentManage(ctx, input.tournamentId);
      const allTeams = await ctx.db.query.team.findMany({
        where: eq(team.tournamentId, input.tournamentId),
      });
      const assignedIds = new Set(
        allTeams.filter((t) => t.groupId !== null).map((t) => t.id)
      );
      const unassigned = allTeams.filter((t) => !assignedIds.has(t.id));

      // Reconstruct state
      const state = initDrawState(unassigned);
      for (const t of allTeams) {
        if (t.groupId) {
          const g = await ctx.db.query.tournamentGroup.findFirst({
            where: eq(tournamentGroup.id, t.groupId),
          });
          if (g) {
            const gt = state.groups.get(g.code) ?? [];
            gt.push(t);
            state.groups.set(g.code, gt);
            state.assignedTeams.push(t);
            const rem = state.remainingByPot.get(t.pot) ?? [];
            state.remainingByPot.set(t.pot, rem.filter((r) => r.id !== t.id));
          }
        }
      }

      // Find current position based on assigned count:
      //   0 assigned → Group A, Pot 1
      //   1-3 assigned → Group A, Pot (count+1)
      //   4 assigned → Group B, Pot 1
      //   ...
      //   20 assigned → Group F (auto-fill), Pot 1
      //   24 assigned → complete
      const assignedCount = state.assignedTeams.length;
      if (assignedCount >= 24) {
        state.isComplete = true;
      } else {
        state.currentGroupIndex = Math.min(Math.floor(assignedCount / 4), 5);
        state.currentPot = (assignedCount % 4) + 1;
      }

      const result = autoPickTeam(state);

      if (!result.pickedTeam) {
        return {
          success: false,
          error: result.error,
          state: toDTO(state),
          skipped: result.skipped.map((t) => t.associationCode),
        };
      }

      // Persist to DB: assign team to group
      const groupCode = getCurrentGroupCode(state);
      // Find the group with this code
      const groups = await ctx.db.query.tournamentGroup.findMany({
        where: eq(tournamentGroup.tournamentId, input.tournamentId),
      });
      const targetGroup = groups.find((g) => g.code === groupCode);
      if (!targetGroup) throw new Error(`Group ${groupCode} not found`);

      const position = getCurrentPositionInGroup(state);

      await ctx.db
        .update(team)
        .set({ groupId: targetGroup.id, position })
        .where(eq(team.id, result.pickedTeam.id));

      // Update tournament status to draw_in_progress if not already
      const t = await ctx.db.query.tournament.findFirst({
        where: eq(tournament.id, input.tournamentId),
      });
      if (t && t.status === "setup") {
        await ctx.db
          .update(tournament)
          .set({ status: "draw_in_progress" })
          .where(eq(tournament.id, input.tournamentId));
      }

      return {
        success: true,
        drawnTeam: {
          id: result.pickedTeam.id,
          name: result.pickedTeam.name,
          associationCode: result.pickedTeam.associationCode,
          groupCode,
          position,
        },
        state: toDTO(result.state),
        skipped: result.skipped.map((t) => t.associationCode),
        isComplete: result.state.isComplete,
      };
    }),

  /** Confirm the draw and generate group stage matches */
  confirmDraw: envelopedManagerProcedure
    .input(z.object({ tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireTournamentManage(ctx, input.tournamentId);

      // Verify all 24 teams are assigned
      const allTeams = await ctx.db.query.team.findMany({
        where: eq(team.tournamentId, input.tournamentId),
      });

      const unassigned = allTeams.filter((t) => t.groupId === null);
      if (unassigned.length > 0) {
        throw new Error(`Cannot confirm draw: ${unassigned.length} teams still unassigned`);
      }

      // Get tournament start date
      const t = await ctx.db.query.tournament.findFirst({
        where: eq(tournament.id, input.tournamentId),
        with: { groups: true },
      });
      if (!t) throw new Error("Tournament not found");

      // Generate matches for each group
      const matchesToInsert: NewMatch[] = [];

      for (const group of t.groups) {
        const groupTeams = await ctx.db.query.team.findMany({
          where: eq(team.groupId, group.id),
        });
        const groupMatches = generateGroupSchedule(
          groupTeams,
          input.tournamentId,
          group.id,
          t.startDate
        );
        matchesToInsert.push(...groupMatches);
      }

      if (matchesToInsert.length > 0) {
        await ctx.db.insert(match).values(matchesToInsert);
      }

      // Update tournament status
      await ctx.db
        .update(tournament)
        .set({ status: "draw_completed" })
        .where(eq(tournament.id, input.tournamentId));

      return {
        success: true,
        matchesCreated: matchesToInsert.length,
      };
    }),

  /** Reset draw (clear all group assignments) */
  resetDraw: envelopedManagerProcedure
    .input(z.object({ tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireTournamentManage(ctx, input.tournamentId);
      const t = await ctx.db.query.tournament.findFirst({
        where: eq(tournament.id, input.tournamentId),
      });
      if (!t) throw new Error("Tournament not found");

      // Guard: refuse if tournament is already public
      if (t.isPublic) {
        throw new Error(
          "Không thể đặt lại bốc thăm: giải đấu đã được công khai. Hãy bỏ công khai trước.",
        );
      }

      // Guard: refuse if tournament has progressed beyond draw (confirmed + schedule created)
      if (["group_stage", "knockout", "completed"].includes(t.status)) {
        throw new Error(
          "Không thể đặt lại bốc thăm: giải đấu đã tiến vào giai đoạn thi đấu. Hãy đóng giải trước.",
        );
      }

      // Clear group assignments
      await ctx.db
        .update(team)
        .set({ groupId: null, position: null })
        .where(eq(team.tournamentId, input.tournamentId));

      // Delete all group stage matches
      await ctx.db
        .delete(match)
        .where(eq(match.tournamentId, input.tournamentId));

      // Reset tournament status
      await ctx.db
        .update(tournament)
        .set({ status: "setup" })
        .where(eq(tournament.id, input.tournamentId));

      return { success: true };
    }),

  /**
   * Undo the most recently drawn team.
   *
   * Draw order is Group-First: A1 → A2 → A3 → A4 → B1 → ... → F4.
   * Given N assigned teams, the last drawn team is at draw order (N - 1),
   * which maps to `groupIndex = floor((N-1) / 4)` and `position = ((N-1) % 4) + 1`.
   * Since each group gets one team per pot in order, position === pot for that team.
   *
   * Use case: when a deadlock is hit at Bảng E (or any A–E group) because every
   * remaining team in the current pot shares an `associationCode` with an
   * already-assigned team in that group. Admin can undo the previous draw to
   * free up that pot, then re-attempt — usually a different team becomes valid.
   *
   * Allowed while draw is in progress (`status = "draw_in_progress"`).
   * Refused once the draw is confirmed (`status = "draw_completed"`); admin
   * must use `resetDraw` to start over after confirmation.
   */
  undoLastDraw: envelopedManagerProcedure
    .input(z.object({ tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireTournamentManage(ctx, input.tournamentId);

      // 1. Tournament must exist and not be confirmed yet
      const t = await ctx.db.query.tournament.findFirst({
        where: eq(tournament.id, input.tournamentId),
      });
      if (!t) throw new Error("Tournament not found");
      if (t.status === "setup") {
        throw new Error("Không thể hoàn tác: bốc thăm chưa bắt đầu.");
      }
      if (t.status === "draw_completed") {
        throw new Error(
          "Không thể hoàn tác: bốc thăm đã được xác nhận. Dùng \"Đặt lại\" nếu muốn bốc lại từ đầu.",
        );
      }

      // 2. Find the last drawn team based on draw order (Group-First).
      const allTeams = await ctx.db.query.team.findMany({
        where: eq(team.tournamentId, input.tournamentId),
      });
      const assigned = allTeams.filter((tm) => tm.groupId !== null);
      if (assigned.length === 0) {
        throw new Error("Không thể hoàn tác: chưa có đội nào được bốc.");
      }

      const lastOrder = assigned.length - 1; // 0-indexed
      const groupIndex = Math.floor(lastOrder / 4);
      const positionInGroup = (lastOrder % 4) + 1;
      const targetGroupCode = GROUP_CODES[groupIndex];
      if (!targetGroupCode) {
        throw new Error("Trạng thái bốc thăm không hợp lệ, không thể xác định đội cần hoàn tác.");
      }

      // 3. Resolve the target group row by code
      const groups = await ctx.db.query.tournamentGroup.findMany({
        where: eq(tournamentGroup.tournamentId, input.tournamentId),
      });
      const targetGroup = groups.find((g) => g.code === targetGroupCode);
      if (!targetGroup) throw new Error(`Không tìm thấy bảng ${targetGroupCode}.`);

      const teamToUndo = assigned.find(
        (tm) => tm.groupId === targetGroup.id && tm.position === positionInGroup,
      );
      if (!teamToUndo) {
        throw new Error(
          `Không tìm thấy đội ở ${targetGroupCode} vị trí ${positionInGroup} để hoàn tác.`,
        );
      }

      // 4. Clear the assignment
      await ctx.db
        .update(team)
        .set({ groupId: null, position: null })
        .where(eq(team.id, teamToUndo.id));

      return {
        success: true,
        undoneTeam: {
          id: teamToUndo.id,
          name: teamToUndo.name,
          associationCode: teamToUndo.associationCode,
          groupCode: targetGroupCode,
          position: positionInGroup,
          pot: positionInGroup, // Group-First: position N in a group = pot N
        },
      };
    }),

  /**
   * Auto-fill all 4 remaining teams into Bảng F in a single shot.
   * Called once when the draw transitions from E → F so the UI can skip
   * the cycling animation for the last group.
   *
   * Pre-conditions:
   *  - 20 teams already assigned (groups A–E complete)
   *  - 4 teams still unassigned
   */
  fillLastGroup: envelopedManagerProcedure
    .input(z.object({ tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireTournamentManage(ctx, input.tournamentId);
      const allTeams = await ctx.db.query.team.findMany({
        where: eq(team.tournamentId, input.tournamentId),
      });
      const groups = await ctx.db.query.tournamentGroup.findMany({
        where: eq(tournamentGroup.tournamentId, input.tournamentId),
      });
      const groupF = groups.find((g) => g.code === "F");
      if (!groupF) throw new Error("Group F not found");

      const assigned = allTeams.filter((t) => t.groupId !== null);
      if (assigned.length !== 20) {
        throw new Error(
          `Cannot fill last group: ${assigned.length}/20 teams assigned (need exactly 20).`,
        );
      }

      const remaining = allTeams.filter((t) => t.groupId === null);
      if (remaining.length !== 4) {
        throw new Error(
          `Expected 4 remaining teams for Group F, got ${remaining.length}.`,
        );
      }

      // Shuffle then persist each into Group F with positions 1..4.
      const shuffled = shufflePot(remaining);
      const drawn: Array<{ id: string; name: string; associationCode: string; position: number }> = [];
      for (let i = 0; i < shuffled.length; i++) {
        const teamRow = shuffled[i]!;
        await ctx.db
          .update(team)
          .set({ groupId: groupF.id, position: i + 1 })
          .where(eq(team.id, teamRow.id));
        drawn.push({
          id: teamRow.id,
          name: teamRow.name,
          associationCode: teamRow.associationCode,
          position: i + 1,
        });
      }

      // Tournament status: only flip to draw_in_progress if still in setup.
      const t = await ctx.db.query.tournament.findFirst({
        where: eq(tournament.id, input.tournamentId),
      });
      if (t && t.status === "setup") {
        await ctx.db
          .update(tournament)
          .set({ status: "draw_in_progress" })
          .where(eq(tournament.id, input.tournamentId));
      }

      return { success: true, drawn };
    }),
});
