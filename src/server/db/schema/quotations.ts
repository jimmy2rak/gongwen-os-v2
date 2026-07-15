// ─── 金句库表（按账号隔离） ──────────────────────
// 用户手动录入或从文章/编辑器/热点中圈选添加的金句
// sourceType: document | knowledge | hotspot | editor | manual
// sourceId:   来源文档/文章 id（manual 为空）

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const quotations = sqliteTable("quotations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  content: text("content").notNull(),
  sourceType: text("source_type").notNull().default("manual"),
  sourceId: text("source_id").notNull().default(""),
  sourceTitle: text("source_title").notNull().default(""),
  category: text("category").notNull().default(""),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
