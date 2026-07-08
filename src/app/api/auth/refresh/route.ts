// ─── POST /api/auth/refresh — 无感刷新 Token ─────
// 验证 RefreshToken → 签发新 AccessToken + 新 RefreshToken

import { NextRequest, NextResponse } from "next/server";
import { verifyToken, createAccessToken, createRefreshToken } from "@/server/auth/jwt";

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get("refresh_token")?.value;
    if (!refreshToken) {
      return NextResponse.json({ success: false, message: "未找到刷新令牌" }, { status: 401 });
    }

    const payload = await verifyToken(refreshToken);
    if (!payload) {
      return NextResponse.json({ success: false, message: "刷新令牌已过期" }, { status: 401 });
    }

    // 签发新双令牌
    const userInfo = { sub: payload.sub, email: payload.email, name: payload.name };
    const newAccessToken = await createAccessToken(userInfo);
    const newRefreshToken = await createRefreshToken(userInfo);

    const response = NextResponse.json({ success: true });

    response.cookies.set("auth_token", newAccessToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60, // 1 小时
    });
    response.cookies.set("refresh_token", newRefreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 天
    });

    return response;
  } catch {
    return NextResponse.json({ success: false, message: "令牌刷新失败" }, { status: 500 });
  }
}
