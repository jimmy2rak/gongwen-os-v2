// ─── POST /api/auth/login — 用户登录 ─────────────────
// 接收邮箱 + 密码，验证身份，签发 JWT，设置 Cookie

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { comparePassword } from "@/server/auth/password";
import { createToken, createAccessToken, createRefreshToken } from "@/server/auth/jwt";

export async function POST(req: NextRequest) {
  try {
    // 1. 解析请求体
    const { email, password } = await req.json();

    // 2. 参数校验
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_FIELDS", message: "邮箱和密码不能为空" } },
        { status: 400 }
      );
    }

    // 3. 查找用户
    const userList = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (userList.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_CREDENTIALS", message: "邮箱或密码错误" } },
        { status: 401 }
      );
    }

    const user = userList[0];

    // 4. 验证密码
    // 如果用户没有密码（比如 OAuth 注册的），不能密码登录
    if (!user.password) {
      return NextResponse.json(
        { success: false, error: { code: "NO_PASSWORD", message: "该账号未设置密码，请使用其他方式登录" } },
        { status: 401 }
      );
    }

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_CREDENTIALS", message: "邮箱或密码错误" } },
        { status: 401 }
      );
    }

    // 5. 签发 JWT
    const jwt = await createToken({
      sub: user.id,
      email: user.email,
      name: user.name,
    });
    const refreshToken = await createRefreshToken({
      sub: user.id,
      email: user.email,
      name: user.name,
    });

    // 6. 设置 Cookie 并返回
    const response = NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });

    response.cookies.set("auth_token", jwt, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    response.cookies.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("[Login] Error:", error);
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "登录失败，请稍后重试" } },
      { status: 500 }
    );
  }
}
