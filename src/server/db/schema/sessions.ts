// ─── 会话表 ──────────────────────────────────────────
// 用于支持"强制退出"功能：记录已签发的 JWT，退出时标记为失效
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),                       // JWT 的 jti，用于登出时使失效
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
