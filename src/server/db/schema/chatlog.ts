// ─── AI 对话历史记录表 ──────────────────────────
// 记录用户在公文助手（/api/ai/chat）中的对话，用于「记忆手动更新」时抓取
// 全部 AI 聊天历史，自动学习写作偏好。仅追加写入，不参与鉴权外的业务逻辑。

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const aiChatLog = sqliteTable("ai_chat_log", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  role: text("role").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

