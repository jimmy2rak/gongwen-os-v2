// ── AI 用户记忆表（按账号持久化的 AI 写作偏好）──
// 存储每个用户的语言用词习惯、公文写作强化、个人信息，
// 以及系统自动从对话中学习到的笔记（autoNotes）。
// 该表数据会被注入到 AI 系统提示词，使生成内容贴合用户个人风格。
// 按 user_id 唯一，刷新 / 重新登录 / 更换设备均不丢失。
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const userMemory = sqliteTable("user_memory", {
  id: text("id").primaryKey(),                           // "um" + nanoid(12)
  userId: text("user_id").notNull().unique(),            // 关联 users.id
  personalInfo: text("personal_info"),                   // 个人信息（单位 / 职务 / 常用落款等）
  languageHabits: text("language_habits"),               // 语言用词习惯（口头禅 / 偏好词 / 禁用词）
  writingEnhancements: text("writing_enhancements"),     // 公文写作强化要点（结构 / 语气 / 规范）
  autoNotes: text("auto_notes"),                         // 系统自动学习笔记（只读，由 AI 对话提取）
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
