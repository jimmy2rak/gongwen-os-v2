// ─── 中间件 — JWT 路由保护 ─────────────────────────
// 每次用户访问页面时，中间件检查 auth_token Cookie
// 如果 token 有效 → 放行
// 如果 token 无效 → 重定向到 /login

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

/**
 * 获取 JWT 密钥
 * 中间件在 Edge Runtime 中运行，process.env 可能有限制
 */
function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  return new TextEncoder().encode(secret || "fallback-secret-do-not-use-in-production");
}

/** 不需要登录就能访问的路径 */
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/reset-password",   // 重置密码页
  "/auth/magic-link",  // Magic Link 自动登录
  "/api/auth",         // 所有认证 API
  "/api/export",       // 文档导出（ExportMenu 调用时无 Cookie）
  "/api/public",       // 爬虫入库开放接口（用 X-Crawler-Auth 头鉴权，无 JWT Cookie）
  "/_next",            // Next.js 内部资源
  "/favicon.ico",
  "/favicon.svg",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 公开路径直接放行
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // 读取 auth_token cookie
  const authToken = req.cookies.get("auth_token")?.value;

  if (authToken) {
    try {
      // 验证 JWT
      await jwtVerify(authToken, getJWTSecret());
      // 验证通过 → 放行
      return NextResponse.next();
    } catch {
      // token 过期或无效 → 清除 cookie 并重定向
    }
  }

  // 未登录 → 重定向到登录页，并在 URL 中记录原始路径
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("redirect", pathname);
  const response = NextResponse.redirect(loginUrl);

  // 清除无效 token
  response.cookies.set("auth_token", "", {
    maxAge: 0,
    path: "/",
  });

  return response;
}

export const config = {
  // 匹配所有路径，排除静态资源
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
