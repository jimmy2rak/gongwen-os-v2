// ─── GET /api/auth/me — 获取当前登录用户信息 ────────
// 从 Cookie 中解析 JWT，返回用户基本信息（含头像）
// 前端用来判断用户是否已登录

import { NextResponse } from "next/server";
import { getServerUser } from "@/server/auth/guard";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getUserPermissions } from "@/server/auth/permission";

export async function GET() {
  const user = await getServerUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  // 补充头像 / 名称 / 角色（users 表），失败不影响主流程
  let avatar: string | null = null;
  let name = user.name;
  let role = "user";
  try {
    const rows = await db
      .select({ avatar: users.avatar, name: users.name, role: users.role })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    if (rows.length > 0) {
      avatar = rows[0].avatar ?? null;
      name = rows[0].name ?? user.name;
      role = rows[0].role ?? "user";
    }
  } catch {
    // 忽略：头像查询失败不影响登录态
  }

  // 细粒度权限（超管自动拥有全部）
  let permissions: string[] = [];
  try {
    permissions = await getUserPermissions(user.id);
  } catch {
    permissions = [];
  }

  return NextResponse.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name,
      avatar,
      role,
      permissions,
    },
  });
}
