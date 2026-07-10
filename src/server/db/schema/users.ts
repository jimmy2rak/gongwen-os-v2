// ─── 用户表 ──────────────────────────────────────────
// 存储注册用户的信息
import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),                           // "u" + nanoid(12)，例如 "uabc123def456"
  email: text("email").notNull().unique(),               // 登录邮箱，唯一
  password: text("password"),                            // bcrypt 哈希后的密码（OAuth 用户可为 null）
  name: text("name"),                                    // 显示名称
  avatar: text("avatar"),                                // 头像 URL
  emailVerified: integer("email_verified", { mode: "timestamp" }), // 邮箱验证时间，null = 未验证
  preferredTemplateId: text("preferred_template_id"),
  role: text("role").notNull().default("user"),          // user / admin / super_admin
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

// ── 管理员权限定义表 ──
export const adminPermission = sqliteTable("admin_permission", {
  id: text("id").primaryKey(),                           // 权限编码，如 crawler_manage
  label: text("label").notNull(),                        // 权限显示名称
  description: text("description"),                      // 权限说明
  sortOrder: integer("sort_order").notNull().default(0), // 排序
});

// ── 用户-权限关联表（管理员拥有的具体权限）──
export const userPermission = sqliteTable("user_permission", {
  userId: text("user_id").notNull(),                     // 关联 users.id
  permissionId: text("permission_id").notNull(),         // 关联 admin_permission.id
  grantedAt: integer("granted_at", { mode: "timestamp" }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.permissionId] }),
}));

