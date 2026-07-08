// ─── 公文模板表 ──────────────────────────────────
// 内置公文模板 + 用户自定义模板
// type: "builtin" | "custom"

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const templates = sqliteTable("templates", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull().default("custom"),  // "builtin" | "custom"
  category: text("category").notNull().default("通用"), // 模板分类
  content: text("content").notNull().default("[]"), // 模板要素列 JSON 数组
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
