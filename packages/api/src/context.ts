import { auth } from "@topEleven-gamepress/auth";
import { db } from "@topEleven-gamepress/db";
import { user, type UserRole } from "@topEleven-gamepress/db/schema";
import { env } from "@topEleven-gamepress/env/server";
import { eq } from "drizzle-orm";
import type { Context as ElysiaContext } from "elysia";

export type CreateContextOptions = {
  context: ElysiaContext;
};

/**
 * Danh tính người đang gọi API, đã gán quyền.
 *
 * `null` nghĩa là khách (chưa đăng nhập) — chỉ được đọc nội dung công khai.
 */
export interface Actor {
  id: string;
  email: string;
  name: string | null;
  /** Vai trò lưu trong DB — nguồn sự thật chính. */
  role: UserRole;
  /** true khi role = "admin" HOẶC email nằm trong allowlist dự phòng. */
  isAdmin: boolean;
}

/**
 * Allowlist admin dự phòng từ biến môi trường.
 *
 * KHÔNG dùng cơ chế "danh sách rỗng ⇒ ai cũng là admin" như trước đây —
 * đó là fail-open, tức là chỉ cần quên khai báo biến là toàn bộ tài khoản
 * đều leo lên thành admin. Giờ danh sách rỗng nghĩa là: không ai được
 * nâng quyền qua đường này.
 */
function adminEmailAllowlist(): string[] {
  const raw = env.ADMIN_EMAILS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Chốt quyền admin cho một tài khoản.
 *
 * Ưu tiên cột `user.role` trong DB. Allowlist `ADMIN_EMAILS` chỉ có tác
 * dụng *nâng* quyền lên admin (để còn cứu được hệ thống khi mất DB), và
 * tuyệt đối không dùng để hạ quyền — nếu không, ai cũng có thể tự hạ quyền
 * mình bằng cách sửa DB.
 */
function resolveRole(dbRole: UserRole, email: string): { role: UserRole; isAdmin: boolean } {
  if (dbRole === "admin") return { role: "admin", isAdmin: true };
  if (adminEmailAllowlist().includes(email.toLowerCase())) {
    return { role: "admin", isAdmin: true };
  }
  return { role: "user", isAdmin: false };
}

export async function createContext({ context }: CreateContextOptions) {
  const session = await auth.api.getSession({
    headers: context.request.headers,
  });

  let actor: Actor | null = null;

  if (session?.user?.id) {
    // better-auth không trả về cột `role` (nó chỉ biết các field mà nó tự
    // quản lý), nên phải tra trực tiếp. Truy vấn theo primary key nên rẻ.
    const row = await db.query.user.findFirst({
      where: eq(user.id, session.user.id),
      columns: { id: true, name: true, email: true, role: true },
    });

    // Session còn hiệu lực nhưng user đã bị xoá khỏi DB → coi như khách.
    if (row) {
      const { role, isAdmin } = resolveRole(row.role, row.email);
      actor = {
        id: row.id,
        email: row.email,
        name: row.name,
        role,
        isAdmin,
      };
    }
  }

  return {
    session,
    actor,
    db,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
