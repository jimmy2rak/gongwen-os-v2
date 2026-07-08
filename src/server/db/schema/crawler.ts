// ─── 爬虫热点推送系统表 ─────────────────────────
// 超管专属：数据源配置 + 一键生成 Python 爬虫 + 自动入库
//
// 四张表：
//   sys_super_admin  超级管理员白名单（无任何前端增删改入口）
//   sys_secret_config  爬虫入库 API 密钥（AES-256-GCM 加密存储）
//   crawler_source   爬虫数据源配置（超管前端 CRUD）
//   hot_article      爬虫抓取入库后的文章主表（公文前端渲染）

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ── 表1：超级管理员白名单（只能由项目负责人手动写 SQL 插入）──
export const sysSuperAdmin = sqliteTable("sys_super_admin", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().unique(),           // 绑定 users.id
  createTime: integer("create_time", { mode: "timestamp" }).notNull(),
  remark: text("remark"),                               // 备注（如：项目负责人）
});

// ── 表2：爬虫入库 API 密钥（加密存储，前端绝不展示明文）──
export const sysSecretConfig = sqliteTable("sys_secret_config", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  keyName: text("key_name").notNull().unique(),         // 如：crawler_upload
  encryptedValue: text("encrypted_value").notNull(),    // AES-256-GCM 密文
  algorithm: text("algorithm").notNull().default("aes-256-gcm"),
  createTime: integer("create_time", { mode: "timestamp" }).notNull(),
  updateTime: integer("update_time", { mode: "timestamp" }).notNull(),
});

// ── 表3：爬虫数据源配置（超管前端增删改查）──
export const crawlerSource = sqliteTable("crawler_source", {
  id: text("id").primaryKey(),                           // "cs" + nanoid(16)
  sourceName: text("source_name").notNull(),             // 数据源名称，如「人民日报」
  baseUrl: text("base_url").notNull(),                   // 抓取根地址
  targetColumnId: text("target_column_id"),              // 绑定公文系统栏目（分类名）
  categoryTag: text("category_tag").notNull().default("综合"),
  enable: integer("enable", { mode: "boolean" }).notNull().default(true),
  createBy: text("create_by"),                           // 操作超管 user_id
  createTime: integer("create_time", { mode: "timestamp" }).notNull(),
  updateTime: integer("update_time", { mode: "timestamp" }).notNull(),
});

// ── 表4：爬虫抓取入库后的文章主表 ──
// 注：规范表只有 content_plain，但因 Tiptap 预览/编辑需要 HTML，
//     额外补充 content_html 与 source_name（展示用），均不影响规范字段。
export const hotArticle = sqliteTable("hot_article", {
  id: text("id").primaryKey(),                           // "ha" + nanoid(16)
  sourceId: text("source_id"),                           // 关联 crawler_source.id
  sourceName: text("source_name"),                        // 来源名称（冗余便于展示）
  columnId: text("column_id"),                            // 归属栏目（公文分类名）
  title: text("title").notNull(),
  contentPlain: text("content_plain"),                   // 纯文本正文
  contentHtml: text("content_html"),                      // 正文 HTML（预览/编辑用）
  pageName: text("page_name"),                            // 版面名称（理论版/评论版）
  originUrl: text("origin_url"),                          // 原文外链
  crawlDate: text("crawl_date"),                          // 抓取日期 YYYYMMDD
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// 便捷类型导出
export type SysSuperAdmin = typeof sysSuperAdmin.$inferSelect;
export type CrawlerSource = typeof crawlerSource.$inferSelect;
export type HotArticle = typeof hotArticle.$inferSelect;
