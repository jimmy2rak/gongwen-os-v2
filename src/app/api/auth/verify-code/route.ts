// ─── POST /api/auth/verify-code ──────────────────
// 验证 6 位数字验证码，通过后直接签发 JWT 登录
// 验证码在 verification_tokens 表中，type="otp"，10 分钟过期

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, verificationTokens } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createAccessToken, createRefreshToken } from "@/server/auth/jwt";

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();
    if (!email || !code) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_PARAMS", message: "邮箱和验证码不能为空" } },
        { status: 400 },
      );
    }

    // 查找未使用、未过期的 OTP
    const records = await db
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.email, email),
          eq(verificationTokens.type, "otp"),
          eq(verificationTokens.token, String(code)),
          eq(verificationTokens.used, false),
        ),
      )
      .limit(1);

    if (records.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_CODE", message: "验证码无效" } },
        { status: 400 },
      );
    }

    const record = records[0];

    // 检查过期
    if (new Date() > record.expiresAt) {
      return NextResponse.json(
        { success: false, error: { code: "EXPIRED_CODE", message: "验证码已过期，请重新获取" } },
        { status: 400 },
      );
    }

    // 标记已使用
    await db
      .update(verificationTokens)
      .set({ used: true })
      .where(eq(verificationTokens.id, record.id));

    // 同邮箱的其他验证码也一并作废
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
    console.error("[verify-code]", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL", message: "服务器错误" } },
      { status: 500 },
    );
  }
}
