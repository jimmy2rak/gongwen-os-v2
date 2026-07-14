-- 018_user_profiles.sql
-- 用户画像按账号隔离入库（原 localStorage gw-profiles 迁移到此处，由客户端在首次打开时写入）
CREATE TABLE IF NOT EXISTS user_profiles (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL DEFAULT '',
  unit       TEXT NOT NULL DEFAULT '',
  level      TEXT NOT NULL DEFAULT '',
  type       TEXT NOT NULL DEFAULT '',
  is_default INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles(user_id);
