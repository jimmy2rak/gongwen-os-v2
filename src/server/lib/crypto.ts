// ─── API Key 加解密（AES-256-GCM）─────────────────
// 明文 API Key 入库前加密，绝不落库明文；读取时仅回显掩码。
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // GCM 推荐 12 字节 IV
const TAG_LEN = 16; // GCM authTag 长度

// 主密钥取自环境变量，任意长度派生为固定 32 字节（sha256）
function deriveKey(): Buffer {
  const secret = process.env.AI_KEY_SECRET;
  if (!secret) throw new Error("AI_KEY_SECRET 未配置");
  return createHash("sha256").update(secret).digest();
}

export interface EncryptedPayload {
  encrypted: string; // base64(密文 + authTag)
  iv: string; // base64(IV)
}

/** 加密明文 API Key，返回密文与 IV（均 base64） */
export function encryptApiKey(plain: string): EncryptedPayload {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encrypted: Buffer.concat([enc, tag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

/** 解密（密文 + authTag 合并存储，按长度拆分） */
export function decryptApiKey(encryptedB64: string, ivB64: string): string {
  const iv = Buffer.from(ivB64, "base64");
  const data = Buffer.from(encryptedB64, "base64");
  const tag = data.subarray(data.length - TAG_LEN);
  const enc = data.subarray(0, data.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, deriveKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** 掩码：仅保留首尾，中间用 **** 替代（如 sk-ab****1234） */
export function maskApiKey(key: string): string {
  if (!key || key.length <= 8) return "****";
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}
