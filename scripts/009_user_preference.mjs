#!/usr/bin/env node
// 一次性迁移：在数据库（生产 Turso）中创建 user_preference 表
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEnv(file) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
loadEnv(".env.production");

const url = process.env.DATABASE_URL;
const token = process.env.DATABASE_AUTH_TOKEN;
if (!url) { console.error("缺少 DATABASE_URL"); process.exit(1); }

const client = createClient({ url, authToken: token });
const sql = fs.readFileSync(path.join(root, "scripts/009_user_preference.sql"), "utf8");
try {
  await client.execute(sql);
  console.log("✅ user_preference 表已就绪（CREATE IF NOT EXISTS 已执行）");
} catch (e) {
  console.error("❌ 建表失败:", e.message);
  process.exit(1);
}
await client.close();
