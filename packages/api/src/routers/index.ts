import { protectedProcedure, router, envelopedPublicProcedure } from "../index";
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
      user: ctx.actor,
    };
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
