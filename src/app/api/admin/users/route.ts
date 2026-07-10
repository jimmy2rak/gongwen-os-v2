// ─── /api/admin/users ────────────────────────────
// 超级管理员用户与权限管理
// GET  ：列出所有用户及其角色、权限
// PUT  ：修改指定用户的角色与权限列表

import { NextRequest, NextResponse } from "next/server";
import { client } from "@/server/db";
import { getServerUser } from "@/server/auth/guard";
import { isSuperAdmin } from "@/server/auth/super-admin";

// 权限列表（仅普通用户没有的权限）
const ADMIN_PERMISSIONS = [
  { id: "crawler_manage", label: "爬虫热点推送配置", description: "管理爬虫数据源与生成脚本" },
  { id: "user_manage", label: "用户权限管理", description: "查看用户列表并分配管理员权限" },
  { id: "reviewer_manage", label: "审阅人管理", description: "配置公文审阅人名单" },
  { id: "skill_manage", label: "全局Skill管理", description: "配置全局写作规范" },
  { id: "api_config", label: "API配置管理", description: "配置 AI 厂商密钥" },
  { id: "system_settings", label: "系统设置管理", description: "管理系统级设置" },
];

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: string;
  created_at: number;
}

/** 检查当前用户是否为超级管理员 */
async function requireSuperAdmin() {
  const user = await getServerUser();
  if (!user) return { error: NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 }) };
  if (!(await isSuperAdmin(user.id))) {
    return { error: NextResponse.json({ success: false, error: { message: "无权限：仅超级管理员可管理用户" } }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  const check = await requireSuperAdmin();
  if (check.error) return check.error;

  try {
    // 1. 拉取所有用户
    const usersRes = await client.execute({
      sql: `SELECT id, email, name, avatar, role, created_at FROM users ORDER BY role DESC, created_at DESC`,
    });
    const users = (usersRes.rows as any[]).map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      avatar: r.avatar,
      role: r.role,
      createdAt: r.created_at,
    })) as unknown as UserRow[];

    // 2. 拉取所有用户权限
    const permsRes = await client.execute({
      sql: `SELECT user_id, permission_id FROM user_permission`,
    });
    const userPerms: Record<string, string[]> = {};
    (permsRes.rows as any[]).forEach((r) => {
      const uid = r.user_id as string;
      if (!userPerms[uid]) userPerms[uid] = [];
      userPerms[uid].push(r.permission_id as string);
    });

    // 3. 超管自动拥有全部权限
    const data = users.map((u) => ({
      ...u,
      permissions: u.role === "super_admin" ? ADMIN_PERMISSIONS.map((p) => p.id) : (userPerms[u.id] || []),
    }));

    return NextResponse.json({ success: true, data, permissions: ADMIN_PERMISSIONS });
  } catch (e) {
    console.error("[admin/users] GET error:", e);
    return NextResponse.json({ success: false, error: { message: "查询失败" } }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const check = await requireSuperAdmin();
  if (check.error) return check.error;

  try {
    const body = await req.json();
    const { userId, role, permissions } = body;

    if (!userId || !role || !["user", "admin", "super_admin"].includes(role)) {
      return NextResponse.json({ success: false, error: { message: "参数错误" } }, { status: 400 });
    }

    // 不能修改自己以外的超管为低权限？这里允许，但要防止系统无超管至少留一个白名单兜底
    // 1. 更新角色
    await client.execute({
      sql: `UPDATE users SET role = ?, updated_at = ? WHERE id = ?`,
      args: [role, Date.now(), userId],
    });

    // 2. 如果是超管，清空 user_permission（超管拥有全部权限）
    if (role === "super_admin") {
      await client.execute({
        sql: `DELETE FROM user_permission WHERE user_id = ?`,
        args: [userId],
      });
      return NextResponse.json({ success: true });
    }

    // 3. 普通用户/管理员：同步权限列表
    const validPerms = Array.isArray(permissions) ? permissions.filter((p) => ADMIN_PERMISSIONS.some((ap) => ap.id === p)) : [];

    // 先删除旧权限
    await client.execute({
      sql: `DELETE FROM user_permission WHERE user_id = ?`,
      args: [userId],
    });

    // 再插入新权限
    if (validPerms.length > 0) {
      const placeholders = validPerms.map(() => "(?, ?, ?)").join(", ");
      const args: (string | number)[] = [];
      validPerms.forEach((pid) => {
        args.push(userId, pid, Date.now());
      });
      await client.execute({
        sql: `INSERT INTO user_permission (user_id, permission_id, granted_at) VALUES ${placeholders}`,
        args,
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[admin/users] PUT error:", e);
    return NextResponse.json({ success: false, error: { message: "保存失败" } }, { status: 500 });
  }
}
