// ─── 审阅记录表 ──────────────────────────────────
// 记录每篇公文的审阅操作历史和结果
// reviewStatus: pending | approved | rejected

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { documents } from "./documents";

export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  documentId: text("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  reviewerId: text("reviewer_id").notNull(),
  reviewerName: text("reviewer_name").notNull().default(""),
  department: text("department").notNull().default(""),
  reviewStatus: text("review_status").notNull().default("pending"),  // pending | approved | rejected
  comment: text("comment").default(""),
  operatedAt: integer("operated_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
