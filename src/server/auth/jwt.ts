// ─── JWT 签发和验证 ──────────────────────────────
// 使用 jose 库（老系统已验证稳定）
// 签发 JWT 放在 HTTP-only Cookie 中，前端 JS 无法读取

import { SignJWT, jwtVerify } from "jose";
import { nanoid } from "nanoid";

/** 获取 JWT 密钥（从环境变量读取） */
function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET 环境变量未配置！请在 .env 文件中设置");
  }
  return new TextEncoder().encode(secret);
}

/** JWT 载荷中包含的用户信息 */
export interface JWTPayload {
  sub: string;       // 用户 ID
  email: string;
  name?: string | null;
  jti?: string;      // JWT ID，用于登出时作废
}

/**
 * 签发 JWT token
 * @param payload 用户信息
 * @param expiresIn 过期时间，例如 "7d" / "24h" / "1h"
 * @returns JWT 字符串
 */
export async function createToken(
  payload: JWTPayload,
  expiresIn: string = "7d"
): Promise<string> {
  const jti = nanoid(16);
  return new SignJWT({ ...payload, jti, type: expiresIn === "30d" ? "refresh" : "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .setJti(jti)
    .sign(getJWTSecret());
}

/** 签发短期 AccessToken（1小时有效） */
export function createAccessToken(payload: JWTPayload): Promise<string> {
  return createToken(payload, "1h");
}

/** 签发长期 RefreshToken（30天有效） */
export function createRefreshToken(payload: JWTPayload): Promise<string> {
  return createToken(payload, "30d");
}

/**
 * 验证 JWT token，返回载荷信息
 * 如果 token 过期或无效，返回 null
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJWTSecret());
    return payload as unknown as JWTPayload;
  } catch {
    // token 过期、签名错误等均返回 null
    return null;
  }
}
