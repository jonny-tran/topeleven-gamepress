import { cors } from "@elysiajs/cors";
import { createContext } from "@topEleven-gamepress/api/context";
import { appRouter } from "@topEleven-gamepress/api/routers/index";
import { auth } from "@topEleven-gamepress/auth";
import { env } from "@topEleven-gamepress/env/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Elysia } from "elysia";

const app = new Elysia()
  .use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ["GET", "POST", "OPTIONS"],
      // Allow cookies/credentials headers so Safari iOS preflight succeeds
      // and Better Auth can read its session cookie on cross-origin POST.
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Cookie",
        "Set-Cookie",
        "X-Requested-With",
      ],
      // Expose Set-Cookie so the browser accepts the session cookie and
      // reads back-dated cookies on subsequent requests.
      exposedHeaders: ["Set-Cookie", "Content-Length"],
      credentials: true,
      maxAge: 86400,
    }),
  )
  .all("/api/auth/*", async (context) => {
    const { request, status } = context;
    if (["POST", "GET"].includes(request.method)) {
      return auth.handler(request);
    }
    return status(405);
  })
  .all("/trpc/*", async (context) => {
    const res = await fetchRequestHandler({
      endpoint: "/trpc",
      router: appRouter,
      req: context.request,
      createContext: () => createContext({ context }),
    });
    return res;
  })
  .get("/", () => "OK");

export default app;

// Elysia's default export is not auto-served by Bun or Node, so start a local
// server outside Vercel while still exporting the app for Vercel functions.
if (!process.env.VERCEL) {
  app.listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
  });
}
