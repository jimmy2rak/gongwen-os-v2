#!/usr/bin/env node
// 一次性迁移：修复 reviews 表（去掉 reviewer_id→users 外键 + 对齐最新 schema）
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
const sql = fs.readFileSync(path.join(root, "scripts/015_fix_reviews.sql"), "utf8");
const statements = sql.split(";").map((s) => s.trim()).filter((s) => s.length > 0);

try {
  for (const stmt of statements) {
    await client.execute(stmt);
  }
  // 校验新结构
  const info = await client.execute("PRAGMA table_info(reviews)");
  console.log(`✅ reviews 表已修复，当前列: ${info.rows.map((r) => r.name).join(", ")}`);
} catch (e) {
  console.error("❌ 迁移失败:", e.message);
  process.exit(1);
}
await client.close();
