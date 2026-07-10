// ─── 用户表 ──────────────────────────────────────────
// 存储注册用户的信息
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),                           // "u" + nanoid(12)，例如 "uabc123def456"
  email: text("email").notNull().unique(),               // 登录邮箱，唯一
  password: text("password"),                            // bcrypt 哈希后的密码（OAuth 用户可为 null）
  name: text("name"),                                    // 显示名称
  avatar: text("avatar"),                                // 头像 URL
  emailVerified: integer("email_verified", { mode: "timestamp" }), // 邮箱验证时间，null = 未验证
  preferredTemplateId: text("preferred_template_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ── 用户偏好表（首页快捷入口等个性化配置，按账号同步）──
export const userPreference = sqliteTable("user_preference", {
  id: text("id").primaryKey(),                           // "up" + nanoid(12)
  userId: text("user_id").notNull().unique(),            // 关联 users.id
  quickEntries: text("quick_entries"),                   // JSON 字符串：可见快捷入口 id 的有序数组
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

