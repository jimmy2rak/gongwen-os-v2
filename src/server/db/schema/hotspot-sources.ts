// ─── 热点数据源配置表 ────────────────────────────
// 存储用户配置的爬虫数据源，每行一个板块

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const hotspotSources = sqliteTable("hotspot_sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),                         // 板块名称（如"人民日报"）
  url: text("url").notNull(),                           // 爬取目标 URL
  category: text("category").notNull().default("综合"), // 默认分类标签
  selectorTitle: text("selector_title"),                // CSS 选择器：标题
  selectorSummary: text("selector_summary"),            // CSS 选择器：摘要
  selectorLink: text("selector_link"),                  // CSS 选择器：链接
  selectorContent: text("selector_content"),            // CSS 选择器：正文 HTML
  isBuiltin: integer("is_builtin", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
