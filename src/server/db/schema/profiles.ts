// ─── 用户画像表（按账号隔离）─────────────────────
// 用户画像（单位/级别/类型等）原为 localStorage 全局存储，现改为按 user_id 的数据库记录，
// 实现跨设备同步与账号隔离。

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const userProfiles = sqliteTable("user_profiles", {
  id: text("id").primaryKey(),                 // "upr" + nanoid(12)
  userId: text("user_id").notNull(),           // 关联 users.id
  name: text("name").notNull().default(""),     // 画像名称（如「默认单位」）
  unit: text("unit").notNull().default(""),     // 单位
  level: text("level").notNull().default(""),   // 省级/市级/区级/乡镇级
  type: text("type").notNull().default(""),     // 机关/事业单位/国企/...
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export type UserProfileRow = typeof userProfiles.$inferSelect;
