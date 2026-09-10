import { initTRPC, TRPCError } from "@trpc/server";
import { env } from "@topEleven-gamepress/env/server";
import type { ApiResponse } from "./response";

import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Bạn cần đăng nhập để thực hiện thao tác này.",
      cause: "No session",
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

/**
 * Admin procedure - requires authentication AND email in ADMIN_EMAILS list.
 * All admins have equal permissions (no role hierarchy).
 */
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Bạn cần đăng nhập để thực hiện thao tác này.",
      cause: "No session",
    });
  }
  const userEmail = ctx.session.user?.email?.toLowerCase();
  const adminEmails = env.ADMIN_EMAILS
    ? env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase())
    : [];

  if (adminEmails.length > 0 && !adminEmails.includes(userEmail ?? "")) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Bạn không có quyền truy cập chức năng quản trị.",
      cause: "Email not in admin allowlist",
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
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
 * - `envelopedPublicProcedure`: envelope only
 * - `envelopedAdminProcedure`: envelope first, then admin auth gate
 */
export const envelopedPublicProcedure = t.procedure.use(responseEnvelopeMiddleware);

export const envelopedAdminProcedure = t.procedure
  // The right-most middleware runs first. We want auth to gate access BEFORE
  // envelope wraps anything, so envelope goes on the left.
  .use(responseEnvelopeMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Bạn cần đăng nhập để thực hiện thao tác này.",
        cause: "No session",
      });
    }
    const userEmail = ctx.session.user?.email?.toLowerCase();
    const adminEmails = env.ADMIN_EMAILS
      ? env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase())
      : [];

    if (adminEmails.length > 0 && !adminEmails.includes(userEmail ?? "")) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Bạn không có quyền truy cập chức năng quản trị.",
        cause: "Email not in admin allowlist",
      });
    }
    return next({
      ctx: {
        ...ctx,
        session: ctx.session,
      },
    });
  });
