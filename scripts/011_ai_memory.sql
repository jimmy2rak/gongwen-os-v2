-- 011_ai_memory.sql
-- AI 用户记忆表（按账号持久化的 AI 写作偏好与自动学习笔记）
-- 运行一次即可，重复执行安全（IF NOT EXISTS）。

CREATE TABLE IF NOT EXISTS user_memory (
  id                   TEXT PRIMARY KEY,                          -- "um" + nanoid(12)
  user_id              TEXT NOT NULL UNIQUE,                     -- 关联 users.id
  personal_info        TEXT,                                      -- 个人信息
  language_habits      TEXT,                                      -- 语言用词习惯
  writing_enhancements TEXT,                                      -- 公文写作强化要点
  auto_notes           TEXT,                                      -- 系统自动学习笔记（只读）
  updated_at           INTEGER NOT NULL                          -- 更新时间戳（秒）
);
