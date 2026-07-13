#!/usr/bin/env node
// 一次性种子：向 admin_permission 表写入权限目录（与代码中的权限码保持一致）
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
const sql = fs.readFileSync(path.join(root, "scripts/012_seed_admin_permissions.sql"), "utf8");
try {
  await client.execute(sql);
  console.log("✅ admin_permission 目录已就绪");
} catch (e) {
  console.error("❌ 种子失败:", e.message);
  process.exit(1);
}
await client.close();
