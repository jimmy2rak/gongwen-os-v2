#!/usr/bin/env node
// 一次性迁移：为 users 表增加 phone 列
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
const sql = fs.readFileSync(path.join(root, "scripts/016_add_user_phone.sql"), "utf8");
const statements = sql.split(";").map((s) => s.trim()).filter((s) => s.length > 0);

try {
  for (const stmt of statements) {
    await client.execute(stmt);
  }
  const info = await client.execute("PRAGMA table_info(users)");
  const cols = info.rows.map((r) => r.name);
  if (!cols.includes("phone")) throw new Error("phone 列未添加成功");
  console.log(`✅ users 表已新增 phone 列，当前列: ${cols.join(", ")}`);
} catch (e) {
  console.error("❌ 迁移失败:", e.message);
  process.exit(1);
}
await client.close();
