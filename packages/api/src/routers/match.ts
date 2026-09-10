import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import {
  router,
  envelopedPublicProcedure,
  envelopedAdminProcedure,
} from "../index";
import { match, matchResult } from "@topEleven-gamepress/db/schema";
import { nanoid } from "nanoid";

export const matchRouter = router({
  /** List matches by group */
  listByGroup: envelopedPublicProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const matches = await ctx.db.query.match.findMany({
        where: eq(match.groupId, input.groupId),
        with: {
          homeTeam: true,
          awayTeam: true,
          result: true,
        },
        orderBy: [asc(match.round), asc(match.leg)],
      });
      return matches;
    }),

  /** List all matches for a tournament */
  listByTournament: envelopedPublicProcedure
    .input(
      z
        .object({
          tournamentId: z.string(),
          stage: z.enum(["group", "round_of_16", "quarter", "semi", "third_place", "final"]).optional(),
          groupId: z.string().optional(),
          status: z.enum(["pending", "in_progress", "completed"]).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      if (!input) {
        return ctx.db.query.match.findMany({
          with: { homeTeam: true, awayTeam: true, result: true, group: true },
          orderBy: [asc(match.matchDate), asc(match.leg)],
        });
      }
      const conditions = [eq(match.tournamentId, input.tournamentId)];
      if (input.stage) conditions.push(eq(match.stage, input.stage));
      if (input.groupId) conditions.push(eq(match.groupId, input.groupId));
      if (input.status) conditions.push(eq(match.status, input.status));

      return ctx.db.query.match.findMany({
        where: and(...conditions),
        with: { homeTeam: true, awayTeam: true, result: true, group: true },
        orderBy: [asc(match.matchDate), asc(match.leg)],
      });
    }),

  /** Get a single match with full details */
  getById: envelopedPublicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const m = await ctx.db.query.match.findFirst({
        where: eq(match.id, input.id),
        with: {
          homeTeam: true,
          awayTeam: true,
          result: true,
          group: true,
          tournament: true,
        },
      });
      if (!m) throw new Error("Không tìm thấy trận đấu.");
      return m;
    }),

  /** Update match status */
  updateStatus: envelopedAdminProcedure
    .input(
      z.object({
        matchId: z.string(),
        status: z.enum(["pending", "in_progress", "completed"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(match)
        .set({ status: input.status })
        .where(eq(match.id, input.matchId));
      return { success: true };
    }),

  /** Update match result and cards */
  updateResult: envelopedAdminProcedure
    .input(
      z.object({
        matchId: z.string(),
        homeScore: z.number().int().min(0).optional(),
        awayScore: z.number().int().min(0).optional(),
        homeYellowCards: z.number().int().min(0).default(0),
        homeRedCards2Y: z.number().int().min(0).default(0),
        homeRedCardsDirect: z.number().int().min(0).default(0),
        awayYellowCards: z.number().int().min(0).default(0),
        awayRedCards2Y: z.number().int().min(0).default(0),
        awayRedCardsDirect: z.number().int().min(0).default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { matchId, ...resultData } = input;

      // Upsert match result
      const existing = await ctx.db.query.matchResult.findFirst({
        where: eq(matchResult.matchId, matchId),
      });

      if (existing) {
        await ctx.db
          .update(matchResult)
          .set(resultData)
          .where(eq(matchResult.id, existing.id));
      } else {
        await ctx.db.insert(matchResult).values({
          id: nanoid(),
          matchId,
          ...resultData,
        });
      }

      // Mark match as completed
      await ctx.db
        .update(match)
        .set({ status: "completed" })
        .where(eq(match.id, matchId));

      return { success: true };
    }),

  /** Update match date and time */
  updateDate: envelopedAdminProcedure
    .input(
      z.object({
        matchId: z.string(),
        matchDate: z.string().datetime(),
        matchTime: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(match)
        .set({
          matchDate: new Date(input.matchDate),
          matchTime: input.matchTime ?? null,
        })
        .where(eq(match.id, input.matchId));
      return { success: true };
    }),

  /** Manual resolve (admin picks winner for pendingDraw matches) */
  manualResolve: envelopedAdminProcedure
    .input(
      z.object({
        matchId: z.string(),
        winnerTeamId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(match)
        .set({ winnerTeamId: input.winnerTeamId })
        .where(eq(match.id, input.matchId));

      // Also clear pendingDraw flag
      const existing = await ctx.db.query.matchResult.findFirst({
        where: eq(matchResult.matchId, input.matchId),
      });
      if (existing) {
        await ctx.db
          .update(matchResult)
          .set({ pendingDraw: false })
          .where(eq(matchResult.id, existing.id));
      }

      return { success: true };
    }),
});
