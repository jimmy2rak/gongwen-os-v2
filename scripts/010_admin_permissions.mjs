// scripts/010_admin_permissions.mjs
// 生产 Turso 数据库迁移：用户角色与管理员权限体系

import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "010_admin_permissions.sql"), "utf-8");

const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("缺少 DATABASE_URL 或 DATABASE_AUTH_TOKEN");
  process.exit(1);
}

const client = createClient({ url, authToken });

const statements = sql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

for (const stmt of statements) {
  try {
    await client.execute(stmt);
    console.log("OK:", stmt.split("\n")[0].trim());
  } catch (e) {
    // 列已存在等可忽略
    if (/duplicate column|already exists/.test(e.message)) {
      console.log("SKIP:", stmt.split("\n")[0].trim());
    } else {
      console.error("ERR:", e.message, "\nSQL:", stmt);
      process.exit(1);
    }
  }
}

console.log("Migration 010 done.");
