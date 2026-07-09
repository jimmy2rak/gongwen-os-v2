// ─── POST /api/auth/send-code ────────────────────
// 发送登录验证码（6 位数字）与 Magic Link（一次性链接）
// 复用 verification_tokens 表，10 分钟过期

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { verificationTokens } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { sendLoginCodeEmail } from "@/server/email/send";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_EMAIL", message: "请输入邮箱地址" } },
        { status: 400 },
      );
    }

    // 生成 6 位数字验证码 + 48 位 Magic Link token
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const magicToken = nanoid(48);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 分钟过期

    // 作废旧验证码
    await db
      .update(verificationTokens)
      .set({ used: true })
      .where(and(eq(verificationTokens.email, email), eq(verificationTokens.used, false)));

    // 存入 OTP 验证码
    await db.insert(verificationTokens).values({
      id: `vt_${nanoid(16)}`,
      email,
      type: "otp",
      token: code,
      expiresAt,
      used: false,
      createdAt: new Date(),
    });

    // 存入 Magic Link token
    await db.insert(verificationTokens).values({
      id: `vt_${nanoid(16)}`,
      email,
      type: "magic_link",
      token: magicToken,
      expiresAt,
      used: false,
      createdAt: new Date(),
    });

    // 发送邮件（验证码 + Magic Link）
    const magicUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/auth/magic-link?token=${magicToken}`;
    await sendLoginCodeEmail(email, code, magicUrl);

    return NextResponse.json({ success: true, message: "验证码已发送到邮箱" });
  } catch (err) {
    console.error("[send-code]", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL", message: "服务器错误" } },
      { status: 500 },
    );
  }
}
