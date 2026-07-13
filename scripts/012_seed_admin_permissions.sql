-- 012_seed_admin_permissions.sql
-- 权限目录表（admin_permission）初始数据。
-- 与 src/app/api/admin/users/route.ts 的 ADMIN_PERMISSIONS、src/server/auth/permission.ts 的
-- ALL_ADMIN_PERMISSIONS 保持一致。重复执行安全（INSERT OR IGNORE 语义）。

INSERT INTO admin_permission (id, label, description, sort_order) VALUES
  ('crawler_manage',   '爬虫热点推送配置', '管理爬虫数据源与生成脚本', 1),
  ('user_manage',      '用户权限管理',     '查看用户列表并分配管理员权限', 2),
  ('reviewer_manage',  '审阅人管理',       '配置公文审阅人名单', 3),
  ('skill_manage',     '全局Skill管理',    '配置全局写作规范', 4),
  ('api_config',       'API配置管理',      '配置 AI 厂商密钥（含系统默认）', 5),
  ('system_settings',  '系统设置管理',     '管理系统级设置', 6)
ON CONFLICT(id) DO UPDATE SET
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order;
