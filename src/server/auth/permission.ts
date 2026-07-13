// ─── 细粒度权限鉴权 ──────────────────────────────
// 超级管理员（sys_super_admin 白名单）自动拥有全部权限；
// 普通管理员按 user_permission 关联表判权。
// 各业务接口（爬虫 / API 配置 / 用户管理等）调用 hasPermission 做真实闸门。

import { client } from "@/server/db";
import { isSuperAdmin } from "./super-admin";

// 全部管理员权限码（与 admin_permission 表、前端权限定义保持一致）
export const ALL_ADMIN_PERMISSIONS = [
  "crawler_manage",
  "user_manage",
  "reviewer_manage",
  "skill_manage",
  "api_config",
  "system_settings",
] as const;

export type AdminPermission = (typeof ALL_ADMIN_PERMISSIONS)[number];

// 获取用户拥有的权限码列表（超管返回全部）
export async function getUserPermissions(userId: string): Promise<string[]> {
  if (!userId) return [];
  try {
    if (await isSuperAdmin(userId)) return [...ALL_ADMIN_PERMISSIONS];
    const rows = await client.execute({
      sql: "SELECT permission_id FROM user_permission WHERE user_id = ?",
      args: [userId],
    });
    return ((rows.rows as any[]) || []).map((r) => r.permission_id as string);
  } catch {
    // Fail-Closed：异常视为无权限
    return [];
  }
}

// 判断用户是否拥有某权限（超管恒为 true）
export async function hasPermission(userId: string, permId: string): Promise<boolean> {
  if (!userId || !permId) return false;
  const perms = await getUserPermissions(userId);
  return perms.includes(permId);
}
