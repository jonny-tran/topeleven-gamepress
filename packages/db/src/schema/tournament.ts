import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, integer, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";

// ============================================================
// TABLES
// ============================================================

export const tournament = pgTable("tournament", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("setup"),
  /**
   * Tài khoản sở hữu giải đấu — nền tảng của toàn bộ phân quyền.
   *
   * Ai có `ownerId` trùng với user đang đăng nhập thì được toàn quyền với
   * giải này. Admin (`user.role = "admin"`) cũng được toàn quyền bất kể
   * `ownerId`. Mọi người còn lại chỉ được xem nếu `isPublic = true`.
   *
   * Cột cho phép NULL để các giải tạo trước khi có tính năng này vẫn tồn
   * tại; migration backfill sẽ gán owner cho chúng. Xoá tài khoản KHÔNG
   * xoá giải — ownerId chuyển về NULL và admin vẫn quản lý được.
   */
  ownerId: text("owner_id").references(() => user.id, { onDelete: "set null" }),
  /**
   * Soft-publish flag. When false, the tournament is treated as a draft and
   * hidden from public listings (`/tournaments`). Admin pages can still see
   * drafts. Defaults to false so a newly created tournament must be
   * explicitly published by an admin before public users can see it.
   */
  isPublic: boolean("is_public").notNull().default(false),
  /**
   * Set when an admin archives the tournament. Archived tournaments remain
   * fully recoverable (data preserved, can be restored).
   */
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  /**
   * Set when an admin soft-deletes the tournament. Data is preserved in the
   * database but the tournament is hidden from all UI surfaces except the
   * "Đã xóa" tab in admin. Hard-delete is NOT performed — this column is the
   * source of truth for "user-visible deletion".
   */
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  /**
   * Set when an admin manually closes the tournament. Differs from a natural
   * `status = "completed"` because a close can happen at any stage.
   */
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index("tournament_status_idx").on(table.status),
  index("tournament_archived_idx").on(table.archivedAt),
  index("tournament_deleted_idx").on(table.deletedAt),
  index("tournament_public_idx").on(table.isPublic),
  index("tournament_owner_idx").on(table.ownerId),
]);

// 6 groups per tournament (A, B, C, D, E, F)
export const tournamentGroup = pgTable("tournament_group", {
  id: text("id").primaryKey(),
  tournamentId: text("tournament_id").notNull().references(() => tournament.id, { onDelete: "cascade" }),
  code: text("code").notNull(), // A, B, C, D, E, F
}, (table) => [
  uniqueIndex("tournament_group_tournament_code_idx").on(table.tournamentId, table.code),
]);

// 24 teams per tournament (4 pots × 6 teams each)
export const team = pgTable("team", {
  id: text("id").primaryKey(),
  tournamentId: text("tournament_id").notNull().references(() => tournament.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  coachName: text("coach_name").notNull(),
  associationName: text("association_name").notNull(),
  associationCode: text("association_code").notNull(),
  pot: integer("pot").notNull(), // 1, 2, 3, 4
  groupId: text("group_id").references(() => tournamentGroup.id), // nullable, set after draw
  position: integer("position"), // nullable, 1-4, set after draw
}, (table) => [
  uniqueIndex("team_tournament_name_idx").on(table.tournamentId, table.name),
  index("team_tournament_pot_idx").on(table.tournamentId, table.pot),
  index("team_group_idx").on(table.groupId),
]);

// Match table - all matches (group + knockout)
export const match = pgTable("match", {
  id: text("id").primaryKey(),
  tournamentId: text("tournament_id").notNull().references(() => tournament.id, { onDelete: "cascade" }),
  stage: text("stage").notNull(), // group | round_of_16 | quarter | semi | third_place | final
  groupId: text("group_id").references(() => tournamentGroup.id),
  round: integer("round").notNull(), // 1-6 for group, 1 for knockout
  leg: integer("leg").notNull(), // 1 or 2
  homeTeamId: text("home_team_id").notNull().references(() => team.id),
  awayTeamId: text("away_team_id").notNull().references(() => team.id),
  matchDate: timestamp("match_date", { withTimezone: true }).notNull(),
  matchTime: text("match_time"),
  status: text("status").notNull().default("pending"), // pending | in_progress | completed
  winnerTeamId: text("winner_team_id").references(() => team.id), // knockout only, set after both legs
  bracketSlot: text("bracket_slot"), // e.g. R16_1, QF_A1, etc.
}, (table) => [
  index("match_tournament_idx").on(table.tournamentId),
  index("match_group_idx").on(table.groupId),
  index("match_stage_idx").on(table.stage),
  index("match_status_idx").on(table.status),
]);

// 1:1 with match table
export const matchResult = pgTable("match_result", {
  id: text("id").primaryKey(),
  matchId: text("match_id").notNull().unique().references(() => match.id, { onDelete: "cascade" }),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  homeYellowCards: integer("home_yellow_cards").default(0),
  homeRedCards2Y: integer("home_red_cards_2y").default(0),
  homeRedCardsDirect: integer("home_red_cards_direct").default(0),
  awayYellowCards: integer("away_yellow_cards").default(0),
  awayRedCards2Y: integer("away_red_cards_2y").default(0),
  awayRedCardsDirect: integer("away_red_cards_direct").default(0),
  pendingDraw: boolean("pending_draw").default(false),
});

// ============================================================
// RELATIONS
// ============================================================

export const tournamentRelations = relations(tournament, ({ one, many }) => ({
  owner: one(user, {
    fields: [tournament.ownerId],
    references: [user.id],
  }),
  groups: many(tournamentGroup),
  teams: many(team),
  matches: many(match),
}));

export const tournamentGroupRelations = relations(tournamentGroup, ({ one, many }) => ({
  tournament: one(tournament, {
    fields: [tournamentGroup.tournamentId],
    references: [tournament.id],
  }),
  teams: many(team),
  matches: many(match),
}));

export const teamRelations = relations(team, ({ one, many }) => ({
  tournament: one(tournament, {
    fields: [team.tournamentId],
    references: [tournament.id],
  }),
  group: one(tournamentGroup, {
    fields: [team.groupId],
    references: [tournamentGroup.id],
  }),
  homeMatches: many(match, { relationName: "homeTeam" }),
  awayMatches: many(match, { relationName: "awayTeam" }),
}));

export const matchRelations = relations(match, ({ one }) => ({
  tournament: one(tournament, {
    fields: [match.tournamentId],
    references: [tournament.id],
  }),
  group: one(tournamentGroup, {
    fields: [match.groupId],
    references: [tournamentGroup.id],
  }),
  homeTeam: one(team, {
    fields: [match.homeTeamId],
    references: [team.id],
    relationName: "homeTeam",
  }),
  awayTeam: one(team, {
    fields: [match.awayTeamId],
    references: [team.id],
    relationName: "awayTeam",
  }),
  winner: one(team, {
    fields: [match.winnerTeamId],
    references: [team.id],
  }),
  result: one(matchResult),
}));

export const matchResultRelations = relations(matchResult, ({ one }) => ({
  match: one(match, {
    fields: [matchResult.matchId],
    references: [match.id],
  }),
}));

// ============================================================
// TYPES
// ============================================================

export type Tournament = typeof tournament.$inferSelect;
export type NewTournament = typeof tournament.$inferInsert;
export type TournamentGroup = typeof tournamentGroup.$inferSelect;
export type NewTournamentGroup = typeof tournamentGroup.$inferInsert;
export type Team = typeof team.$inferSelect;
export type NewTeam = typeof team.$inferInsert;
export type Match = typeof match.$inferSelect;
export type NewMatch = typeof match.$inferInsert;
export type MatchResult = typeof matchResult.$inferSelect;
export type NewMatchResult = typeof matchResult.$inferInsert;
