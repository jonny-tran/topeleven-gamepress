import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  router,
  envelopedPublicProcedure,
  envelopedAdminProcedure,
} from "../index";
import { team } from "@topEleven-gamepress/db/schema";
import { nanoid } from "nanoid";

export const teamRouter = router({
  /** List all teams for a tournament */
  list: envelopedPublicProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const teams = await ctx.db.query.team.findMany({
        where: eq(team.tournamentId, input.tournamentId),
        with: { group: true },
        orderBy: (t, { asc }) => [asc(t.pot), asc(t.name)],
      });
      return teams;
    }),

  /** Get a single team */
  getById: envelopedPublicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const t = await ctx.db.query.team.findFirst({
        where: eq(team.id, input.id),
        with: { group: true, tournament: true },
      });
      if (!t) throw new Error("Không tìm thấy đội bóng.");
      return t;
    }),

  /** Create a single team */
  create: envelopedAdminProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        name: z.string().min(1).max(100),
        coachName: z.string().min(1).max(100),
        associationName: z.string().min(1).max(100),
        associationCode: z.string().min(1).max(50),
        pot: z.number().int().min(1).max(4),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = nanoid();
      await ctx.db.insert(team).values({
        id,
        tournamentId: input.tournamentId,
        name: input.name,
        coachName: input.coachName,
        associationName: input.associationName,
        associationCode: input.associationCode,
        pot: input.pot,
        groupId: null,
        position: null,
      });
      return { id, name: input.name, pot: input.pot };
    }),

  /**
   * Bulk create / replace 24 teams (6 per pot).
   *
   * Behaviour:
   * - Nếu danh sách gửi lên giống hệt danh sách đã lưu → trả về `{ __noChange: true }`
   *   (UI sẽ hiển thị toast info "không có thay đổi").
   * - Nếu khác → xóa hết teams cũ của tournament, insert danh sách mới.
   */
  createBulk: envelopedAdminProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        teams: z
          .array(
            z.object({
              name: z.string().min(1).max(100),
              coachName: z.string().min(1).max(100),
              associationName: z.string().min(1).max(100),
              associationCode: z.string().min(1).max(50),
              pot: z.number().int().min(1).max(4),
            })
          )
          .min(24)
          .max(24),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Step 1: Sanitize input
      const cleaned = input.teams.map((t) => ({
        name: t.name.trim(),
        coachName: t.coachName.trim(),
        associationName: t.associationName.trim(),
        associationCode: t.associationCode.trim().toUpperCase(),
        pot: t.pot,
      }));

      // Step 2: Check for duplicate names within the batch
      const nameSet = new Set<string>();
      for (const t of cleaned) {
        if (nameSet.has(t.name)) {
          throw new Error(`Tên đội bị trùng trong danh sách: "${t.name}"`);
        }
        nameSet.add(t.name);
      }

      // Step 3: Validate 6 teams per pot
      for (let pot = 1; pot <= 4; pot++) {
        const potTeams = cleaned.filter((t) => t.pot === pot);
        if (potTeams.length !== 6) {
          throw new Error(
            `Pot ${pot} phải có đúng 6 đội, hiện tại có ${potTeams.length} đội.`
          );
        }
      }

      // Step 4: Load existing teams for change detection
      const existingTeams = await ctx.db.query.team.findMany({
        where: eq(team.tournamentId, input.tournamentId),
      });

      const fingerprintExisting = fingerprintTeams(existingTeams);
      const fingerprintIncoming = fingerprintTeams(
        cleaned.map((c, idx) => ({
          ...c,
          id: `new-${idx}`,
          tournamentId: input.tournamentId,
          groupId: null,
          position: null,
        }))
      );

      if (fingerprintExisting === fingerprintIncoming) {
        // No actual change — flag so the client shows an info toast instead of
        // a success toast. Skip DB writes to avoid unnecessary work.
        return { noChange: true } as unknown as { count: number };
      }

      // Step 5: Replace all teams for this tournament.
      // Order matters: delete first to avoid unique-index collisions with
      // existing rows that share a name with the incoming list.
      if (existingTeams.length > 0) {
        await ctx.db
          .delete(team)
          .where(eq(team.tournamentId, input.tournamentId));
      }

      const values = cleaned.map((t) => ({
        id: nanoid(),
        tournamentId: input.tournamentId,
        name: t.name,
        coachName: t.coachName,
        associationName: t.associationName,
        associationCode: t.associationCode,
        pot: t.pot,
        groupId: null,
        position: null,
      }));

      await ctx.db.insert(team).values(values);
      return { count: values.length };
    }),

  /** Update a team */
  update: envelopedAdminProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        coachName: z.string().min(1).max(100).optional(),
        associationName: z.string().min(1).max(100).optional(),
        associationCode: z.string().min(1).max(50).optional(),
        pot: z.number().int().min(1).max(4).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      await ctx.db
        .update(team)
        .set(rest)
        .where(eq(team.id, id));
      return { success: true };
    }),

  /** Delete a team */
  delete: envelopedAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(team).where(eq(team.id, input.id));
      return { success: true };
    }),

  /** Delete all teams for a tournament (reset) */
  deleteAll: envelopedAdminProcedure
    .input(z.object({ tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(team).where(eq(team.tournamentId, input.tournamentId));
      return { success: true };
    }),
});

/**
 * Build a stable string fingerprint of a team list so we can compare
 * incoming and existing lists without being sensitive to row order.
 */
function fingerprintTeams(
  teams: Array<{
    name: string;
    coachName: string;
    associationName: string;
    associationCode: string;
    pot: number;
  }>
): string {
  const sorted = [...teams]
    .map((t) => `${t.pot}|${t.name}|${t.coachName}|${t.associationName}|${t.associationCode}`)
    .sort();
  return sorted.join("\n");
}
