// ─── GET|POST|DELETE /api/quotations/categories ──
// 金句自定义分类（按账号隔离）。表懒建（CREATE IF NOT EXISTS）。
// GET:    返回当前账号分类清单（含每类金句数量）。
// POST:   新建分类 { name, color? }（重名忽略）。
// DELETE: 删除分类 ?id= 或 ?name=（同时把该分类下金句的 category 清空，不删金句）。

import { NextRequest, NextResponse } from "next/server";
import { client } from "@/server/db";
import { getServerUser } from "@/server/auth/guard";
import { nanoid } from "nanoid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
}

function parseCategories(raw: string | null | undefined): string[] {
  const v = String(raw || "").trim();
  if (!v) return [];
  if (v.startsWith("[")) {
    try { return JSON.parse(v); } catch { return v ? [v] : []; }
  }
  return [v];
}

async function ensureTable() {
  await client.execute({
    sql: `CREATE TABLE IF NOT EXISTS quote_categories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    )`,
    args: [],
  });
}

export async function GET() {
  const user = await getServerUser();
  if (!user) return unauthorized();
  try {
    await ensureTable();
    const res = await client.execute({
      sql: `SELECT id, name, color, created_at FROM quote_categories WHERE user_id = ? ORDER BY created_at ASC`,
      args: [user.id],
    });
    const rows = (res.rows as any[]) || [];
    // 读取所有金句，按分类数组计数（一条金句可属多个分类）
    const qRes = await client.execute({
      sql: `SELECT category FROM quotations WHERE user_id = ?`,
      args: [user.id],
    });
    const catCounts: Record<string, number> = {};
    for (const r of (qRes.rows as any[]) || []) {
      const cats = parseCategories(String(r.category || ""));
      for (const c of cats) catCounts[c] = (catCounts[c] || 0) + 1;
    }
    const data = rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      color: String(r.color || ""),
      count: catCounts[String(r.name)] || 0,
      createdAt: Number(r.created_at),
    }));
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("[quote-categories GET]", e);
    return NextResponse.json({ success: false, error: { message: "查询失败" } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return unauthorized();
  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const color = typeof body.color === "string" ? body.color.trim() : "";
  if (!name) return NextResponse.json({ success: false, error: { message: "分类名不能为空" } }, { status: 400 });
  if (name.length > 20) return NextResponse.json({ success: false, error: { message: "分类名过长" } }, { status: 400 });
  try {
    await ensureTable();
    // 重名忽略
    const exist = await client.execute({
      sql: `SELECT id FROM quote_categories WHERE user_id = ? AND name = ? LIMIT 1`,
      args: [user.id, name],
    });
    if (((exist.rows as any[]) || []).length > 0) {
      return NextResponse.json({ success: true, data: { id: String((exist.rows as any[])[0].id), name, color }, existed: true });
    }
    const id = `qc${nanoid(10)}`;
    const now = Math.floor(Date.now() / 1000);
    await client.execute({
      sql: `INSERT INTO quote_categories (id, user_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)`,
      args: [id, user.id, name, color, now],
    });
    return NextResponse.json({ success: true, data: { id, name, color, count: 0, createdAt: now } });
  } catch (e) {
    console.error("[quote-categories POST]", e);
    return NextResponse.json({ success: false, error: { message: "创建失败" } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return unauthorized();
  const id = req.nextUrl.searchParams.get("id");
  const name = req.nextUrl.searchParams.get("name");
  if (!id && !name) return NextResponse.json({ success: false, error: { message: "缺少 id 或 name" } }, { status: 400 });
  try {
    await ensureTable();
    let catName = name || "";
    if (id) {
      const r = await client.execute({ sql: `SELECT name FROM quote_categories WHERE id = ? AND user_id = ?`, args: [id, user.id] });
      const rows = (r.rows as any[]) || [];
      if (rows.length > 0) catName = String(rows[0].name);
      await client.execute({ sql: `DELETE FROM quote_categories WHERE id = ? AND user_id = ?`, args: [id, user.id] });
    } else if (name) {
      await client.execute({ sql: `DELETE FROM quote_categories WHERE name = ? AND user_id = ?`, args: [name, user.id] });
    }
    // 把该分类从所有金句的 category 数组中移除（不删金句）
    if (catName) {
      const qRes = await client.execute({
        sql: `SELECT id, category FROM quotations WHERE user_id = ?`,
        args: [user.id],
      });
      const now = Math.floor(Date.now() / 1000);
      for (const r of (qRes.rows as any[]) || []) {
        const cats = parseCategories(String(r.category || ""));
        if (cats.includes(catName)) {
          const newCats = cats.filter((c) => c !== catName);
          await client.execute({
            sql: `UPDATE quotations SET category = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
            args: [newCats.length ? JSON.stringify(newCats) : "", now, String(r.id), user.id],
          });
        }
      }
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[quote-categories DELETE]", e);
    return NextResponse.json({ success: false, error: { message: "删除失败" } }, { status: 500 });
  }
}
