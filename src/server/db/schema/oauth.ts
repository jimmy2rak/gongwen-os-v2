// ─── OAuth 账号关联表 ─────────────────────────────
// 关联用户与第三方 OAuth 账号（一个用户可绑定多个 provider）
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const oauthAccounts = sqliteTable("oauth_accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),                    // "github" | "google"
  providerAccountId: text("provider_account_id").notNull(), // GitHub/Google 的用户 ID
  accessToken: text("access_token"),                       // OAuth access token（可选存储）
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
