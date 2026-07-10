-- 010_admin_permissions.sql
-- 用户角色与管理员权限体系

-- 1. 给用户表增加角色字段
ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user';

-- 2. 管理员权限定义表
CREATE TABLE IF NOT EXISTS admin_permission (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- 3. 用户-权限关联表
CREATE TABLE IF NOT EXISTS user_permission (
  user_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  granted_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, permission_id)
);

-- 4. 初始化权限列表（仅普通用户没有的权限）
INSERT OR IGNORE INTO admin_permission (id, label, description, sort_order) VALUES
('crawler_manage', '爬虫热点推送配置', '管理爬虫数据源与生成脚本', 1),
('user_manage', '用户权限管理', '查看用户列表并分配管理员权限', 2),
('reviewer_manage', '审阅人管理', '配置公文审阅人名单', 3),
('skill_manage', '全局Skill管理', '配置全局写作规范', 4),
('api_config', 'API配置管理', '配置 AI 厂商密钥', 5),
('system_settings', '系统设置管理', '管理系统级设置', 6);

-- 5. 将现有 sys_super_admin 白名单中的用户标记为 super_admin
UPDATE users SET role = 'super_admin'
WHERE id IN (SELECT user_id FROM sys_super_admin);
