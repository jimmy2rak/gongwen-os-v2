// ─── 金句分类表（按账号隔离） ──────────────────────
// 用户自定义的金句分类名（如「党的政策」「工作作风」「乡村振兴」）。
// 金句本身的分类值仍存在 quotations.category（文本）中，本表用于维护
// 可选分类清单（含空分类、可重命名/删除），并给分类配色。

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const quoteCategories = sqliteTable("quote_categories", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  color: text("color").notNull().default(""),
  createdAt: integer("created_at").notNull(),
});
