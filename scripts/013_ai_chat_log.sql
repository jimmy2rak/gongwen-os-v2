CREATE TABLE IF NOT EXISTS ai_chat_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_log_user ON ai_chat_log(user_id, created_at);
