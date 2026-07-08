// ─── AI API Key 表 ──────────────────────────────
// 存储用户配置的 AI API Key
// encrypted 字段使用 AES-256-GCM 加密（密文 base64）
// iv 字段存储加密时使用的初始化向量
// base_url 允许用户覆盖厂商预设 URL（如 MiniCPM、私有部署）

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),                 // deepseek | doubao | openai | qwen | kimi | glm | nvidia | minicpm
  encrypted: text("encrypted").notNull(),               // AES-256-GCM 加密后的密文（base64）
  iv: text("iv").notNull(),                             // AES 初始化向量（base64）
  models: text("models").notNull().default("[]"),       // JSON model 列表
  defaultModel: text("default_model"),                  // 默认模型
  baseUrl: text("base_url"),                            // 自定义接口地址（覆盖预设）
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
