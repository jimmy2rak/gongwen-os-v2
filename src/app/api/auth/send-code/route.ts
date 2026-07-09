// ─── POST /api/auth/send-code ────────────────────
// 发送登录验证码（6 位数字）与 Magic Link（一次性链接）
// 复用 verification_tokens 表，10 分钟过期

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { verificationTokens } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { sendEmail } from "@/server/email/send";

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
    await sendEmail(
      email,
      "【公文 OS】登录验证码",
      `<div style="max-width:480px;margin:0 auto;font-family:sans-serif;padding:24px;">
        <h2 style="font-size:18px;margin-bottom:16px;">登录验证码</h2>
        <p style="font-size:14px;line-height:1.6;color:#333;">您好，</p>
        <p style="font-size:14px;line-height:1.6;color:#333;">您的登录验证码为：</p>
        <div style="text-align:center;margin:24px 0;">
          <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#163f3a;">${code}</span>
        </div>
        <p style="font-size:14px;line-height:1.6;color:#333;">验证码 10 分钟内有效。</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="font-size:13px;color:#666;">或点击下方链接直接登录（无需输入密码）：</p>
        <a href="${magicUrl}"
           style="display:inline-block;margin:8px 0;padding:10px 24px;background:#163f3a;color:#fff;
                  text-decoration:none;border-radius:8px;font-size:13px;">
          一键登录
        </a>
        <p style="font-size:12px;color:#999;margin-top:20px;">
          如非本人操作，请忽略此邮件。
        </p>
        <p style="font-size:12px;color:#999;">— 公文 OS 团队</p>
      </div>`,
    );

    return NextResponse.json({ success: true, message: "验证码已发送到邮箱" });
  } catch (err) {
    console.error("[send-code]", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL", message: "服务器错误" } },
      { status: 500 },
    );
  }
}
