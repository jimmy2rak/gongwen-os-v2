-- 017_reviewers_user_scope.sql
-- 为 reviewers 表增加 user_id 列，实现「按账号隔离」。
-- 具体回填逻辑（把现有全局审阅人按现有账号克隆 / 新账号仅播种张三）在 017_reviewers_user_scope.mjs 中执行。
ALTER TABLE reviewers ADD COLUMN user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_reviewers_user ON reviewers(user_id);
