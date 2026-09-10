import { protectedProcedure, router, envelopedPublicProcedure } from "../index";
export { adminProcedure } from "../index";
import { user } from "@topEleven-gamepress/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { tournamentRouter } from "./tournament";
import { teamRouter } from "./team";
import { drawRouter } from "./draw";
import { matchRouter } from "./match";
import { rankingRouter } from "./ranking";
import { knockoutRouter } from "./knockout";

export const appRouter = router({
  healthCheck: envelopedPublicProcedure.query(() => {
    return "OK";
  }),

  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),

  /**
   * Check if an email exists in the database.
   * Used for better error messages during sign-in.
   */
  checkEmail: envelopedPublicProcedure
    .input(z.object({ email: z.string().email() }))
    .query(async ({ ctx, input }) => {
      const existingUser = await ctx.db.query.user.findFirst({
        where: eq(user.email, input.email.toLowerCase()),
      });
      return { exists: !!existingUser };
    }),

  // Tournament management
  tournament: tournamentRouter,
  team: teamRouter,
  draw: drawRouter,
  match: matchRouter,
  ranking: rankingRouter,
  knockout: knockoutRouter,
});
export type AppRouter = typeof appRouter;
