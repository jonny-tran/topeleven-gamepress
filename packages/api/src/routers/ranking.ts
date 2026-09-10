import { z } from "zod";
import { eq, and, asc, inArray } from "drizzle-orm";
import { router, publicProcedure } from "../index";
import { tournamentGroup, team, match, matchResult } from "@topEleven-gamepress/db/schema";
import { calculateGroupStandingFromData } from "@topEleven-gamepress/db/utils/standings";
import { getDynamicPairings, getAllR16Pairings, buildMatrixKey } from "@topEleven-gamepress/db/utils/round-of-16";

export const rankingRouter = router({
  /** Get group standings for a specific group */
  getGroupStandings: publicProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const groupTeams = await ctx.db.query.team.findMany({
        where: eq(team.groupId, input.groupId),
      });
      const groupMatches = await ctx.db.query.match.findMany({
        where: and(
          eq(match.groupId, input.groupId),
          eq(match.stage, "group"),
          eq(match.status, "completed")
        ),
      });
      const matchIds = groupMatches.map((m) => m.id);
      const results = matchIds.length > 0
        ? await ctx.db.query.matchResult.findMany({
            where: and(inArray(matchResult.matchId, matchIds)),
          })
        : [];
      return calculateGroupStandingFromData(groupTeams, groupMatches, results);
    }),

  /** Get all group standings for a tournament */
  getAllStandings: publicProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const groups = await ctx.db.query.tournamentGroup.findMany({
        where: eq(tournamentGroup.tournamentId, input.tournamentId),
        orderBy: [asc(tournamentGroup.code)],
      });

      const result: Record<string, ReturnType<typeof calculateGroupStandingFromData>> = {};
      for (const group of groups) {
        const groupTeams = await ctx.db.query.team.findMany({
          where: eq(team.groupId, group.id),
        });
        const groupMatches = await ctx.db.query.match.findMany({
          where: and(
            eq(match.groupId, group.id),
            eq(match.stage, "group"),
            eq(match.status, "completed")
          ),
        });
        const matchIds = groupMatches.map((m) => m.id);
        const results = matchIds.length > 0
          ? await ctx.db.query.matchResult.findMany({
              where: and(inArray(matchResult.matchId, matchIds)),
            })
          : [];
        result[group.code] = calculateGroupStandingFromData(groupTeams, groupMatches, results);
      }
      return result;
    }),

  /** Get third-place ranking for a tournament */
  getThirdPlaceRanking: publicProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const groups = await ctx.db.query.tournamentGroup.findMany({
        where: eq(tournamentGroup.tournamentId, input.tournamentId),
        orderBy: [asc(tournamentGroup.code)],
      });

      const thirdPlaceTeams: Array<{ teamId: string; teamName: string; groupCode: string; points: number; goalDiff: number; goalsFor: number; fairPlayPoints: number }> = [];

      for (const group of groups) {
        const groupTeams = await ctx.db.query.team.findMany({
          where: eq(team.groupId, group.id),
        });
        const groupMatches = await ctx.db.query.match.findMany({
          where: and(
            eq(match.groupId, group.id),
            eq(match.stage, "group"),
            eq(match.status, "completed")
          ),
        });
        const matchIds = groupMatches.map((m) => m.id);
        const results = matchIds.length > 0
          ? await ctx.db.query.matchResult.findMany({
              where: inArray(matchResult.matchId, matchIds),
            })
          : [];

        const standings = calculateGroupStandingFromData(groupTeams, groupMatches, results);
        const third = standings[2]; // index 2 = 3rd place
        if (third) {
          thirdPlaceTeams.push({
            teamId: third.teamId,
            teamName: third.teamName,
            groupCode: group.code,
            points: third.points,
            goalDiff: third.goalDiff,
            goalsFor: third.goalsFor,
            fairPlayPoints: third.fairPlayPoints,
          });
        }
      }

      // Sort by criteria
      return [...thirdPlaceTeams].sort((a, b) => {
        if (a.points !== b.points) return b.points - a.points;
        if (a.goalDiff !== b.goalDiff) return b.goalDiff - a.goalDiff;
        if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
        return a.fairPlayPoints - b.fairPlayPoints;
      });
    }),

  /** Get qualified 3rd-place teams (top 4) */
  getQualifiedThirdPlace: publicProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const groups = await ctx.db.query.tournamentGroup.findMany({
        where: eq(tournamentGroup.tournamentId, input.tournamentId),
        orderBy: [asc(tournamentGroup.code)],
      });

      const thirdPlaceTeams: Array<{ teamId: string; teamName: string; groupCode: string; points: number; goalDiff: number; goalsFor: number; fairPlayPoints: number }> = [];

      for (const group of groups) {
        const groupTeams = await ctx.db.query.team.findMany({ where: eq(team.groupId, group.id) });
        const groupMatches = await ctx.db.query.match.findMany({
          where: and(eq(match.groupId, group.id), eq(match.stage, "group"), eq(match.status, "completed")),
        });
        const matchIds = groupMatches.map((m) => m.id);
        const results = matchIds.length > 0
          ? await ctx.db.query.matchResult.findMany({ where: inArray(matchResult.matchId, matchIds) })
          : [];
        const standings = calculateGroupStandingFromData(groupTeams, groupMatches, results);
        const third = standings[2];
        if (third) {
          thirdPlaceTeams.push({ teamId: third.teamId, teamName: third.teamName, groupCode: group.code, points: third.points, goalDiff: third.goalDiff, goalsFor: third.goalsFor, fairPlayPoints: third.fairPlayPoints });
        }
      }

      return [...thirdPlaceTeams].sort((a, b) => {
        if (a.points !== b.points) return b.points - a.points;
        if (a.goalDiff !== b.goalDiff) return b.goalDiff - a.goalDiff;
        if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
        return a.fairPlayPoints - b.fairPlayPoints;
      }).slice(0, 4);
    }),

  /** Get R16 pairings preview based on current standings */
  getR16Pairings: publicProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const groups = await ctx.db.query.tournamentGroup.findMany({
        where: eq(tournamentGroup.tournamentId, input.tournamentId),
        orderBy: [asc(tournamentGroup.code)],
      });

      const thirdPlaceTeams: Array<{ teamId: string; teamName: string; groupCode: string; points: number; goalDiff: number; goalsFor: number; fairPlayPoints: number }> = [];

      for (const group of groups) {
        const groupTeams = await ctx.db.query.team.findMany({ where: eq(team.groupId, group.id) });
        const groupMatches = await ctx.db.query.match.findMany({
          where: and(eq(match.groupId, group.id), eq(match.stage, "group"), eq(match.status, "completed")),
        });
        const matchIds = groupMatches.map((m) => m.id);
        const results = matchIds.length > 0
          ? await ctx.db.query.matchResult.findMany({ where: inArray(matchResult.matchId, matchIds) })
          : [];
        const standings = calculateGroupStandingFromData(groupTeams, groupMatches, results);
        const third = standings[2];
        if (third) {
          thirdPlaceTeams.push({ teamId: third.teamId, teamName: third.teamName, groupCode: group.code, points: third.points, goalDiff: third.goalDiff, goalsFor: third.goalsFor, fairPlayPoints: third.fairPlayPoints });
        }
      }

      const qualified3rd = [...thirdPlaceTeams].sort((a, b) => {
        if (a.points !== b.points) return b.points - a.points;
        if (a.goalDiff !== b.goalDiff) return b.goalDiff - a.goalDiff;
        if (a.goalsFor !== b.goalsFor) return b.goalsFor - a.goalsFor;
        return a.fairPlayPoints - b.fairPlayPoints;
      }).slice(0, 4);

      const thirdPlaceGroupCodes = qualified3rd.map((s) => s.groupCode);
      const allPairings = getAllR16Pairings(thirdPlaceGroupCodes);
      const dynamicPairings = getDynamicPairings(thirdPlaceGroupCodes);

      return {
        qualifyingThirdPlaceGroups: thirdPlaceGroupCodes,
        matrixKey: buildMatrixKey(thirdPlaceGroupCodes),
        dynamicPairings,
        fixedPairings: allPairings.filter((p) => p.isFixed),
        allPairings,
      };
    }),
});
