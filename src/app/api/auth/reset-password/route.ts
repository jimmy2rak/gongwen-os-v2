// ─── POST /api/auth/reset-password ────────────────
// 接收 token + 新密码，验证 token 有效性，更新用户密码

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, verificationTokens } from "@/server/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { hashPassword } from "@/server/auth/password";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token || !password || password.length < 6) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_INPUT", message: "密码至少 6 位" } },
        { status: 400 },
      );
    }

    // 查找有效的 reset token
    const records = await db
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.token, token),
          eq(verificationTokens.type, "reset_password"),
          eq(verificationTokens.used, false),
          gt(verificationTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (records.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_TOKEN", message: "链接无效或已过期" } },
        { status: 400 },
      );
    }

    const record = records[0];

    // 更新用户密码
    const hashed = await hashPassword(password);
    await db
      .update(users)
      .set({ password: hashed, updatedAt: new Date() })
      .where(eq(users.email, record.email));

    // 标记 token 已使用
    await db
      .update(verificationTokens)
      .set({ used: true })
      .where(eq(verificationTokens.id, record.id));

    return NextResponse.json({ success: true, message: "密码已重置，请用新密码登录" });
  } catch (err) {
    console.error("[reset-password]", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL", message: "服务器错误" } },
      { status: 500 },
    );
  }
}
