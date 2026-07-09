// ─── POST /api/auth/oauth/google ─────────────────
// Google OAuth 回调：用 code 换 id_token → 验证 → 查找/创建用户 → 签发 JWT

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { users, oauthAccounts } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createAccessToken, createRefreshToken } from "@/server/auth/jwt";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USER_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ success: false, error: { code: "MISSING_CODE", message: "缺少授权码" } }, { status: 400 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.json({ success: false, error: { code: "NOT_CONFIGURED", message: "Google OAuth 未配置" } }, { status: 500 });
    }

    const redirectUri = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/auth/callback/google`;

    // 1. 用 code 换 access_token
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return NextResponse.json({ success: false, error: { code: "OAUTH_ERROR", message: "Google 授权失败" } }, { status: 401 });
    }

    // 2. 获取用户信息
    const userRes = await fetch(GOOGLE_USER_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
    const googleUser = await userRes.json();
    if (!googleUser.sub) {
      return NextResponse.json({ success: false, error: { code: "USER_FETCH_FAILED", message: "获取用户信息失败" } }, { status: 401 });
    }

    const providerAccountId = googleUser.sub;
    const email = googleUser.email;
    const name = googleUser.name || googleUser.given_name || "Google 用户";
    const avatar = googleUser.picture;

    // 3. 查找是否已有该 Google 账号关联
    const existingOAuth = await db
      .select()
      .from(oauthAccounts)
      .where(and(eq(oauthAccounts.provider, "google"), eq(oauthAccounts.providerAccountId, providerAccountId)))
      .limit(1);

    let userId: string;

    if (existingOAuth.length > 0) {
      userId = existingOAuth[0].userId;
    } else if (email) {
      const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingUser.length > 0) {
        userId = existingUser[0].id;
        await db.insert(oauthAccounts).values({
          id: `oa_${nanoid(16)}`,
          userId,
          provider: "google",
          providerAccountId,
          accessToken,
          createdAt: new Date(),
        });
      } else {
        userId = `u_${nanoid(16)}`;
        await db.insert(users).values({
          id: userId,
          email: email || `google_${providerAccountId}@placeholder.local`,
          name,
          avatar: avatar || null,
          emailVerified: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        await db.insert(oauthAccounts).values({
          id: `oa_${nanoid(16)}`,
          userId,
          provider: "google",
          providerAccountId,
          accessToken,
          createdAt: new Date(),
        });
      }
    } else {
      userId = `u_${nanoid(16)}`;
      const placeholderEmail = `google_${providerAccountId}@placeholder.local`;
      await db.insert(users).values({
        id: userId,
        email: placeholderEmail,
        name,
        avatar: avatar || null,
        emailVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await db.insert(oauthAccounts).values({
        id: `oa_${nanoid(16)}`,
        userId,
        provider: "google",
        providerAccountId,
        accessToken,
        createdAt: new Date(),
      });
    }

    // 4. 签发 JWT
    const dbUser = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
    const payload = { sub: userId, email: dbUser.email, name: dbUser.name };
    const accessJwt = await createAccessToken(payload);
    const refreshJwt = await createRefreshToken(payload);

    const response = NextResponse.json({ success: true, data: { id: userId, email: dbUser.email, name: dbUser.name, avatar: dbUser.avatar } });
    response.cookies.set("auth_token", accessJwt, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 86400, secure: process.env.NODE_ENV === "production" });
    response.cookies.set("refresh_token", refreshJwt, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 30 * 86400, secure: process.env.NODE_ENV === "production" });
    return response;
  } catch (err) {
    console.error("[oauth/google]", err);
    return NextResponse.json({ success: false, error: { code: "INTERNAL", message: "服务器错误" } }, { status: 500 });
  }
}
