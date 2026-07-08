// ─── GET /api/auth/me — 获取当前登录用户信息 ────────
// 从 Cookie 中解析 JWT，返回用户基本信息
// 前端用来判断用户是否已登录

import { NextResponse } from "next/server";
import { getServerUser } from "@/server/auth/guard";

export async function GET() {
  const user = await getServerUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  return NextResponse.json({
    success: true,
    data: user,
  });
}
