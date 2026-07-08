// ─── 爬虫入库密钥（AES-256-GCM 加密存储）──────────
// 明文密钥绝不出现在任何前端页面；只有后端在「生成脚本」时解密并注入 Python。
// 加解密主密钥取自 CRAWLER_MASTER_KEY，缺省回退到 JWT_SECRET。

import crypto from "node:crypto";
import { client } from "@/server/db";

const ALGO = "aes-256-gcm";

/** 由环境变量派生 32 字节主密钥 */
function getMasterKey(): Buffer {
  const raw = process.env.CRAWLER_MASTER_KEY || process.env.JWT_SECRET;
  if (!raw) {
    throw new Error("缺少 CRAWLER_MASTER_KEY / JWT_SECRET 环境变量，无法加解密爬虫密钥");
  }
  return crypto.createHash("sha256").update(raw).digest();
}

/** 明文 → AES-256-GCM 密文（iv:tag:cipher 三段 hex） */
export function encryptSecret(plain: string): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

/** 密文 → 明文 */
export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("密文格式错误");
  const key = getMasterKey();
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return dec.toString("utf8");
}

/**
 * 读取当前有效的爬虫入库密钥（明文）。
 * 优先从 sys_secret_config（加密库）解密；缺失时回退环境变量 CRAWLER_API_KEY（仅引导用）。
 */
export async function getCrawlerUploadKey(): Promise<string | null> {
  try {
    const rows = await client.execute({
      sql: "SELECT encrypted_value FROM sys_secret_config WHERE key_name = 'crawler_upload' LIMIT 1",
      args: [],
    });
    const enc = rows.rows?.[0]?.encrypted_value as string | undefined;
    if (enc) return decryptSecret(enc);
  } catch {
    // 忽略，走兜底
  }
  return process.env.CRAWLER_API_KEY || null;
}
