// ─── 公文文档表 ──────────────────────────────────
// 核心业务表，存储用户创建的每一篇公文
// 支持软删除（deletedAt 不为 null 表示已删除）

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),                           // "doc" + nanoid
  title: text("title").notNull(),
  category: text("category").notNull(),                  // 通知/报告/请示/函/纪要/决定/通报/批复/方案/讲话稿/新闻
  format: text("format").notNull().default("gb"),        // gb | simple | official
  content: text("content").notNull().default(""),        // TipTap HTML 内容
  meta: text("meta").notNull().default("{}"),            // DocMetaInfo JSON 字符串
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reviewed: integer("reviewed", { mode: "boolean" }).notNull().default(false),
  reviewerId: text("reviewer_id"),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
  deletedAt: integer("deleted_at", { mode: "timestamp" }), // 软删除时间戳，null=未删除
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
