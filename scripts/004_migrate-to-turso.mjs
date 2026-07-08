#!/usr/bin/env node
// ─── 本地 SQLite → Turso 迁移脚本 ─────────────────
// 1) 把本地 data.db 所有表的 DDL + 数据 INSERT 导出为临时 SQL
// 2) 逐条在 Turso 上执行
//
// 用法：
//   DATABASE_URL="libsql://gongwen-os-v2-xxxx.turso.io" \
//   DATABASE_AUTH_TOKEN="your-token" \
//   node scripts/004_migrate-to-turso.mjs

import { createClient } from "@libsql/client";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const dbUrl = process.env.DATABASE_URL;
const dbToken = process.env.DATABASE_AUTH_TOKEN;
if (!dbUrl) { console.error("❌ 请设置 DATABASE_URL"); process.exit(1); }

const localDb = "./data.db";
if (!existsSync(localDb)) {
  console.error(`❌ 未找到本地数据库文件：${localDb}`);
  process.exit(1);
}

// ── 1. 用 sqlite3 命令行导出 Schema ──
console.log("📋 正在从本地 data.db 导出 Schema...");
const schemaSql = execSync(`sqlite3 "${localDb}" ".schema"`, { encoding: "utf8" });

// ── 2. 导出数据 INSERT ──
console.log("📋 正在导出数据...");
const dataSql = execSync(`sqlite3 "${localDb}" ".dump"`, { encoding: "utf8" });

// ── 3. 连接 Turso ──
const turso = createClient({ url: dbUrl, authToken: dbToken });

// ── 4. 建表（逐条执行 CREATE 语句） ──
console.log("\n📦 在 Turso 上建表...");
const createStmts = schemaSql
  .split(";")
  .map((s) => s.trim())
  .filter(
    (s) =>
      s.toUpperCase().startsWith("CREATE") &&
      !s.includes("__drizzle") &&
      !s.includes("sqlite_sequence")
  );

let created = 0;
for (const stmt of createStmts) {
  try {
    await turso.execute(stmt + ";");
    const name = stmt.match(/CREATE\s+(TABLE|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?/i)?.[2] || "?";
    console.log(`  ✅ ${name}`);
    created++;
  } catch (e) {
    if (e.message?.includes("already exists")) {
      console.log(`  ➡️  （已存在，跳过）`);
    } else {
      console.error(`  ❌ ${e.message.slice(0, 120)}`);
    }
  }
}
console.log(`  共 ${created} 条 DDL 执行完成`);

// ── 5. 插入数据（提取 .dump 中的 INSERT INTO 语句） ──
console.log("\n📄 迁移数据...");
const insertStmts = dataSql
  .split("\n")
  .filter((line) => line.trim().toUpperCase().startsWith("INSERT INTO"))
  .filter(
    (line) =>
      !line.includes("__drizzle") && !line.includes("sqlite_sequence")
  );

let inserted = 0;
let total = insertStmts.length;
for (const stmt of insertStmts) {
  try {
    await turso.execute(stmt);
    inserted++;
  } catch (e) {
    // INSERT OR IGNORE 处理重复；其他错误打印
    if (!e.message?.includes("UNIQUE constraint")) {
      console.error(`  ✗ ${stmt.slice(0, 80)}... ${e.message.slice(0, 80)}`);
    }
  }
}
console.log(`  共 ${inserted}/${total} 条 INSERT 写入成功`);

console.log(`\n🎉 迁移完成！`);
process.exit(0);
