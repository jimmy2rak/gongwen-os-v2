-- 014_reviewers.sql
-- 审阅人名单持久化（替代原先仅存 localStorage 的实现）
-- 这样「设置页配置的自定义审阅人」与「编辑器/文档管理的审阅对话框」共用同一数据源。

CREATE TABLE IF NOT EXISTS reviewers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- 初始默认审阅人（仅当表为空时由迁移脚本插入）
INSERT INTO reviewers (id, name, department, sort_order, created_at) VALUES
  ('r1', '张主任', '办公室', 1, strftime('%s','now')),
  ('r2', '李副主任', '办公室', 2, strftime('%s','now')),
  ('r3', '王科长', '综合科', 3, strftime('%s','now')),
  ('r4', '赵副科长', '综合科', 4, strftime('%s','now'));
