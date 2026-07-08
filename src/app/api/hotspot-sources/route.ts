// ─── GET|POST|PUT|DELETE /api/hotspot-sources — 数据源管理 ──

import { NextRequest, NextResponse } from "next/server";
import { db, client } from "@/server/db";
import { hotspotSources } from "@/server/db/schema";
import { getServerUser } from "@/server/auth/guard";
import { eq, asc } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });

  try {
    const rows = await db
      .select()
      .from(hotspotSources)
      .orderBy(asc(hotspotSources.sortOrder));
    return NextResponse.json({ success: true, data: rows });
  } catch (e) {
    console.error("[hotspot-sources GET] Error:", e);
    return NextResponse.json({ success: false, error: { message: "查询失败" } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });

  try {
    const body = await req.json();
    const { name, url, category, selectorTitle, selectorSummary, selectorLink, selectorContent } = body;
    if (!name || !name.trim() || !url || !url.trim()) {
      return NextResponse.json({ success: false, error: { message: "名称和 URL 不能为空" } }, { status: 400 });
    }

    const id = `src${nanoid(16)}`;
    const now = Math.floor(Date.now() / 1000);
    // 获取最大 sortOrder
    const maxOrder = await client.execute("SELECT MAX(sort_order) as m FROM hotspot_sources");
    const sortOrder = (Number((maxOrder.rows?.[0] as any)?.m) || 0) + 1;

    await client.execute({
      sql: `INSERT INTO hotspot_sources (id, name, url, category, selector_title, selector_summary, selector_link, selector_content, is_builtin, sort_order, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      args: [id, name.trim(), url.trim(), category || "综合", selectorTitle || null, selectorSummary || null, selectorLink || null, selectorContent || null, sortOrder, now],
    });

    return NextResponse.json({ success: true, data: { id, name: name.trim() } });
  } catch (e) {
    console.error("[hotspot-sources POST] Error:", e);
    return NextResponse.json({ success: false, error: { message: "创建失败" } }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });

  try {
    const body = await req.json();
    const { id, name, url, category, selectorTitle, selectorSummary, selectorLink, selectorContent } = body;
    if (!id) return NextResponse.json({ success: false, error: { message: "缺少 ID" } }, { status: 400 });

    // 内置源只允许改选择器，不允许改名/改URL
    const existing = await db.select().from(hotspotSources).where(eq(hotspotSources.id, id)).limit(1);
    if (existing.length === 0) return NextResponse.json({ success: false, error: { message: "不存在" } }, { status: 404 });

    const isBuiltin = existing[0].isBuiltin;
    const sets: string[] = [];
    const vals: any[] = [];

    if (!isBuiltin && typeof name === "string" && name.trim()) { sets.push("name = ?"); vals.push(name.trim()); }
    if (!isBuiltin && typeof url === "string" && url.trim()) { sets.push("url = ?"); vals.push(url.trim()); }
    if (typeof category === "string") { sets.push("category = ?"); vals.push(category); }
    if (typeof selectorTitle === "string") { sets.push("selector_title = ?"); vals.push(selectorTitle); }
    if (typeof selectorSummary === "string") { sets.push("selector_summary = ?"); vals.push(selectorSummary); }
    if (typeof selectorLink === "string") { sets.push("selector_link = ?"); vals.push(selectorLink); }
    if (typeof selectorContent === "string") { sets.push("selector_content = ?"); vals.push(selectorContent); }
    if (sets.length === 0) return NextResponse.json({ success: false, error: { message: "无更新字段" } }, { status: 400 });

    vals.push(id);
    await client.execute({ sql: `UPDATE hotspot_sources SET ${sets.join(", ")} WHERE id = ?`, args: vals });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[hotspot-sources PUT] Error:", e);
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

    // 内置源不允许删除
    const existing = await db.select().from(hotspotSources).where(eq(hotspotSources.id, id)).limit(1);
    if (existing.length === 0) return NextResponse.json({ success: false, error: { message: "不存在" } }, { status: 404 });
    if (existing[0].isBuiltin) return NextResponse.json({ success: false, error: { message: "内置源不允许删除" } }, { status: 403 });

    await client.execute({ sql: "DELETE FROM hotspot_sources WHERE id = ?", args: [id] });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[hotspot-sources DELETE] Error:", e);
    return NextResponse.json({ success: false, error: { message: "删除失败" } }, { status: 500 });
  }
}
