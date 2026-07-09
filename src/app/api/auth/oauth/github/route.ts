// ─── POST /api/auth/oauth/github ──────────────────
// GitHub OAuth 回调：用 code 换 access_token → 获取用户信息 → 查找/创建用户 → 签发 JWT

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, oauthAccounts } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createAccessToken, createRefreshToken } from "@/server/auth/jwt";

const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";
const GITHUB_EMAIL_URL = "https://api.github.com/user/emails";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ success: false, error: { code: "MISSING_CODE", message: "缺少授权码" } }, { status: 400 });
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.json({ success: false, error: { code: "NOT_CONFIGURED", message: "GitHub OAuth 未配置" } }, { status: 500 });
    }

    // 1. 用 code 换 access_token
    const tokenRes = await fetch(GITHUB_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return NextResponse.json({ success: false, error: { code: "OAUTH_ERROR", message: "GitHub 授权失败" } }, { status: 401 });
    }

    // 2. 获取用户信息
    const [userRes, emailsRes] = await Promise.all([
      fetch(GITHUB_USER_URL, { headers: { Authorization: `Bearer ${accessToken}` } }),
      fetch(GITHUB_EMAIL_URL, { headers: { Authorization: `Bearer ${accessToken}` } }),
    ]);
    const ghUser = await userRes.json();
    if (!ghUser.id) {
      return NextResponse.json({ success: false, error: { code: "USER_FETCH_FAILED", message: "获取用户信息失败" } }, { status: 401 });
    }

    // 3. 获取 primary email
    const emails = await emailsRes.json();
    const primaryEmail = emails.find((e: any) => e.primary)?.email || ghUser.email;

    // 4. 查找是否已有该 GitHub 账号关联
    const existingOAuth = await db
      .select()
      .from(oauthAccounts)
      .where(and(eq(oauthAccounts.provider, "github"), eq(oauthAccounts.providerAccountId, String(ghUser.id))))
      .limit(1);

    let userId: string;

    if (existingOAuth.length > 0) {
      // 已有关联 → 使用已有用户
      userId = existingOAuth[0].userId;
    } else if (primaryEmail) {
      // 检查邮箱是否已注册
      const existingUser = await db.select().from(users).where(eq(users.email, primaryEmail)).limit(1);
      if (existingUser.length > 0) {
        userId = existingUser[0].id;
        // 关联 OAuth 账号
        await db.insert(oauthAccounts).values({
          id: `oa_${nanoid(16)}`,
          userId,
          provider: "github",
          providerAccountId: String(ghUser.id),
          accessToken,
          createdAt: new Date(),
        });
      } else {
        // 新建用户
        userId = `u_${nanoid(16)}`;
        await db.insert(users).values({
          id: userId,
          email: primaryEmail || `github_${ghUser.id}@placeholder.local`,
          name: ghUser.name || ghUser.login || "GitHub 用户",
          avatar: ghUser.avatar_url,
          emailVerified: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        await db.insert(oauthAccounts).values({
          id: `oa_${nanoid(16)}`,
          userId,
          provider: "github",
          providerAccountId: String(ghUser.id),
          accessToken,
          createdAt: new Date(),
        });
      }
    } else {
      // 无邮箱 → 创建 placeholder 用户
      userId = `u_${nanoid(16)}`;
      const placeholderEmail = `github_${ghUser.id}@placeholder.local`;
      await db.insert(users).values({
        id: userId,
        email: placeholderEmail,
        name: ghUser.login || "GitHub 用户",
        avatar: ghUser.avatar_url,
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await db.insert(oauthAccounts).values({
        id: `oa_${nanoid(16)}`,
        userId,
        provider: "github",
        providerAccountId: String(ghUser.id),
        accessToken,
        createdAt: new Date(),
      });
    }

    // 5. 签发 JWT
    const payload = { sub: userId, email: primaryEmail || `github_${ghUser.id}@placeholder.local`, name: ghUser.name || ghUser.login };
    const accessJwt = await createAccessToken(payload);
    const refreshJwt = await createRefreshToken(payload);

    const response = NextResponse.json({ success: true, data: { id: userId, email: primaryEmail, name: ghUser.name || ghUser.login, avatar: ghUser.avatar_url } });
    response.cookies.set("auth_token", accessJwt, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 86400, secure: process.env.NODE_ENV === "production" });
    response.cookies.set("refresh_token", refreshJwt, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 30 * 86400, secure: process.env.NODE_ENV === "production" });
    return response;
  } catch (err) {
    console.error("[oauth/github]", err);
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "服务器错误" } }, { status: 500 });
  }
}
