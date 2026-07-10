-- 009_user_preference.sql
-- 用户偏好表（首页快捷入口个性化配置，按账号同步）
-- 运行一次即可，重复执行安全（IF NOT EXISTS）。

CREATE TABLE IF NOT EXISTS user_preference (
  id            TEXT PRIMARY KEY,                          -- "up" + nanoid(12)
  user_id       TEXT NOT NULL UNIQUE,                     -- 关联 users.id
  quick_entries TEXT,                                      -- JSON：可见快捷入口 id 的有序数组
  updated_at    INTEGER NOT NULL                          -- 更新时间戳（秒）
);
