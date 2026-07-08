// ─── POST /api/auth/register — 用户注册 ──────────────
// 接收邮箱 + 密码，创建新用户，签发 JWT，设置 Cookie
// 注册成功后自动登录（不用再单独登录一次）

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { hashPassword } from "@/server/auth/password";
import { createToken } from "@/server/auth/jwt";

export async function POST(req: NextRequest) {
  try {
    // 1. 解析请求体
    const { email, password, name } = await req.json();

    // 2. 参数校验
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_FIELDS", message: "邮箱和密码不能为空" } },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: { code: "WEAK_PASSWORD", message: "密码至少需要 6 位" } },
        { status: 400 }
      );
    }

    // 3. 检查邮箱是否已被注册
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        { success: false, error: { code: "EMAIL_EXISTS", message: "该邮箱已被注册" } },
        { status: 409 }
      );
    }

    // 4. 创建用户
    const now = new Date();
    const userId = `u${nanoid(16)}`;
    const hashedPwd = await hashPassword(password);

    await db.insert(users).values({
      id: userId,
      email,
      password: hashedPwd,
      name: name || email.split("@")[0],
      emailVerified: null,
      createdAt: now,
      updatedAt: now,
    });

    // 5. 签发 JWT
    const jwt = await createToken({
      sub: userId,
      email,
      name: name || email.split("@")[0],
    });

    // 6. 设置 HTTP-only Cookie 并返回
    const response = NextResponse.json({
      success: true,
      data: {
        id: userId,
        email,
        name: name || email.split("@")[0],
      },
    });

    // HTTP-only Cookie：前端 JS 无法读取，防止 XSS 攻击
    response.cookies.set("auth_token", jwt, {
      httpOnly: true,     // JS 不可读，防 XSS
      secure: false,      // 本地开发不用 HTTPS，设为 false；生产环境要改 true
      sameSite: "lax",    // 允许从站内链接跳转回来时携带 cookie
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 天（秒）
    });

    return response;
  } catch (error) {
    console.error("[Register] Error:", error);
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "注册失败，请稍后重试" } },
      { status: 500 }
    );
  }
}
