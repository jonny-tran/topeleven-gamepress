import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { router, envelopedPublicProcedure, envelopedManagerProcedure } from "../index";
import {
  requireTournamentManage,
  requireTournamentRead,
  tournamentIdOfGroup,
  tournamentIdOfMatch,
} from "../access";
import { match, matchResult } from "@topEleven-gamepress/db/schema";
import { nanoid } from "nanoid";

export const matchRouter = router({
  /** Trận đấu của một bảng. Phải xem được giải chứa bảng đó. */
  listByGroup: envelopedPublicProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const group = await tournamentIdOfGroup(ctx, input.groupId);
      await requireTournamentRead(ctx, group.tournamentId);

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

  /**
   * Tất cả trận đấu của một giải.
   *
   * `tournamentId` giờ là BẮT BUỘC. Trước đây input là optional và khi bỏ
   * trống, procedure trả về toàn bộ bảng `match` của cả hệ thống — bao gồm
   * cả trận của các giải bản nháp mà người gọi không có quyền xem.
   */
  listByTournament: envelopedPublicProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        stage: z.enum(["group", "round_of_16", "quarter", "semi", "third_place", "final"]).optional(),
        groupId: z.string().optional(),
        status: z.enum(["pending", "in_progress", "completed"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await requireTournamentRead(ctx, input.tournamentId);

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

  /** Chi tiết một trận đấu. Phải xem được giải chứa nó. */
  getById: envelopedPublicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const row = await tournamentIdOfMatch(ctx, input.id);
      await requireTournamentRead(ctx, row.tournamentId);

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

  /** Đổi trạng thái trận (chưa / đang / xong). Chỉ chủ giải hoặc admin. */
  updateStatus: envelopedManagerProcedure
    .input(
      z.object({
        matchId: z.string(),
        status: z.enum(["pending", "in_progress", "completed"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const row = await tournamentIdOfMatch(ctx, input.matchId);
      await requireTournamentManage(ctx, row.tournamentId);

      await ctx.db
        .update(match)
        .set({ status: input.status })
        .where(eq(match.id, input.matchId));
      return { success: true };
    }),

  /** Ghi tỉ số + thẻ phạt. Chỉ chủ giải hoặc admin. */
  updateResult: envelopedManagerProcedure
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
      const row = await tournamentIdOfMatch(ctx, input.matchId);
      await requireTournamentManage(ctx, row.tournamentId);

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

  /** Dời lịch một trận đấu. Chỉ chủ giải hoặc admin. */
  updateDate: envelopedManagerProcedure
    .input(
      z.object({
        matchId: z.string(),
        matchDate: z.string().datetime(),
        matchTime: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const row = await tournamentIdOfMatch(ctx, input.matchId);
      await requireTournamentManage(ctx, row.tournamentId);

      await ctx.db
        .update(match)
        .set({
          matchDate: new Date(input.matchDate),
          matchTime: input.matchTime ?? null,
        })
        .where(eq(match.id, input.matchId));
      return { success: true };
    }),

  /**
   * Chốt thủ công đội thắng khi hai lượt hoà (pendingDraw).
   *
   * Ngoài việc kiểm tra quyền, còn kiểm tra `winnerTeamId` thật sự là một
   * đội trong trận — nếu không, chủ giải có thể "đặt" đội bất kỳ từ giải
   * khác vào làm đội thắng và làm hỏng cả nhánh knockout.
   */
  manualResolve: envelopedManagerProcedure
    .input(
      z.object({
        matchId: z.string(),
        winnerTeamId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const row = await tournamentIdOfMatch(ctx, input.matchId);
      await requireTournamentManage(ctx, row.tournamentId);

      if (row.homeTeamId !== input.winnerTeamId && row.awayTeamId !== input.winnerTeamId) {
        throw new Error("Đội thắng phải là một trong hai đội đang thi đấu.");
      }

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
