import { z } from "zod";
import { eq, and, asc, inArray } from "drizzle-orm";
import { router, envelopedManagerProcedure, envelopedPublicProcedure } from "../index";
import {
  requireTournamentManage,
  requireTournamentRead,
  tournamentIdOfMatch,
} from "../access";
import { match, matchResult, team, tournament, tournamentGroup, type NewMatch } from "@topEleven-gamepress/db/schema";
import { nanoid } from "nanoid";
import { resolveKnockoutWinner, BRACKET_SLOTS, getLeg2Slot } from "@topEleven-gamepress/db/utils/knockout";
import { getAllR16Pairings } from "@topEleven-gamepress/db/utils/round-of-16";
import { calculateGroupStandingFromData } from "@topEleven-gamepress/db/utils/standings";
import { nextWeekday } from "@topEleven-gamepress/db/utils/date-skip";

/** Bracket slot definition */
export interface BracketSlotInfo {
  slot: string;
  stage: "round_of_16" | "quarter" | "semi" | "third_place" | "final";
  leg: 1 | 2;
  homeTeam: { id: string; name: string } | null;
  awayTeam: { id: string; name: string } | null;
  homeScore: number | null;
  awayScore: number | null;
  winner: { id: string; name: string } | null;
  pendingDraw: boolean;
  nextSlot: string | null;
  matchId: string | null;
}

export const knockoutRouter = router({
  /** Generate knockout bracket after group stage */
  generateBracket: envelopedManagerProcedure
    .input(z.object({ tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireTournamentManage(ctx, input.tournamentId);
      const t = await ctx.db.query.tournament.findFirst({
        where: eq(tournament.id, input.tournamentId),
      });
      if (!t) throw new Error("Tournament not found");
      if (t.status !== "draw_completed") {
        throw new Error("Draw must be completed before generating knockout bracket");
      }

      // Get all group standings
      const groups = await ctx.db.query.tournamentGroup.findMany({
        where: eq(tournamentGroup.tournamentId, input.tournamentId),
        orderBy: [asc(tournamentGroup.code)],
      });

      type GroupRank = { teamId: string; teamName: string; position: number };
      const groupRankings = new Map<string, GroupRank[]>();

      for (const group of groups) {
        const groupTeams = await ctx.db.query.team.findMany({ where: eq(team.groupId, group.id) });
        const groupMatches = await ctx.db.query.match.findMany({
          where: and(
            eq(match.groupId, group.id),
            eq(match.stage, "group"),
            eq(match.status, "completed")
          ),
        });
        const matchIds = groupMatches.map((m) => m.id);
        const results = matchIds.length > 0
          ? await ctx.db.query.matchResult.findMany({ where: inArray(matchResult.matchId, matchIds) })
          : [];
        const standings = calculateGroupStandingFromData(groupTeams, groupMatches, results);
        const ranked: GroupRank[] = standings.map((s, idx) => ({
          teamId: s.teamId,
          teamName: s.teamName,
          position: idx + 1,
        }));
        groupRankings.set(group.code, ranked);
      }

      // Get qualified 3rd-place teams
      const thirdPlaceTeams: Array<{ teamId: string; groupCode: string; points: number; goalDiff: number; goalsFor: number; fairPlayPoints: number }> = [];
      for (const group of groups) {
        const groupTeams = await ctx.db.query.team.findMany({ where: eq(team.groupId, group.id) });
        const groupMatches = await ctx.db.query.match.findMany({
          where: and(
            eq(match.groupId, group.id),
            eq(match.stage, "group"),
            eq(match.status, "completed")
          ),
        });
        const matchIds = groupMatches.map((m) => m.id);
        const results = matchIds.length > 0
          ? await ctx.db.query.matchResult.findMany({ where: inArray(matchResult.matchId, matchIds) })
          : [];
        const standings = calculateGroupStandingFromData(groupTeams, groupMatches, results);
        const third = standings[2];
        if (third) {
          thirdPlaceTeams.push({
            teamId: third.teamId,
            groupCode: group.code,
            points: third.points,
            goalDiff: third.goalDiff,
            goalsFor: third.goalsFor,
            fairPlayPoints: third.fairPlayPoints,
          });
        }
      }
      const qualified3rd = [...thirdPlaceTeams].sort((a, b) => {
        if (a.points !== b.points) return b.points - a.points;
        if (a.goalDiff !== b.goalDiff) return b.goalDiff - a.goalDiff;
        if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
        return a.fairPlayPoints - b.fairPlayPoints;
      }).slice(0, 4);
      const thirdPlaceGroupCodes = qualified3rd.map((s) => s.groupCode);

      const allPairings = getAllR16Pairings(thirdPlaceGroupCodes);

      // R16 starts 8 weeks after tournament start
      const r16Start = nextWeekday(t.startDate, 8 * 7);

      const matchesToInsert: NewMatch[] = [];

      // Generate R16 matches
      for (let i = 0; i < allPairings.length; i++) {
        const pairing = allPairings[i]!;
        const winnerGroup = groupRankings.get(pairing.winner);
        const opponentGroup = groupRankings.get(pairing.opponentGroup);
        if (!winnerGroup || !opponentGroup) continue;

        // Winner is always 1st place; opponent is 2nd (or 3rd for dynamic pairings)
        const winnerTeam = winnerGroup[0];
        const isDynamic = !pairing.isFixed;
        const opponentTeam = isDynamic ? opponentGroup[2] : opponentGroup[1];

        if (!winnerTeam || !opponentTeam) continue;

        const slotLeg1 = `R16_${i + 1}`;
        const slotLeg2 = `R16_${i + 1}L2`;

        // Leg 1: winner home
        matchesToInsert.push({
          id: nanoid(),
          tournamentId: input.tournamentId,
          stage: "round_of_16",
          groupId: null,
          round: 1,
          leg: 1,
          homeTeamId: winnerTeam.teamId,
          awayTeamId: opponentTeam.teamId,
          matchDate: r16Start,
          matchTime: null,
          status: "pending",
          winnerTeamId: null,
          bracketSlot: slotLeg1,
        });

        // Leg 2: opponent home
        const leg2Date = nextWeekday(r16Start, 7);
        matchesToInsert.push({
          id: nanoid(),
          tournamentId: input.tournamentId,
          stage: "round_of_16",
          groupId: null,
          round: 1,
          leg: 2,
          homeTeamId: opponentTeam.teamId,
          awayTeamId: winnerTeam.teamId,
          matchDate: leg2Date,
          matchTime: null,
          status: "pending",
          winnerTeamId: null,
          bracketSlot: slotLeg2,
        });
      }

      // Generate QF, SF, 3RD, FINAL slots (empty, to be filled as winners advance)
      const qfSlots = ["QF_A1", "QF_A2", "QF_B1", "QF_B2"];
      const sfSlots = ["SF_1", "SF_2"];

      for (const slot of [...qfSlots, ...sfSlots, "FINAL", "3RD"]) {
        for (const leg of [1, 2] as const) {
          const isFinal = slot === "FINAL";
          const is3rd = slot === "3RD";
          const stage: NewMatch["stage"] = isFinal ? "final" : is3rd ? "third_place" : slot.startsWith("QF") ? "quarter" : "semi";
          const slotCode = leg === 2 ? `${slot}L2` : slot;
          const matchDate = slot.startsWith("QF")
            ? nextWeekday(r16Start, 14 + (leg - 1) * 7)
            : slot.startsWith("SF")
            ? nextWeekday(r16Start, 21 + (leg - 1) * 7)
            : nextWeekday(r16Start, 28 + (leg - 1) * 7);

          matchesToInsert.push({
            id: nanoid(),
            tournamentId: input.tournamentId,
            stage,
            groupId: null,
            round: 1,
            leg,
            homeTeamId: "",
            awayTeamId: "",
            matchDate,
            matchTime: null,
            status: "pending",
            winnerTeamId: null,
            bracketSlot: slotCode,
          });
        }
      }

      await ctx.db.insert(match).values(matchesToInsert);

      // Update tournament status
      await ctx.db
        .update(tournament)
        .set({ status: "knockout" })
        .where(eq(tournament.id, input.tournamentId));

      return { success: true, matchesCreated: matchesToInsert.length };
    }),

  /** Get full bracket state */
  getBracket: envelopedPublicProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireTournamentRead(ctx, input.tournamentId);
      const matches = await ctx.db.query.match.findMany({
        where: eq(match.tournamentId, input.tournamentId),
        with: { homeTeam: true, awayTeam: true, result: true },
        orderBy: [asc(match.stage), asc(match.matchDate), asc(match.leg)],
      });

      // Group by bracket slot
      const slots: Record<string, BracketSlotInfo> = {};
      for (const m of matches) {
        if (!m.bracketSlot) continue;
        const slotDef = BRACKET_SLOTS.find((s) => s.slot === m.bracketSlot);
        slots[m.bracketSlot] = {
          slot: m.bracketSlot,
          stage: m.stage as BracketSlotInfo["stage"],
          leg: m.leg as 1 | 2,
          homeTeam: m.homeTeam?.id ? { id: m.homeTeam.id, name: m.homeTeam.name } : null,
          awayTeam: m.awayTeam?.id ? { id: m.awayTeam.id, name: m.awayTeam.name } : null,
          homeScore: m.result?.homeScore ?? null,
          awayScore: m.result?.awayScore ?? null,
          winner: m.winnerTeamId
            ? { id: m.winnerTeamId, name: m.homeTeam?.id === m.winnerTeamId ? m.homeTeam.name : (m.awayTeam?.name ?? "") }
            : null,
          pendingDraw: m.result?.pendingDraw ?? false,
          nextSlot: slotDef?.nextSlot ?? null,
          matchId: m.id,
        };
      }

      return slots;
    }),

  /** Advance winner to next round after both legs are completed */
  advanceWinner: envelopedManagerProcedure
    .input(
      z.object({
        matchId: z.string(),
        winnerTeamId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Tra cứu trận trước để biết nó thuộc giải nào, rồi mới xin quyền.
      const access = await tournamentIdOfMatch(ctx, input.matchId);
      await requireTournamentManage(ctx, access.tournamentId);

      // Đội thắng do người dùng chỉ định phải thuộc trận này.
      if (
        input.winnerTeamId &&
        access.homeTeamId !== input.winnerTeamId &&
        access.awayTeamId !== input.winnerTeamId
      ) {
        throw new Error("Đội thắng phải là một trong hai đội đang thi đấu.");
      }

      // Get the leg 2 match
      const leg2Match = await ctx.db.query.match.findFirst({
        where: eq(match.id, input.matchId),
        with: { result: true },
      });
      if (!leg2Match) throw new Error("Match not found");
      if (leg2Match.stage === "group") throw new Error("Group matches don't use advanceWinner");

      // Get leg 1 match
      const leg1Slot = leg2Match.bracketSlot?.replace("L2", "");
      const leg1Match = leg1Slot
        ? await ctx.db.query.match.findFirst({
            where: and(
              eq(match.tournamentId, leg2Match.tournamentId),
              eq(match.bracketSlot, leg1Slot),
              eq(match.leg, 1)
            ),
            with: { result: true },
          })
        : null;

      const leg1Result = leg1Match?.result ?? null;
      const leg2Result = leg2Match.result ?? null;

      // Determine winner
      let winnerId = input.winnerTeamId;
      let pendingDraw = false;

      if (!winnerId && leg1Result && leg2Result) {
        const result = resolveKnockoutWinner(
          leg2Match.homeTeamId,
          leg2Match.awayTeamId,
          leg1Result,
          leg2Result
        );
        winnerId = result.winnerTeamId;
        pendingDraw = result.pendingDraw;

        if (pendingDraw) {
          if (leg2Result) {
            await ctx.db
              .update(matchResult)
              .set({ pendingDraw: true })
              .where(eq(matchResult.matchId, leg2Match.id));
          }
          return { success: false, pendingDraw: true, message: result.reason };
        }
      }

      if (!winnerId) {
        throw new Error("No winner determined. Both legs may not be completed.");
      }

      // Update leg 2 match with winner
      await ctx.db
        .update(match)
        .set({ winnerTeamId: winnerId, status: "completed" })
        .where(eq(match.id, leg2Match.id));

      // Propagate winner to next round slot
      const slotDef = BRACKET_SLOTS.find((s) => s.slot === leg2Match.bracketSlot);
      if (slotDef?.nextSlot) {
        // Find the next match slot (leg 1)
        const nextLeg1Slot = slotDef.nextSlot;
        const nextMatch = await ctx.db.query.match.findFirst({
          where: and(
            eq(match.tournamentId, leg2Match.tournamentId),
            eq(match.bracketSlot, nextLeg1Slot),
            eq(match.leg, 1)
          ),
        });

        if (nextMatch) {
          const isHomeSlot = nextLeg1Slot.includes("1") || nextLeg1Slot === "SF_1" || nextLeg1Slot === "FINAL";
          const updateField = isHomeSlot ? { homeTeamId: winnerId } : { awayTeamId: winnerId };
          await ctx.db
            .update(match)
            .set(updateField)
            .where(eq(match.id, nextMatch.id));
        }

        // Also update leg 2 of next match
        const nextLeg2Slot = getLeg2Slot(nextLeg1Slot);
        const nextLeg2Match = await ctx.db.query.match.findFirst({
          where: and(
            eq(match.tournamentId, leg2Match.tournamentId),
            eq(match.bracketSlot, nextLeg2Slot),
            eq(match.leg, 2)
          ),
        });
        if (nextLeg2Match) {
          const isHomeSlot = nextLeg1Slot.includes("1") || nextLeg1Slot === "SF_1" || nextLeg1Slot === "FINAL";
          const updateField = isHomeSlot ? { awayTeamId: winnerId } : { homeTeamId: winnerId };
          await ctx.db
            .update(match)
            .set(updateField)
            .where(eq(match.id, nextLeg2Match.id));
        }
      }

      return { success: true, winnerId };
    }),
});
