// ─── GET|POST /api/quotations — 金句库（按账号隔离）──
// GET:  返回当前账号金句；可按 sourceType / sourceId 过滤（用于某篇文档内高亮）。
// POST: 新增金句（content 必填；sourceType/sourceId/sourceTitle/category 可选）。

import { NextRequest, NextResponse } from "next/server";
import { client } from "@/server/db";
import { getServerUser } from "@/server/auth/guard";
import { nanoid } from "nanoid";

function unauthorized() {
  return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return unauthorized();
  const sourceType = req.nextUrl.searchParams.get("sourceType");
  const sourceId = req.nextUrl.searchParams.get("sourceId");
  try {
    let sql = `SELECT id, content, source_type, source_id, source_title, category, created_at, updated_at FROM quotations WHERE user_id = ?`;
    const args: string[] = [user.id];
    if (sourceType) { sql += ` AND source_type = ?`; args.push(sourceType); }
    if (sourceId) { sql += ` AND source_id = ?`; args.push(sourceId); }
    sql += ` ORDER BY created_at DESC`;
    const res = await client.execute({ sql, args });
    const rows = (res.rows as any[]) || [];
    const data = rows.map((r) => ({
      id: String(r.id),
      content: String(r.content || ""),
      sourceType: String(r.source_type || "manual"),
      sourceId: String(r.source_id || ""),
      sourceTitle: String(r.source_title || ""),
      category: String(r.category || ""),
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
    }));
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("[quotations GET]", e);
    return NextResponse.json({ success: false, error: { message: "查询失败" } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return unauthorized();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: { message: "缺少 id" } }, { status: 400 });
  try {
    await client.execute({ sql: `DELETE FROM quotations WHERE id = ? AND user_id = ?`, args: [id, user.id] });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[quotations DELETE]", e);
    return NextResponse.json({ success: false, error: { message: "删除失败" } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return unauthorized();
  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ success: false, error: { message: "金句内容不能为空" } }, { status: 400 });
  const sourceType = typeof body.sourceType === "string" ? body.sourceType : "manual";
  const sourceId = typeof body.sourceId === "string" ? body.sourceId : "";
  const sourceTitle = typeof body.sourceTitle === "string" ? body.sourceTitle : "";
  const category = typeof body.category === "string" ? body.category : "";
  const now = Math.floor(Date.now() / 1000);
  const id = `q${nanoid(12)}`;
  try {
    await client.execute({
      sql: `INSERT INTO quotations (id, user_id, content, source_type, source_id, source_title, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, user.id, content, sourceType, sourceId, sourceTitle, category, now, now],
    });
    return NextResponse.json({
      success: true,
      data: { id, content, sourceType, sourceId, sourceTitle, category, createdAt: now, updatedAt: now },
    });
  } catch (e) {
    console.error("[quotations POST]", e);
    return NextResponse.json({ success: false, error: { message: "保存失败" } }, { status: 500 });
  }
}
