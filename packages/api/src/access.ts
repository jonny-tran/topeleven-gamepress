import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import {
  match,
  team,
  tournament,
  tournamentGroup,
} from "@topEleven-gamepress/db/schema";

import type { Actor, Context } from "./context";

/**
 * Mức quyền của người gọi lên một giải đấu cụ thể.
 *
 * - `none`   — không được biết giải này tồn tại. Mọi lời gọi đều trả 404.
 * - `read`   — xem được nội dung đã công khai, không sửa được gì.
 * - `manage` — toàn quyền (bốc thăm, nhập đội, ghi kết quả, xoá, publish…).
 */
export type AccessLevel = "none" | "read" | "manage";

/** Các trường tối thiểu cần để đánh giá quyền trên một giải. */
export interface AccessTournamentShape {
  id: string;
  ownerId: string | null;
  isPublic: boolean;
  archivedAt: Date | null;
  deletedAt: Date | null;
}

export interface AccessResult {
  level: AccessLevel;
  isOwner: boolean;
  isAdmin: boolean;
}

/**
 * Quy tắc phân quyền — nơi duy nhất quyết định ai được chạm vào giải nào.
 *
 * Thứ tự ưu tiên:
 *  1. Admin toàn cục  → `manage` cho mọi giải, kể cả đã lưu trữ / xoá mềm.
 *     (Admin cần thấy cả thùng rác để khôi phục được.)
 *  2. Chủ sở hữu      → `manage`. Admin KHÔNG bị coi là owner, nên khi admin
 *     sao chép một giải của người khác thì bản sao thuộc về chính admin.
 *  3. Công khai        → `read`, và chỉ khi giải thật sự đang "mở":
 *     không xoá mền, không lưu trữ. Bản nháp luôn là `none` với người ngoài.
 *  4. Còn lại          → `none`.
 */
export function evaluateTournamentAccess(
  actor: Actor | null,
  t: AccessTournamentShape,
): AccessResult {
  const isAdmin = actor?.isAdmin ?? false;
  const isOwner = !!actor && !!t.ownerId && t.ownerId === actor.id;

  if (isAdmin || isOwner) {
    return { level: "manage", isOwner, isAdmin };
  }

  const publiclyVisible =
    t.isPublic && t.deletedAt === null && t.archivedAt === null;

  if (publiclyVisible) {
    return { level: "read", isOwner: false, isAdmin: false };
  }

  return { level: "none", isOwner: false, isAdmin: false };
}

/** Ném 404 nếu không đủ quyền xem — để không lộ ra giải còn tồn tại hay không. */
export function assertCanRead(access: AccessResult): void {
  if (access.level === "none") {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Không tìm thấy giải đấu.",
      cause: "No read access",
    });
  }
}

/**
 * Ném lỗi nếu không đủ quyền quản lý.
 *
 * Phân biệt hai trường hợp để không vô tình rò rỉ dữ liệu:
 *  - `none`  → 404 (người gọi không được biết giải này tồn tại).
 *  - `read`  → 403 (giải đã công khai nên ai cũng biết; chỉ là không phải
 *               chủ nên không sửa được).
 */
export function assertCanManage(access: AccessResult): void {
  if (access.level === "manage") return;

  if (access.level === "read") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Bạn không có quyền chỉnh sửa giải đấu này.",
      cause: "Read-only access",
    });
  }

  throw new TRPCError({
    code: "NOT_FOUND",
    message: "Không tìm thấy giải đấu.",
    cause: "No manage access",
  });
}

function loadTournamentOrThrow(ctx: Context, tournamentId: string) {
  return ctx.db.query.tournament.findFirst({
    where: eq(tournament.id, tournamentId),
  });
}

/**
 * Nạp giải + tính quyền trong một lần. Trả về `level: "none"` nếu người gọi
 * không được biết giải này — caller dùng `assertCanRead` / `assertCanManage`
 * để quyết định ném lỗi.
 */
export async function resolveTournamentAccess(ctx: Context, tournamentId: string) {
  const t = await loadTournamentOrThrow(ctx, tournamentId);
  if (!t) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Không tìm thấy giải đấu.",
      cause: "Tournament not found",
    });
  }
  return { tournament: t, access: evaluateTournamentAccess(ctx.actor, t) };
}

/** Đọc giải: ném 404 nếu không có quyền. */
export async function requireTournamentRead(ctx: Context, tournamentId: string) {
  const result = await resolveTournamentAccess(ctx, tournamentId);
  assertCanRead(result.access);
  return result;
}

/** Quản lý giải: ném 404/403 nếu không phải chủ và không phải admin. */
export async function requireTournamentManage(ctx: Context, tournamentId: string) {
  const result = await resolveTournamentAccess(ctx, tournamentId);
  assertCanManage(result.access);
  return result;
}

/* ─────────────────── Tra cứu ngược từ bảng con ─────────────────── */

/** Các bảng con không mang `ownerId`, nên phải đi vòng qua giải cha. */

export async function tournamentIdOfTeam(ctx: Context, teamId: string) {
  const row = await ctx.db.query.team.findFirst({
    where: eq(team.id, teamId),
    columns: { id: true, tournamentId: true },
  });
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Không tìm thấy đội bóng.",
      cause: "Team not found",
    });
  }
  return row;
}

export async function tournamentIdOfMatch(ctx: Context, matchId: string) {
  const row = await ctx.db.query.match.findFirst({
    where: eq(match.id, matchId),
    columns: { id: true, tournamentId: true, homeTeamId: true, awayTeamId: true },
  });
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Không tìm thấy trận đấu.",
      cause: "Match not found",
    });
  }
  return row;
}

export async function tournamentIdOfGroup(ctx: Context, groupId: string) {
  const row = await ctx.db.query.tournamentGroup.findFirst({
    where: eq(tournamentGroup.id, groupId),
    columns: { id: true, tournamentId: true },
  });
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Không tìm thấy bảng đấu.",
      cause: "Group not found",
    });
  }
  return row;
}

/* ─────────────────── Tiện ích cho procedure ─────────────────── */

/** Bắt buộc đăng nhập. Trả về `Actor` đã gán quyền. */
export function requireActor(ctx: Context): Actor {
  if (!ctx.actor) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Bạn cần đăng nhập để thực hiện thao tác này.",
      cause: "No session",
    });
  }
  return ctx.actor;
}

/** Bắt buộc là admin toàn cục. */
export function requireAdmin(ctx: Context): Actor {
  const actor = requireActor(ctx);
  if (!actor.isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Bạn không có quyền quản trị.",
      cause: "Not an admin",
    });
  }
  return actor;
}
