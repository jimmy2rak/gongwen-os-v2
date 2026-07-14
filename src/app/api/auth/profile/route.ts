// ─── PUT /api/auth/profile — 修改当前登录用户资料 ──
// 支持修改：昵称(name)、邮箱(email)、头像(avatar)、手机号(phone)、密码(password)。
// 密码修改需校验当前密码（OAuth 用户无密码时可直接设置）。
// 仅能修改自己的账号，需登录态。

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getServerUser } from "@/server/auth/guard";
import { comparePassword, hashPassword } from "@/server/auth/password";
import { getUserPermissions } from "@/server/auth/permission";

export async function PUT(req: NextRequest) {
  const me = await getServerUser();
  if (!me) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    // 当前账号行（读取邮箱/密码哈希等敏感字段）
    const cur = await db
      .select({
        id: users.id,
        email: users.email,
        password: users.password,
        name: users.name,
        avatar: users.avatar,
        phone: users.phone,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, me.id))
      .limit(1);

    if (cur.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "用户不存在" } },
        { status: 404 }
      );
    }
    const row = cur[0];
    const setMap: Record<string, unknown> = {};

    // 昵称
    if (typeof body.name === "string") {
      setMap.name = body.name.trim() || null;
    }
    // 头像（允许清空）
    if (typeof body.avatar === "string") {
      setMap.avatar = body.avatar.trim() || null;
    }
    // 手机号（允许清空）
    if (typeof body.phone === "string") {
      setMap.phone = body.phone.trim() || null;
    }
    // 邮箱（变更需唯一性校验）
    if (typeof body.email === "string" && body.email.trim()) {
      const newEmail = body.email.trim();
      if (newEmail !== row.email) {
        const dup = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, newEmail))
          .limit(1);
        if (dup.length > 0) {
          return NextResponse.json(
            { success: false, error: { code: "EMAIL_EXISTS", message: "该邮箱已被其他账号使用" } },
            { status: 409 }
          );
        }
        setMap.email = newEmail;
      }
    }

    // 密码修改
    const newPassword: string | undefined =
      typeof body.newPassword === "string" ? body.newPassword : undefined;
    if (newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json(
          { success: false, error: { code: "WEAK_PASSWORD", message: "新密码至少需要 6 位" } },
          { status: 400 }
        );
      }
      // 已有密码的账号必须校验当前密码
      if (row.password) {
        const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
        const ok = await comparePassword(current, row.password);
        if (!ok) {
          return NextResponse.json(
            { success: false, error: { code: "BAD_CURRENT_PASSWORD", message: "当前密码不正确" } },
            { status: 400 }
          );
        }
      }
      setMap.password = await hashPassword(newPassword);
    }

    if (Object.keys(setMap).length === 0) {
      // 无任何变更，直接返回最新信息
      return NextResponse.json({ success: true, data: await buildUserData(me.id, row.email, row.name, row.avatar, row.phone, row.role) });
    }

    setMap.updatedAt = new Date();
    await db.update(users).set(setMap).where(eq(users.id, me.id));

    // 重新读取最新行
    const refreshed = await db
      .select({ email: users.email, name: users.name, avatar: users.avatar, phone: users.phone, role: users.role })
      .from(users)
      .where(eq(users.id, me.id))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: await buildUserData(
        me.id,
        refreshed[0].email,
        refreshed[0].name,
        refreshed[0].avatar,
        refreshed[0].phone,
        refreshed[0].role
      ),
    });
  } catch (error) {
    console.error("[Profile] Error:", error);
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "保存失败，请稍后重试" } },
      { status: 500 }
    );
  }
}

async function buildUserData(
  id: string,
  email: string,
  name: string | null,
  avatar: string | null,
  phone: string | null,
  role: string
) {
  let permissions: string[] = [];
  try {
    permissions = await getUserPermissions(id);
  } catch {
    permissions = [];
  }
  return { id, email, name, avatar, phone, role, permissions };
}
