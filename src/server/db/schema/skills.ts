// ─── 写作 Skill 表 ──────────────────────────────
// 11 类公文内置 Skill + 用户自定义 Skill
// 内置 Skill 在首次部署时自动插入数据库

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),                           // "sk" + nanoid
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull(),                  // 通知/报告/请示... 或 "通用"
  name: text("name").notNull(),
  content: text("content").notNull(),                    // Skill 规则文本（作为 AI 的 system prompt）
  isBuiltin: integer("is_builtin", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
