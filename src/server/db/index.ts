// ─── 数据库连接 ────────────────────────────────────
// 本地开发用 SQLite (better-sqlite3 兼容的 libsql)
// 生产部署到 Vercel 时用 Turso (libSQL)
// 切换方式：只需改 DATABASE_URL 环境变量

import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

// 读取数据库连接 URL（.env 文件中配置）
const url = process.env.DATABASE_URL || "file:./data.db";

// 创建 libSQL 客户端
// 本地：url="file:./data.db" → 用本地 SQLite 文件
// 生产：url="libsql://your-db.turso.io" → 连远程 Turso 数据库
const client = createClient({
  url,
  authToken: process.env.DATABASE_AUTH_TOKEN, // 生产环境才需要
});

// 导出 drizzle 实例，所有数据库操作都用这个
export const db = drizzle(client, { schema });

// 也导出原始 libSQL 客户端，某些操作（如插入）直接走原生 API 更可靠
export { client };
