// ─── GET|POST /api/hotspots — 热点资讯 ──────────
// GET: 列表查询（支持 source/category 过滤）
// POST: 爬虫写入新热点

import { NextRequest, NextResponse } from "next/server";
import { db, client } from "@/server/db";
import { hotspots } from "@/server/db/schema";
import { getServerUser } from "@/server/auth/guard";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });

  const url = new URL(req.url);
  const source = url.searchParams.get("source");
  const category = url.searchParams.get("category");
  const starred = url.searchParams.get("starred");

  const conditions = [];
  if (source) conditions.push(eq(hotspots.source, source));
  if (category) conditions.push(eq(hotspots.category, category));
  if (starred === "true") conditions.push(eq(hotspots.starred, true));

  try {
    const rows = await db
      .select()
      .from(hotspots)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(hotspots.createdAt))
      .limit(100);

    return NextResponse.json({ success: true, data: rows });
  } catch (e) {
    console.error("[hotspots GET] Error:", e);
    return NextResponse.json({ success: false, error: { message: "查询失败" } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });

  try {
    const body = await req.json();
    const { title, summary, source, sourceId, category, url, htmlContent, heat } = body;
    if (!title || !title.trim()) {
      return NextResponse.json({ success: false, error: { message: "标题不能为空" } }, { status: 400 });
    }

    const id = `hot${nanoid(16)}`;
    const now = Math.floor(Date.now() / 1000);

    await client.execute({
      sql: `INSERT INTO hotspots (id, title, summary, source, source_id, category, url, html_content, heat, starred, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      args: [id, title.trim(), (summary || "").trim(), source || "未知", sourceId || null, category || "综合", url || null, htmlContent || null, heat || 0, now],
    });

    return NextResponse.json({ success: true, data: { id, title: title.trim() } });
  } catch (e) {
    console.error("[hotspots POST] Error:", e);
    return NextResponse.json({ success: false, error: { message: "创建失败" } }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });

  try {
    const body = await req.json();
    const { id, starred, starCategory } = body;
    if (!id) return NextResponse.json({ success: false, error: { message: "缺少 ID" } }, { status: 400 });

    const sets: string[] = [];
    const vals: any[] = [];
    if (starred !== undefined) { sets.push("starred = ?"); vals.push(starred ? 1 : 0); }
    if (starCategory !== undefined) { sets.push("star_category = ?"); vals.push(starCategory); }
    if (sets.length === 0) return NextResponse.json({ success: false, error: { message: "无更新字段" } }, { status: 400 });

    vals.push(id);
    await client.execute({ sql: `UPDATE hotspots SET ${sets.join(", ")} WHERE id = ?`, args: vals });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[hotspots PUT] Error:", e);
    return NextResponse.json({ success: false, error: { message: "更新失败" } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });

  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ success: false, error: { message: "缺少 ID" } }, { status: 400 });

    await client.execute({ sql: "DELETE FROM hotspots WHERE id = ?", args: [id] });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[hotspots DELETE] Error:", e);
    return NextResponse.json({ success: false, error: { message: "删除失败" } }, { status: 500 });
  }
}
