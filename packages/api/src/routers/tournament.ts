import { z } from "zod";
import { eq, asc, desc, and, isNull } from "drizzle-orm";
import {
  router,
  envelopedPublicProcedure,
  envelopedAdminProcedure,
} from "../index";
import { tournament, tournamentGroup, team } from "@topEleven-gamepress/db/schema";
import { nanoid } from "nanoid";

/**
 * Tournament lifecycle states (see `status` column):
 *   setup            → vừa tạo, chưa bốc thăm
 *   draw_in_progress → đang bốc thăm
 *   draw_completed   → bốc thăm xong
 *   group_stage      → đang vòng bảng
 *   knockout         → đang vòng knockout
 *   completed        → hoàn thành (tự nhiên hoặc admin close)
 *
 * Soft flags (separate columns):
 *   isPublic   → công khai cho public viewers
 *   archivedAt → lưu trữ (có thể khôi phục)
 *   deletedAt  → xóa mềm (data vẫn còn trong DB)
 *   closedAt   → admin đóng thủ công
 */
export const tournamentRouter = router({
  /**
   * List tournaments.
   * - Default: ẩn archived + deleted, không filter isPublic (admin thấy tất cả)
   * - `includeArchived` / `includeDeleted`: hiện thêm archived / deleted
   * - `onlyPublic`: chỉ hiện tournament có isPublic=true (dùng cho public page)
   */
  list: envelopedPublicProcedure
    .input(
      z
        .object({
          status: z
            .enum([
              "setup",
              "draw_in_progress",
              "draw_completed",
              "group_stage",
              "knockout",
              "completed",
            ])
            .optional(),
          includeArchived: z.boolean().optional(),
          includeDeleted: z.boolean().optional(),
          onlyPublic: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input?.status) {
        conditions.push(eq(tournament.status, input.status));
      }
      if (!input?.includeArchived) {
        conditions.push(isNull(tournament.archivedAt));
      }
      if (!input?.includeDeleted) {
        conditions.push(isNull(tournament.deletedAt));
      }
      if (input?.onlyPublic) {
        conditions.push(eq(tournament.isPublic, true));
      }

      const tournaments = await ctx.db.query.tournament.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(tournament.createdAt)],
        with: {
          groups: { orderBy: [asc(tournamentGroup.code)] },
        },
      });
      return tournaments;
    }),

  /** Get a single tournament by ID with all relations.
   * - Mặc định: ẩn nếu đã soft-delete HOẶC chưa publish (draft).
   * - `includeDeleted`: cho admin xem cả tournament đã xóa mềm.
   * - `includeNotPublic`: cho admin xem cả tournament draft (chưa publish).
   */
  getById: envelopedPublicProcedure
    .input(
      z.object({
        id: z.string(),
        includeDeleted: z.boolean().optional(),
        includeNotPublic: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const t = await ctx.db.query.tournament.findFirst({
        where: eq(tournament.id, input.id),
        with: {
          groups: { orderBy: [asc(tournamentGroup.code)] },
        },
      });
      if (!t) throw new Error("Không tìm thấy giải đấu.");
      if (t.deletedAt && !input.includeDeleted) {
        throw new Error("Không tìm thấy giải đấu.");
      }
      if (!t.isPublic && !input.includeNotPublic) {
        throw new Error("Không tìm thấy giải đấu.");
      }
      return t;
    }),

  /** Create a new tournament with 6 empty groups (A-F). Mặc định isPublic=false (draft). */
  create: envelopedAdminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        startDate: z.string().datetime(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = nanoid();
      const startDate = new Date(input.startDate);

      // Create tournament
      await ctx.db.insert(tournament).values({
        id,
        name: input.name,
        startDate,
        status: "setup",
        isPublic: false,
      });

      // Create 6 groups
      const groupCodes = ["A", "B", "C", "D", "E", "F"];
      await ctx.db.insert(tournamentGroup).values(
        groupCodes.map((code) => ({
          id: nanoid(),
          tournamentId: id,
          code,
        }))
      );

      return { id, name: input.name, startDate, status: "setup" };
    }),

  /**
   * Đổi tên giải đấu.
   * Tên mới sẽ được trim, loại bỏ khoảng trắng thừa đầu/cuối.
   */
  rename: envelopedAdminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const t = await ctx.db.query.tournament.findFirst({
        where: eq(tournament.id, input.id),
      });
      if (!t) throw new Error("Không tìm thấy giải đấu.");
      const trimmedName = input.name.trim();
      if (trimmedName === t.name) {
        return { success: true, noChange: true };
      }
      await ctx.db
        .update(tournament)
        .set({ name: trimmedName })
        .where(eq(tournament.id, input.id));
      return { success: true, name: trimmedName };
    }),

  /** Update tournament name or start date */
  update: envelopedAdminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        startDate: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(tournament)
        .set({
          ...(input.name && { name: input.name }),
          ...(input.startDate && { startDate: new Date(input.startDate) }),
        })
        .where(eq(tournament.id, input.id));
      return { success: true };
    }),

  /** Transition tournament status */
  updateStatus: envelopedAdminProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum([
          "setup",
          "draw_in_progress",
          "draw_completed",
          "group_stage",
          "knockout",
          "completed",
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(tournament)
        .set({ status: input.status })
        .where(eq(tournament.id, input.id));
      return { success: true };
    }),

  // ────────────────────────────────────────────────────────────
  // LIFECYCLE: COPY / ARCHIVE / DELETE / CLOSE / PUBLISH
  // ────────────────────────────────────────────────────────────

  /**
   * Copy một tournament để tạo bản nháp cho mùa giải mới.
   * - Tạo tournament mới với status=setup, isPublic=false
   * - Copy 6 groups (A-F) với id mới
   * - Copy danh sách 24 teams (nếu có) — groupId/position reset về null
   * - KHÔNG copy matches / results
   * - KHÔNG copy isPublic, archivedAt, deletedAt, closedAt
   */
  copy: envelopedAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const source = await ctx.db.query.tournament.findFirst({
        where: eq(tournament.id, input.id),
      });
      if (!source) {
        throw new Error("Không tìm thấy giải đấu nguồn để sao chép.");
      }

      const newId = nanoid();
      const newName = `${source.name} (Bản sao)`;

      // 1. Tạo tournament mới
      await ctx.db.insert(tournament).values({
        id: newId,
        name: newName,
        startDate: source.startDate,
        status: "setup",
        isPublic: false,
      });

      // 2. Tạo 6 groups mới
      const groupCodes = ["A", "B", "C", "D", "E", "F"];
      await ctx.db.insert(tournamentGroup).values(
        groupCodes.map((code) => ({
          id: nanoid(),
          tournamentId: newId,
          code,
        }))
      );

      // 3. Copy teams (groupId/position = null vì chưa bốc thăm)
      const sourceTeams = await ctx.db.query.team.findMany({
        where: eq(team.tournamentId, input.id),
      });

      if (sourceTeams.length > 0) {
        await ctx.db.insert(team).values(
          sourceTeams.map((t) => ({
            id: nanoid(),
            tournamentId: newId,
            name: t.name,
            coachName: t.coachName,
            associationName: t.associationName,
            associationCode: t.associationCode,
            pot: t.pot,
            groupId: null,
            position: null,
          }))
        );
      }

      return {
        id: newId,
        name: newName,
        teamsCopied: sourceTeams.length,
      };
    }),

  /** Lưu trữ tournament (có thể khôi phục). Ẩn khỏi tab "Đang hoạt động". */
  archive: envelopedAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const t = await ctx.db.query.tournament.findFirst({
        where: eq(tournament.id, input.id),
      });
      if (!t) throw new Error("Không tìm thấy giải đấu.");
      if (t.deletedAt) {
        throw new Error("Không thể lưu trữ giải đấu đã xóa. Hãy khôi phục trước.");
      }
      if (t.archivedAt) {
        return { success: true, noChange: true };
      }
      await ctx.db
        .update(tournament)
        .set({ archivedAt: new Date(), isPublic: false })
        .where(eq(tournament.id, input.id));
      return { success: true };
    }),

  /** Khôi phục tournament đã lưu trữ. */
  restore: envelopedAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const t = await ctx.db.query.tournament.findFirst({
        where: eq(tournament.id, input.id),
      });
      if (!t) throw new Error("Không tìm thấy giải đấu.");
      if (t.deletedAt) {
        throw new Error("Không thể khôi phục giải đấu đã xóa. Dùng 'Khôi phục từ thùng rác'.");
      }
      if (!t.archivedAt) {
        return { success: true, noChange: true };
      }
      await ctx.db
        .update(tournament)
        .set({ archivedAt: null })
        .where(eq(tournament.id, input.id));
      return { success: true };
    }),

  /**
   * Xóa mềm tournament. Chỉ áp dụng khi giải đã hoàn thành (status=completed).
   * Data vẫn còn trong DB — UI hoàn toàn ẩn tournament này.
   */
  softDelete: envelopedAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const t = await ctx.db.query.tournament.findFirst({
        where: eq(tournament.id, input.id),
      });
      if (!t) throw new Error("Không tìm thấy giải đấu.");
      if (t.deletedAt) {
        return { success: true, noChange: true };
      }
      if (t.status !== "completed") {
        throw new Error(
          "Chỉ được xóa giải đấu đã hoàn thành. Hãy đóng giải trước khi xóa."
        );
      }
      await ctx.db
        .update(tournament)
        .set({
          deletedAt: new Date(),
          archivedAt: null,
          isPublic: false,
        })
        .where(eq(tournament.id, input.id));
      return { success: true };
    }),

  /** Khôi phục tournament đã xóa mềm (từ "thùng rác"). */
  restoreDeleted: envelopedAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const t = await ctx.db.query.tournament.findFirst({
        where: eq(tournament.id, input.id),
      });
      if (!t) throw new Error("Không tìm thấy giải đấu.");
      if (!t.deletedAt) {
        return { success: true, noChange: true };
      }
      await ctx.db
        .update(tournament)
        .set({ deletedAt: null })
        .where(eq(tournament.id, input.id));
      return { success: true };
    }),

  /**
   * Đóng tournament ngay lập tức (set status=completed, closedAt=now, isPublic=false).
   * Có thể thực hiện ở bất kỳ giai đoạn nào.
   */
  close: envelopedAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const t = await ctx.db.query.tournament.findFirst({
        where: eq(tournament.id, input.id),
      });
      if (!t) throw new Error("Không tìm thấy giải đấu.");
      if (t.deletedAt) {
        throw new Error("Không thể đóng giải đấu đã xóa.");
      }
      if (t.status === "completed" && t.closedAt) {
        return { success: true, noChange: true };
      }
      await ctx.db
        .update(tournament)
        .set({
          status: "completed",
          closedAt: new Date(),
          isPublic: false,
        })
        .where(eq(tournament.id, input.id));
      return { success: true };
    }),

  /** Publish tournament để hiện cho public viewers. */
  publish: envelopedAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const t = await ctx.db.query.tournament.findFirst({
        where: eq(tournament.id, input.id),
      });
      if (!t) throw new Error("Không tìm thấy giải đấu.");
      if (t.deletedAt) {
        throw new Error("Không thể publish giải đấu đã xóa.");
      }
      if (t.archivedAt) {
        throw new Error("Không thể publish giải đấu đã lưu trữ. Hãy khôi phục trước.");
      }
      if (t.status === "setup") {
        throw new Error(
          "Chưa thể publish khi giải đấu chưa bốc thăm xong."
        );
      }
      if (t.isPublic) {
        return { success: true, noChange: true };
      }
      await ctx.db
        .update(tournament)
        .set({ isPublic: true })
        .where(eq(tournament.id, input.id));
      return { success: true };
    }),

  /** Unpublish tournament (ẩn khỏi public). */
  unpublish: envelopedAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const t = await ctx.db.query.tournament.findFirst({
        where: eq(tournament.id, input.id),
      });
      if (!t) throw new Error("Không tìm thấy giải đấu.");
      if (!t.isPublic) {
        return { success: true, noChange: true };
      }
      await ctx.db
        .update(tournament)
        .set({ isPublic: false })
        .where(eq(tournament.id, input.id));
      return { success: true };
    }),
});
