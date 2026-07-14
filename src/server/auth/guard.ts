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
  // 诊断：JWT_SECRET 缺失时所有请求都会被视为未登录（表现为 dashboard 卡「加载中」）
  if (!process.env.JWT_SECRET) {
    console.error(
      "[auth:getServerUser] JWT_SECRET 环境变量缺失！/api/auth/me 会一直返回未登录。" +
        "请到 Vercel 项目 Settings → Environment Variables 为 Production 配置 JWT_SECRET 后重新部署。"
    );
  }
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
