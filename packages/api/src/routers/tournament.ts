import { z } from "zod";
import { eq, asc, desc, and, isNull, inArray } from "drizzle-orm";
import { router, envelopedPublicProcedure, envelopedManagerProcedure } from "../index";
import {
  assertCanRead,
  requireActor,
  requireTournamentManage,
  resolveTournamentAccess,
} from "../access";
import { tournament, tournamentGroup, team, user } from "@topEleven-gamepress/db/schema";
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
 *
 * Ownership:
 *   ownerId    → tài khoản sở hữu. Chủ sở hữu và admin đều có toàn quyền;
 *                 người khác chỉ xem được khi isPublic = true.
 *   (Xem `access.ts` cho toàn bộ quy tắc.)
 */
export const tournamentRouter = router({
  /**
   * Danh tính người gọi kèm quyền — frontend dùng để ẩn/hiện nút thao tác.
   * Không dùng để bảo mật: mọi quyền thật đều kiểm tra lại ở từng procedure.
   */
  viewer: envelopedPublicProcedure.query(({ ctx }) => {
    if (!ctx.actor) return null;
    return {
      id: ctx.actor.id,
      name: ctx.actor.name,
      email: ctx.actor.email,
      role: ctx.actor.role,
      isAdmin: ctx.actor.isAdmin,
    };
  }),

  /**
   * List tournaments.
   *
   * Hai chế độ, phân biệt bằng `onlyPublic`:
   *
   * 1. **Công khai** (`onlyPublic: true`) — không cần đăng nhập. Server ép
   *    `isPublic = true`, `deletedAt IS NULL`, `archivedAt IS NULL`. Cờ
   *    `includeArchived` / `includeDeleted` / `scope` bị bỏ qua hoàn toàn.
   *
   * 2. **Quản lý** (mặc định) — bắt buộc đăng nhập.
   *    - `scope: "mine"` → chỉ giải của bản thân.
   *    - `scope: "all"`  → mọi giải, **chỉ admin** (khác là 403).
   *    - Không truyền scope → admin mặc định "all", user thường "mine".
   *
   * Không còn đường để client tự bật `includeNotPublic` để đọc bản nháp của
   * người khác: với user thường, điều kiện `ownerId = <của họ>` luôn được ép.
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
          activeOnly: z.boolean().optional(),
          /** Phạm vi xem. `"all"` chỉ dành cho admin. */
          scope: z.enum(["mine", "all"]).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input?.onlyPublic) {
        /* ── Chế độ công khai: server tự quyết định, không tin client. ── */
        conditions.push(
          eq(tournament.isPublic, true),
          isNull(tournament.archivedAt),
          isNull(tournament.deletedAt),
        );
      } else {
        /* ── Chế độ quản lý: bắt buộc đăng nhập + giới hạn theo sở hữu. ── */
        const actor = requireActor(ctx);

        const wantsAll = input?.scope === "all" || (input?.scope === undefined && actor.isAdmin);
        if (wantsAll && !actor.isAdmin) {
          throw new Error("Bạn không có quyền xem giải đấu của tài khoản khác.");
        }
        if (!wantsAll) {
          conditions.push(eq(tournament.ownerId, actor.id));
        }
      }

      if (input?.status) {
        conditions.push(eq(tournament.status, input.status));
      }
      if (input?.activeOnly) {
        /* Chỉ giải đang diễn ra — bỏ qua `setup` (chưa bắt đầu) và
           `completed` (đã kết thúc). Dùng cho trang chủ công khai. */
        conditions.push(
          inArray(tournament.status, [
            "draw_in_progress",
            "draw_completed",
            "group_stage",
            "knockout",
          ]),
        );
      }
      if (!input?.includeArchived) {
        conditions.push(isNull(tournament.archivedAt));
      }
      if (!input?.includeDeleted) {
        conditions.push(isNull(tournament.deletedAt));
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

  /**
   * Chi tiết một giải.
   *
   * Quyền do `evaluateTournamentAccess` quyết định:
   *  - chủ sở hữu / admin → toàn quyền, thấy cả bản nháp, lưu trữ, thùng rác.
   *  - người khác, giải công khai → xem được, nhưng các cột quản trị
   *    (`deletedAt`, `archivedAt`, `closedAt`, thông tin chủ) trả về `null`
   *    để không rò rỉ trạng thái nội bộ ra trang công khai.
   *  - còn lại → 404.
   *
   * Cờ `includeDeleted` / `includeNotPublic` đã bị gỡ khỏi input: trước đây
   * client tự bật được và đọc trộm giải nháp của người khác.
   */
  getById: envelopedPublicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const { access } = await resolveTournamentAccess(ctx, input.id);
      assertCanRead(access);

      const t = await ctx.db.query.tournament.findFirst({
        where: eq(tournament.id, input.id),
        with: { groups: { orderBy: [asc(tournamentGroup.code)] } },
      });
      if (!t) throw new Error("Không tìm thấy giải đấu.");

      const canManage = access.level === "manage";

      // Chỉ nạp thông tin chủ sở hữu khi người gọi đủ quyền quản lý.
      const owner = canManage
        ? (
            await ctx.db.query.user.findFirst({
              where: eq(user.id, t.ownerId ?? ""),
              columns: { id: true, name: true, email: true },
            })
          )
        : null;

      return {
        id: t.id,
        name: t.name,
        startDate: t.startDate,
        status: t.status,
        isPublic: t.isPublic,
        groups: t.groups,
        // Cột quản trị — luôn có mặt trong kiểu dữ liệu nhưng bị làm rỗng
        // với người xem công khai.
        deletedAt: canManage ? t.deletedAt : null,
        archivedAt: canManage ? t.archivedAt : null,
        closedAt: canManage ? t.closedAt : null,
        owner,
        isOwner: access.isOwner,
        isAdmin: access.isAdmin,
        canManage,
      };
    }),

  /**
   * Tạo giải mới. Ai đăng nhập cũng tạo được — giải sẽ thuộc về người tạo.
   * Mặc định isPublic=false (bản nháp) cho tới khi chủ giải publish.
   */
  create: envelopedManagerProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        startDate: z.string().datetime(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const actor = requireActor(ctx);
      const id = nanoid();
      const startDate = new Date(input.startDate);

      // Create tournament
      await ctx.db.insert(tournament).values({
        id,
        name: input.name,
        startDate,
        status: "setup",
        isPublic: false,
        ownerId: actor.id,
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
  rename: envelopedManagerProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { tournament: t } = await requireTournamentManage(ctx, input.id);
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
  update: envelopedManagerProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(200).optional(),
        startDate: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireTournamentManage(ctx, input.id);
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
  updateStatus: envelopedManagerProcedure
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
      await requireTournamentManage(ctx, input.id);
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
   *
   * Bản sao **luôn thuộc về người thực hiện sao chép**, kể cả khi admin sao
   * chép giải của người khác — nếu không, bản sao sẽ rơi vào tài khoản của
   * chủ cũ và người sao chép mất quyền trên chính thứ họ vừa tạo.
   */
  copy: envelopedManagerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const actor = requireActor(ctx);
      const { tournament: source } = await requireTournamentManage(ctx, input.id);

      const newId = nanoid();
      const newName = `${source.name} (Bản sao)`;

      // 1. Tạo tournament mới
      await ctx.db.insert(tournament).values({
        id: newId,
        name: newName,
        startDate: source.startDate,
        status: "setup",
        isPublic: false,
        ownerId: actor.id,
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
  archive: envelopedManagerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { tournament: t } = await requireTournamentManage(ctx, input.id);
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
  restore: envelopedManagerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { tournament: t } = await requireTournamentManage(ctx, input.id);
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
  softDelete: envelopedManagerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { tournament: t } = await requireTournamentManage(ctx, input.id);
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
  restoreDeleted: envelopedManagerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { tournament: t } = await requireTournamentManage(ctx, input.id);
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
  close: envelopedManagerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { tournament: t } = await requireTournamentManage(ctx, input.id);
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
  publish: envelopedManagerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { tournament: t } = await requireTournamentManage(ctx, input.id);
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
  unpublish: envelopedManagerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { tournament: t } = await requireTournamentManage(ctx, input.id);
      if (!t.isPublic) {
        return { success: true, noChange: true };
      }
      await ctx.db
        .update(tournament)
        .set({ isPublic: false })
        .where(eq(tournament.id, input.id));
      return { success: true };
    }),

  /**
   * Chuyển quyền sở hữu giải sang tài khoản khác.
   *
   * Ai cũng có thể chuyển **giải của chính mình** (đây là cách duy nhất để
   * một tài khoản tự nguyện trao giải cho người khác mà không cần admin).
   * Admin thì chuyển được giải của bất kỳ ai. Không ai chuyển được giải mà
   * mình không sở hữu và không làm admin.
   */
  transferOwner: envelopedManagerProcedure
    .input(
      z.object({
        id: z.string(),
        email: z.string().email(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireTournamentManage(ctx, input.id);

      const target = await ctx.db.query.user.findFirst({
        where: eq(user.email, input.email.toLowerCase()),
        columns: { id: true, name: true, email: true },
      });
      if (!target) {
        throw new Error("Không tìm thấy tài khoản với email này.");
      }

      await ctx.db
        .update(tournament)
        .set({ ownerId: target.id })
        .where(eq(tournament.id, input.id));

      return { success: true, owner: target };
    }),
});
