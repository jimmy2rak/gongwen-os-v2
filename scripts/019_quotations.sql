-- 019_quotations.sql
-- 金句库：用户私有，按 user_id 隔离
CREATE TABLE IF NOT EXISTS quotations (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  content      TEXT NOT NULL,
  source_type  TEXT NOT NULL DEFAULT 'manual',
  source_id    TEXT NOT NULL DEFAULT '',
  source_title TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quotations_user ON quotations(user_id);
CREATE INDEX IF NOT EXISTS idx_quotations_source ON quotations(user_id, source_id);
