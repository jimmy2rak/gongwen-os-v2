-- 006: 为 api_keys 增加 base_url 字段，允许用户覆盖厂商预设 URL
-- 同时兼容 SQLite 与 MySQL（后者可能用 IF NOT EXISTS）
ALTER TABLE api_keys ADD COLUMN base_url text;
