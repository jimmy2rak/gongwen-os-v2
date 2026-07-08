// ─── 服务端获取当前登录用户 ──────────────────────
// 从请求的 Cookie 中读取 auth_token，验证 JWT 后返回用户信息
// 在 API Route 和 Server Component 中使用

import { cookies } from "next/headers";
import { verifyToken } from "./jwt";

export interface ServerUser {
  id: string;
  email: string;
  name: string | null;
}

/**
 * 从当前请求的 Cookie 中获取已登录用户
 * 返回值：ServerUser（已登录）或 null（未登录）
 * 
 * 使用方法：
 *   const user = await getServerUser();
 *   if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
 */
export async function getServerUser(): Promise<ServerUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (!token) return null;

    const payload = await verifyToken(token);
    if (!payload) return null;

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name || null,
    };
  } catch {
    return null;
  }
}
