// ─── 版本快照表 ──────────────────────────────────
// 每次保存文档时创建一条版本记录，存储完整的 content 快照
// 每个文档最多保留 MAX_VERSIONS 个版本，超出时清理最旧的

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { documents } from "./documents";

export const versions = sqliteTable("versions", {
  id: text("id").primaryKey(),                           // "ver" + nanoid
  documentId: text("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  content: text("content").notNull(),                    // 完整 TipTap HTML 快照
  data: text("data"),                                    // 完整元数据快照 JSON
  type: text("type").notNull().default("保存"),          // "初始" | "保存" | "回退"
  versionNumber: integer("version_number").notNull(),     // 从 1 递增的版本号
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
