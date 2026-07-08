// ─── POST /api/auth/logout — 退出登录 ────────────────
// 清除 auth_token + refresh_token Cookie

import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });

  const clearCookie = (name: string) => {
    response.cookies.set(name, "", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  };

  clearCookie("auth_token");
  clearCookie("refresh_token");

  return response;
}
