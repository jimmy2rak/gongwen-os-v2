// ─── 超级管理员鉴权 ──────────────────────────────
// 任何爬虫管理接口都先经由此处校验：当前登录用户是否位于 sys_super_admin 白名单。
// 白名单只能由项目负责人手动写库，前端无任何增删改入口。

import { client } from "@/server/db";
import { getServerUser, type ServerUser } from "./guard";

/**
 * 判断指定 user_id 是否为超级管理员
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const rows = await client.execute({
      sql: "SELECT 1 FROM sys_super_admin WHERE user_id = ? LIMIT 1",
      args: [userId],
    });
    return (rows.rows?.length ?? 0) > 0;
  } catch {
    // 表不存在等异常一律视为无权限（Fail-Closed，绝不放宽）
    return false;
  }
}

/**
 * 获取已登录且为超级管理员的服务端用户；否则返回 null。
 * 在爬虫管理接口开头调用即可完成「登录 + 白名单」双重校验。
 */
export async function getSuperAdminUser(): Promise<ServerUser | null> {
  const user = await getServerUser();
  if (!user) return null;
  if (!(await isSuperAdmin(user.id))) return null;
  return user;
}
