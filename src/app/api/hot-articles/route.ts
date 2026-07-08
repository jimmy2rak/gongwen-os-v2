// ─── GET /api/hot-articles ───────────────────────
// 公文前端展示页拉取 hot_article 数据（任何已登录用户可见）。
// 支持过滤：columnId（栏目）、sourceId、crawlDate(YYYYMMDD)、q（标题模糊）。
// 默认只返回 is_published=1 的文章；超管可加 ?all=1 查看全部。

import { NextRequest, NextResponse } from "next/server";
import { client } from "@/server/db";
import { getServerUser } from "@/server/auth/guard";
import { isSuperAdmin } from "@/server/auth/super-admin";

export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const columnId = searchParams.get("columnId");
  const sourceId = searchParams.get("sourceId");
  const crawlDate = searchParams.get("crawlDate");
  const q = searchParams.get("q");
  const all = searchParams.get("all") === "1";

  try {
    const isAdmin = await isSuperAdmin(user.id);
    const where: string[] = [];
    const args: any[] = [];
    if (!all && !isAdmin) where.push("is_published = 1"); // 普通用户只看已发布
    if (columnId) { where.push("column_id = ?"); args.push(columnId); }
    if (sourceId) { where.push("source_id = ?"); args.push(sourceId); }
    if (crawlDate) { where.push("crawl_date = ?"); args.push(crawlDate); }
    if (q) { where.push("title LIKE ?"); args.push(`%${q}%`); }

    const sql =
      "SELECT * FROM hot_article" +
      (where.length ? " WHERE " + where.join(" AND ") : "") +
      " ORDER BY created_at DESC LIMIT 200";

    const rows = await client.execute({ sql, args });
    return NextResponse.json({ success: true, data: rows.rows });
  } catch (e) {
    console.error("[hot-articles GET] Error:", e);
    return NextResponse.json({ success: false, error: { message: "查询失败" } }, { status: 500 });
  }
}
