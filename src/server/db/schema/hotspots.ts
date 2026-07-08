// ─── 热点资讯表 ──────────────────────────────────
// 存储爬虫抓取的热点新闻，支持原文预览、星标转文档

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const hotspots = sqliteTable("hotspots", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  source: text("source").notNull(),                    // 来源名称（如"人民日报"）
  sourceId: text("source_id"),                          // 关联 hotspot_sources.id
  category: text("category").notNull().default("综合"), // 分类标签
  url: text("url"),                                     // 原文链接
  htmlContent: text("html_content"),                    // 完整原文 HTML（用于预览）
  heat: integer("heat").notNull().default(0),
  starred: integer("starred", { mode: "boolean" }).notNull().default(false),
  starCategory: text("star_category"),                  // 星标后存储的公文类型
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
