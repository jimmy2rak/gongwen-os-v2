#!/usr/bin/env node
// 重新排序 INSERT 语句 + 发送到 Turso（外键关闭模式）
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

const dbUrl = process.env.DATABASE_URL;
const dbToken = process.env.DATABASE_AUTH_TOKEN;
if (!dbUrl) { console.error("❌ 设置 DATABASE_URL"); process.exit(1); }

// 正确的依赖顺序（父表在前）
const TABLE_ORDER = [
  "users",
  "verification_tokens",
  "sessions",
  "api_keys",
  "documents",
  "versions",
  "skills",
  "templates",
  "reviews",
  "hotspots",
  "hotspot_sources",
  "sys_super_admin",
  "sys_secret_config",
  "crawler_source",
  "hot_article",
];

const raw = readFileSync("/tmp/all_inserts.sql", "utf8");
const lines = raw.split("\n").filter((l) => l.trim());

// 按表分组
const byTable = {};
for (const line of lines) {
  const m = line.match(/^INSERT\s+INTO\s+(\w+)/i);
  if (!m) continue;
  const tbl = m[1];
  if (!byTable[tbl]) byTable[tbl] = [];
  byTable[tbl].push(line);
}

// 排序输出
const ordered = [];
for (const tbl of TABLE_ORDER) {
  if (byTable[tbl]) ordered.push(...byTable[tbl]);
}
// 处理不在顺序中的表
for (const tbl of Object.keys(byTable)) {
  if (!TABLE_ORDER.includes(tbl)) ordered.push(...byTable[tbl]);
}

console.log(`📋 共 ${ordered.length} 条 INSERT（${Object.keys(byTable).length} 张表）`);

const turso = createClient({ url: dbUrl, authToken: dbToken });

// 关闭外键
await turso.execute("PRAGMA foreign_keys = OFF");

// 清空已有数据
for (const tbl of TABLE_ORDER) {
  try { await turso.execute(`DELETE FROM "${tbl}"`); } catch {}
}

// 逐条插入
let ok = 0, fail = 0;
for (const sql of ordered) {
  try {
    await turso.execute(sql);
    ok++;
  } catch (e) {
    // 重试一次（PRAGMA 可能边界未吞）
    try { await turso.execute(sql); ok++; } catch (e2) {
      fail++;
      if (fail <= 3) console.error(`  ✗ ${e2.message.slice(0, 100)}`);
    }
  }
}
console.log(`\n✅ ${ok} 条成功  ❌ ${fail} 条失败`);
process.exit(fail > 0 ? 1 : 0);
