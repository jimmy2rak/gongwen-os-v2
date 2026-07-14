-- ─── 016 为用户表增加 phone 列 ─────────────────────
-- 账户资料页支持修改手机号，users 表新增 phone 字段（可空）。
-- libSQL / Turso 支持 ADD COLUMN（无外键约束，安全）。

ALTER TABLE users ADD COLUMN phone TEXT;
