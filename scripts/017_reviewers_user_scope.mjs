#!/usr/bin/env node
// 一次性迁移：reviewers 表按账号隔离
// 1) 增加 user_id 列（若已存在则跳过）
// 2) 读取现有「全局」审阅人（user_id IS NULL）
// 3) 对每一个「现有账号」：
//      - 若该账号已有 user_id 记录则跳过（幂等）
//      - 否则把全局审阅人克隆为该账号私有（保持不变）
//      - 若没有任何全局审阅人，则播种 4 个默认审阅人（与迁移前默认视图一致）
// 4) 删除遗留的全局（user_id IS NULL）记录
// 5) 此后「新注册账号」在首次读取 /api/reviewers 时仅播种单条「办公室-张三」（由路由处理）

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
// 优先生产库，其次本地库
loadEnv(".env.production");
if (!process.env.DATABASE_URL) loadEnv(".env");

const url = process.env.DATABASE_URL;
const token = process.env.DATABASE_AUTH_TOKEN;
if (!url) { console.error("缺少 DATABASE_URL"); process.exit(1); }

const client = createClient({ url, authToken: token });

// 默认审阅人（与 014 迁移初始值一致，保证未自定义过的账号视图不变）
const DEFAULT_REVIEWERS = [
  { name: "张主任", department: "办公室" },
  { name: "李副主任", department: "办公室" },
  { name: "王科长", department: "综合科" },
  { name: "赵副科长", department: "综合科" },
];

try {
  // 1) 增加列（幂等）
  const info = await client.execute("PRAGMA table_info(reviewers)");
  const cols = info.rows.map((r) => r.name);
  if (!cols.includes("user_id")) {
    await client.execute("ALTER TABLE reviewers ADD COLUMN user_id TEXT");
    await client.execute("CREATE INDEX IF NOT EXISTS idx_reviewers_user ON reviewers(user_id)");
    console.log("✅ 已添加 user_id 列 + 索引");
  } else {
    console.log("ℹ️ user_id 列已存在，跳过 ALTER");
  }

  // 2) 现有全局审阅人
  const legacyRes = await client.execute("SELECT id, name, department, sort_order, created_at FROM reviewers WHERE user_id IS NULL");
  const legacy = legacyRes.rows.map((r) => ({
    id: String(r.id),
    name: String(r.name || ""),
    department: String(r.department || ""),
    sort_order: Number(r.sort_order || 0),
    created_at: Number(r.created_at || Math.floor(Date.now() / 1000)),
  }));
  console.log(`ℹ️ 现有全局审阅人 ${legacy.length} 条`);

  // 3) 现有账号
  const usersRes = await client.execute("SELECT id FROM users");
  const users = usersRes.rows.map((r) => String(r.id));
  console.log(`ℹ️ 现有账号 ${users.length} 个`);

  const now = Math.floor(Date.now() / 1000);
  let copied = 0;
  let defaulted = 0;
  for (const uid of users) {
    const exist = await client.execute({ sql: "SELECT COUNT(*) AS c FROM reviewers WHERE user_id = ?", args: [uid] });
    if (Number(exist.rows[0]?.c || 0) > 0) continue; // 已回填，跳过

    if (legacy.length > 0) {
      for (const lr of legacy) {
        const newId = `${lr.id}__${uid}`;
        await client.execute({
          sql: "INSERT INTO reviewers (id, name, department, sort_order, created_at, user_id) VALUES (?, ?, ?, ?, ?, ?)",
          args: [newId, lr.name, lr.department, lr.sort_order, lr.created_at, uid],
        });
        copied++;
      }
    } else {
      for (let i = 0; i < DEFAULT_REVIEWERS.length; i++) {
        const d = DEFAULT_REVIEWERS[i];
        const newId = `r${i + 1}__${uid}`;
        await client.execute({
          sql: "INSERT INTO reviewers (id, name, department, sort_order, created_at, user_id) VALUES (?, ?, ?, ?, ?, ?)",
          args: [newId, d.name, d.department, i + 1, now, uid],
        });
        defaulted++;
      }
    }
  }
  console.log(`✅ 克隆全局审阅人 ${copied} 条；播种默认审阅人 ${defaulted} 条`);

  // 4) 清理遗留全局记录
  const del = await client.execute("DELETE FROM reviewers WHERE user_id IS NULL");
  console.log(`✅ 已清理遗留全局记录 ${del.rowsAffected ?? 0} 条`);

  console.log("🎉 reviewers 账号隔离迁移完成");
} catch (e) {
  console.error("❌ 迁移失败:", e.message);
  process.exit(1);
}
await client.close();
