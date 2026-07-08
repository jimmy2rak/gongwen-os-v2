// ─── 验证 Token 表 ────────────────────────────────────
// 存储 OTP 验证码、Magic Link、密码重置 token
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const verificationTokens = sqliteTable("verification_tokens", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),                        // 目标邮箱
  type: text("type").notNull(),                          // "otp" | "magic_link" | "reset_password"
  token: text("token").notNull(),                        // 验证码或 token 值
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(), // 过期时间戳
  used: integer("used", { mode: "boolean" }).notNull().default(false), // 是否已使用
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
