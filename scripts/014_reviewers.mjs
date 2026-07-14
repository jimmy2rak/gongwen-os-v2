#!/usr/bin/env node
// 一次性迁移：在数据库（生产 Turso）中创建 reviewers 表并写入默认审阅人
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

const defaults = [
  { id: "r1", name: "张主任", department: "办公室", sort: 1 },
  { id: "r2", name: "李副主任", department: "办公室", sort: 2 },
  { id: "r3", name: "王科长", department: "综合科", sort: 3 },
  { id: "r4", name: "赵副科长", department: "综合科", sort: 4 },
];

try {
  await client.execute(
    `CREATE TABLE IF NOT EXISTS reviewers (
       id         TEXT PRIMARY KEY,
       name       TEXT NOT NULL,
       department TEXT NOT NULL DEFAULT '',
       sort_order INTEGER NOT NULL DEFAULT 0,
       created_at INTEGER NOT NULL
     )`
  );
  const cnt = await client.execute(`SELECT COUNT(*) AS c FROM reviewers`);
  const count = Number(cnt.rows?.[0]?.c ?? 0);
  if (count === 0) {
    const now = Math.floor(Date.now() / 1000);
    for (const r of defaults) {
      await client.execute({
        sql: `INSERT INTO reviewers (id, name, department, sort_order, created_at) VALUES (?, ?, ?, ?, ?)`,
        args: [r.id, r.name, r.department, r.sort, now],
      });
    }
    console.log("✅ reviewers 表已创建并写入 4 条默认审阅人");
  } else {
    console.log(`✅ reviewers 表已就绪（现有 ${count} 条，跳过默认种子）`);
  }
} catch (e) {
  console.error("❌ 建表失败:", e.message);
  process.exit(1);
}
await client.close();
