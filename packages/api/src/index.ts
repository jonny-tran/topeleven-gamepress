import { initTRPC } from "@trpc/server";
import type { ApiResponse } from "./response";

import type { Context } from "./context";
import { requireActor, requireAdmin } from "./access";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

/**
 * Procedure nền — không kiểm tra gì.
 * Dùng khi caller đã tự gọi `requireActor` / `requireTournamentManage` trong
 * resolver (phổ biến với các thao tác cần tra cứu giải cha trước).
 */
export const publicProcedure = t.procedure;

/**
 * Yêu cầu đăng nhập. Sau middleware này `ctx.actor` được thu hẹp thành
 * `Actor` (không còn null) nên resolver dùng được mà không phải kiểm tra lại.
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  const actor = requireActor(ctx);
  return next({
    ctx: { ...ctx, actor },
  });
});

/**
 * Yêu cầu đăng nhập + quyền admin toàn cục.
 *
 * Chỉ dùng cho thao tác toàn cục (quản lý mọi giải, vận hành hệ thống).
 * Mọi thao tác trên một giải cụ thể nên dùng `envelopedManagerProcedure` +
 * `requireTournamentManage` để chủ sở hữu cũng làm được.
 */
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  const actor = requireAdmin(ctx);
  return next({
    ctx: { ...ctx, actor },
  });
});

/**
 * Wrap every procedure result in the standard API response envelope:
 *   { statusCode, message, data, timestamp, path }
 *
 * - `path` uses the tRPC procedure path (e.g. "team.createBulk")
 * - `message` is a short human-readable description in Vietnamese
 * - For mutations, callers may return `{ __noChange: true }` from their
 *   handler to flag that the operation produced no real change. The wrapper
 *   sets `noChange: true` and `message` accordingly so the UI can show
 *   an info toast instead of a success toast.
 */
export const responseEnvelopeMiddleware = t.middleware(async ({ path, type, next }) => {
  const result = await next();

  if (result.ok) {
    const rawData = result.data as unknown as { noChange?: boolean } | undefined;
    const noChangeFlag =
      !!rawData &&
      typeof rawData === "object" &&
      "noChange" in rawData &&
      (rawData as { noChange?: boolean }).noChange === true;

    const message = noChangeFlag
      ? "Không có thay đổi nào so với dữ liệu hiện tại."
      : type === "mutation"
        ? "Thao tác thành công."
        : "Thành công.";

    const wrapped: ApiResponse<unknown> = {
      statusCode: 200,
      message,
      data: noChangeFlag ? null : rawData,
      timestamp: new Date().toISOString(),
      path,
      ...(noChangeFlag ? { noChange: true as const } : {}),
    };

    return {
      ok: true,
      data: wrapped,
      marker: result.marker,
    } as typeof result;
  }

  // Pass through errors unchanged.
  return result;
});

/**
 * Procedure helpers that wrap responses in the standard envelope.
 *
 * Chain order in tRPC is left-to-right inside `.use(...)`. The outermost
 * (last) middleware runs first on the request and last on the response.
 *
 * - `envelopedPublicProcedure`: envelope only. Dành cho dữ liệu công khai.
 *   Việc lọc quyền xem (public hay draft) do resolver quyết định qua
 *   `requireTournamentRead` — không phụ thuộc cờ do client gửi lên.
 * - `envelopedProtectedProcedure`: envelope + bắt buộc đăng nhập.
 * - `envelopedManagerProcedure`: envelope + bắt buộc đăng nhập. Dùng cho
 *   mọi thao tác quản lý giải; resolver gọi thêm `requireTournamentManage`
 *   để kiểm tra chủ sở hữu.
 * - `envelopedAdminProcedure`: envelope + bắt buộc là admin toàn cục.
 */
export const envelopedPublicProcedure = t.procedure.use(responseEnvelopeMiddleware);

export const envelopedProtectedProcedure = t.procedure
  .use(responseEnvelopeMiddleware)
  .use(({ ctx, next }) => {
    const actor = requireActor(ctx);
    return next({ ctx: { ...ctx, actor } });
  });

export const envelopedManagerProcedure = t.procedure
  .use(responseEnvelopeMiddleware)
  .use(({ ctx, next }) => {
    const actor = requireActor(ctx);
    return next({ ctx: { ...ctx, actor } });
  });

export const envelopedAdminProcedure = t.procedure
  .use(responseEnvelopeMiddleware)
  .use(({ ctx, next }) => {
    const actor = requireAdmin(ctx);
    return next({ ctx: { ...ctx, actor } });
  });
