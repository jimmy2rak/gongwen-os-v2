#!/usr/bin/env node
// ─── 爬虫系统引导脚本（仅项目负责人/部署者运行）────────
// 作用：
//   1) 生成或读取 CRAWLER_API_KEY（爬虫入库密钥，明文只在本地终端出现一次）
//   2) 用 AES-256-GCM 加密后写入 sys_secret_config（key_name='crawler_upload'）
//   3) 可选：把 SUPER_ADMIN_USER_ID 写入 sys_super_admin 白名单
//
// 用法：
//   CRAWLER_API_KEY="你的强随机串" SUPER_ADMIN_USER_ID="uXXX" \
//     node scripts/seed-crawler-secret.mjs
// 不传 CRAWLER_API_KEY 时会自动生成一个 32 字节随机串并打印出来（请妥善保存）。
//
// 注意：本脚本不依赖任何前端，属于服务端初始化动作。

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// ── 极简 .env 读取（避免引入额外依赖）──
function loadEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
loadEnv();

// ── 主密钥（与 src/server/auth/secret.ts 完全一致）──
function getMasterKey() {
  const raw = process.env.CRAWLER_MASTER_KEY || process.env.JWT_SECRET;
  if (!raw) throw new Error("缺少 CRAWLER_MASTER_KEY / JWT_SECRET");
  return crypto.createHash("sha256").update(raw).digest();
}
function encryptSecret(plain) {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

const dbUrl = process.env.DATABASE_URL || "file:./data.db";
const client = createClient({ url: dbUrl });

async function main() {
  const plainKey = process.env.CRAWLER_API_KEY || crypto.randomBytes(32).toString("hex");
  const cipher = encryptSecret(plainKey);
  const now = Math.floor(Date.now() / 1000);

  await client.execute({
    sql: `INSERT INTO sys_secret_config (key_name, encrypted_value, algorithm, create_time, update_time)
          VALUES ('crawler_upload', ?, 'aes-256-gcm', ?, ?)
          ON CONFLICT(key_name) DO UPDATE SET encrypted_value = excluded.encrypted_value, update_time = excluded.update_time`,
    args: [cipher, now, now],
  });
  console.log("✅ 爬虫入库密钥已加密写入 sys_secret_config（key_name=crawler_upload）");
  if (!process.env.CRAWLER_API_KEY) {
    console.log("ℹ️  本次自动生成的明文密钥（请妥善保存，仅此一次展示）：");
    console.log("   " + plainKey);
  }

  const adminId = process.env.SUPER_ADMIN_USER_ID;
  if (adminId) {
    await client.execute({
      sql: `INSERT INTO sys_super_admin (user_id, create_time, remark)
            VALUES (?, ?, 'seed 脚本初始化') ON CONFLICT(user_id) DO NOTHING`,
      args: [adminId, now],
    });
    console.log(`✅ 已写入超级管理员白名单：user_id=${adminId}`);
  } else {
    console.log("ℹ️  未设置 SUPER_ADMIN_USER_ID，跳过白名单写入（请手动执行 SQL 插入）。");
  }

  await client.close();
}

main().catch((e) => {
  console.error("❌ 初始化失败：", e.message);
  process.exit(1);
});
