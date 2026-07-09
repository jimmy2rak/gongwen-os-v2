// ─── POST /api/auth/magic-login ─────────────────
// Magic Link 登录：验证 token，通过后签发 JWT
// token 在 verification_tokens 表中，type="magic_link"，10 分钟过期

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, verificationTokens } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createAccessToken, createRefreshToken } from "@/server/auth/jwt";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_TOKEN", message: "缺少登录令牌" } },
        { status: 400 },
      );
    }

    // 查找未使用、未过期的 Magic Link token
    const records = await db
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.type, "magic_link"),
          eq(verificationTokens.token, token),
          eq(verificationTokens.used, false),
        ),
      )
      .limit(1);

    if (records.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_TOKEN", message: "登录链接无效或已使用" } },
        { status: 400 },
      );
    }

    const record = records[0];

    // 检查过期
    if (new Date() > record.expiresAt) {
      return NextResponse.json(
        { success: false, error: { code: "EXPIRED_TOKEN", message: "登录链接已过期，请重新获取" } },
        { status: 400 },
      );
    }

    // 标记已使用
    await db
      .update(verificationTokens)
      .set({ used: true })
      .where(eq(verificationTokens.id, record.id));

    const email = record.email;

    // 作废旧验证码
    await db
      .update(verificationTokens)
      .set({ used: true })
      .where(and(eq(verificationTokens.email, email), eq(verificationTokens.used, false)));

    // 查找或自动创建用户
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    let userId: string;
    let userName: string;

    if (existing.length > 0) {
      userId = existing[0].id;
      userName = existing[0].name || email.split("@")[0];
    } else {
      userId = `u_${nanoid(16)}`;
      userName = email.split("@")[0];
      await db.insert(users).values({
        id: userId,
        email,
        name: userName,
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // 签发 JWT
    const payload = { sub: userId, email, name: userName };
    const accessJwt = await createAccessToken(payload);
    const refreshJwt = await createRefreshToken(payload);

    const response = NextResponse.json({
      success: true,
      data: { id: userId, email, name: userName },
    });

    const cookieOpts = {
      httpOnly: true as const,
      sameSite: "lax" as const,
      path: "/",
      secure: process.env.NODE_ENV === "production",
    };

    response.cookies.set("auth_token", accessJwt, { ...cookieOpts, maxAge: 7 * 86400 });
    response.cookies.set("refresh_token", refreshJwt, { ...cookieOpts, maxAge: 30 * 86400 });

    return response;
  } catch (err) {
    console.error("[magic-login]", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL", message: "服务器错误" } },
      { status: 500 },
    );
  }
}
