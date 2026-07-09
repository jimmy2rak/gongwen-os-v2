// ─── POST /api/auth/forgot-password ───────────────
// 接收邮箱，生成重置 token，保存到 verification_tokens 表，发送邮件

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { verificationTokens } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { sendPasswordResetEmail } from "@/server/email/send";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_EMAIL", message: "请输入邮箱地址" } },
        { status: 400 },
      );
    }

    // 不管邮箱是否存在，统一返回「已发送」防止枚举
    const token = nanoid(48);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 分钟过期

    // 作废旧的重置 token
    await db
      .update(verificationTokens)
      .set({ used: true })
      .where(
        and(
          eq(verificationTokens.email, email),
          eq(verificationTokens.type, "reset_password"),
          eq(verificationTokens.used, false),
        ),
      );

    // 写入新 token
    await db.insert(verificationTokens).values({
      id: `vt_${nanoid(16)}`,
      email,
      type: "reset_password",
      token,
      expiresAt,
      used: false,
      createdAt: new Date(),
    });

    // 发送邮件（失败不影响响应）
    await sendPasswordResetEmail(email, token);

    return NextResponse.json({
      success: true,
      message: "如该邮箱已注册，重置密码链接已发送",
    });
  } catch (err) {
    console.error("[forgot-password]", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL", message: "服务器错误" } },
      { status: 500 },
    );
  }
}
