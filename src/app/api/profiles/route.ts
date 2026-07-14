// ─── GET|POST|PUT|DELETE /api/profiles — 用户画像（按账号隔离）──
// GET:   返回当前账号画像列表；若为空（新账号）自动播种一个默认画像模板。
// POST:  新增画像；PUT: 更新画像；DELETE: 删除画像。
// 保证同一账号仅一个默认画像（is_default）。

import { NextRequest, NextResponse } from "next/server";
import { client } from "@/server/db";
import { getServerUser } from "@/server/auth/guard";
import { nanoid } from "nanoid";

function unauthorized() {
  return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
}

// 新账号默认画像模板
function defaultTemplate() {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: `upr${nanoid(12)}`,
    userId: "",
    name: "默认单位",
    unit: "",
    level: "区级",
    type: "机关",
    isDefault: true,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function rowToProfile(r: any) {
  return {
    id: String(r.id),
    name: String(r.name || ""),
    unit: String(r.unit || ""),
    level: String(r.level || ""),
    type: String(r.type || ""),
    isDefault: Number(r.is_default || 0) === 1,
    sortOrder: Number(r.sort_order || 0),
  };
}

export async function GET() {
  const user = await getServerUser();
  if (!user) return unauthorized();
  try {
    const res = await client.execute({
      sql: `SELECT id, name, unit, level, type, is_default, sort_order FROM user_profiles WHERE user_id = ? ORDER BY sort_order ASC, id ASC`,
      args: [user.id],
    });
    let rows = (res.rows as any[]) || [];
    if (rows.length === 0) {
      const t = defaultTemplate();
      await client.execute({
        sql: `INSERT INTO user_profiles (id, user_id, name, unit, level, type, is_default, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [t.id, user.id, t.name, t.unit, t.level, t.type, 1, t.sortOrder, t.createdAt, t.updatedAt],
      });
      rows = [{ id: t.id, name: t.name, unit: t.unit, level: t.level, type: t.type, is_default: 1, sort_order: 0 }];
    }
    return NextResponse.json({ success: true, data: rows.map(rowToProfile) });
  } catch (e) {
    console.error("[profiles GET] 失败:", e);
    return NextResponse.json({ success: false, error: { message: "查询失败" } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return unauthorized();
  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ success: false, error: { message: "画像名称必填" } }, { status: 400 });
  const unit = typeof body.unit === "string" ? body.unit.trim() : "";
  const level = typeof body.level === "string" ? body.level.trim() : "";
  const type = typeof body.type === "string" ? body.type.trim() : "";
  const isDefault = body.isDefault === true;
  const now = Math.floor(Date.now() / 1000);
  try {
    if (isDefault) {
      await client.execute({ sql: `UPDATE user_profiles SET is_default = 0 WHERE user_id = ?`, args: [user.id] });
    }
    const id = `upr${nanoid(12)}`;
    await client.execute({
      sql: `INSERT INTO user_profiles (id, user_id, name, unit, level, type, is_default, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, user.id, name, unit, level, type, isDefault ? 1 : 0, 0, now, now],
    });
    return NextResponse.json({ success: true, data: { id, name, unit, level, type, isDefault, sortOrder: 0 } });
  } catch (e) {
    console.error("[profiles POST] 失败:", e);
    return NextResponse.json({ success: false, error: { message: "保存失败" } }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return unauthorized();
  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ success: false, error: { message: "缺少 id" } }, { status: 400 });
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ success: false, error: { message: "画像名称必填" } }, { status: 400 });
  const unit = typeof body.unit === "string" ? body.unit.trim() : "";
  const level = typeof body.level === "string" ? body.level.trim() : "";
  const type = typeof body.type === "string" ? body.type.trim() : "";
  const isDefault = body.isDefault === true;
  const now = Math.floor(Date.now() / 1000);
  try {
    const exist = await client.execute({ sql: `SELECT id FROM user_profiles WHERE id = ? AND user_id = ?`, args: [id, user.id] });
    if (!exist.rows.length) return NextResponse.json({ success: false, error: { message: "画像不存在" } }, { status: 404 });
    if (isDefault) {
      await client.execute({ sql: `UPDATE user_profiles SET is_default = 0 WHERE user_id = ?`, args: [user.id] });
    }
    await client.execute({
      sql: `UPDATE user_profiles SET name = ?, unit = ?, level = ?, type = ?, is_default = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
      args: [name, unit, level, type, isDefault ? 1 : 0, now, id, user.id],
    });
    return NextResponse.json({ success: true, data: { id, name, unit, level, type, isDefault } });
  } catch (e) {
    console.error("[profiles PUT] 失败:", e);
    return NextResponse.json({ success: false, error: { message: "保存失败" } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return unauthorized();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: { message: "缺少 id" } }, { status: 400 });
  try {
    await client.execute({ sql: `DELETE FROM user_profiles WHERE id = ? AND user_id = ?`, args: [id, user.id] });
    // 若删掉默认且无其他默认，把第一条设为默认
    const remain = await client.execute({ sql: `SELECT id FROM user_profiles WHERE user_id = ? AND is_default = 1`, args: [user.id] });
    if (remain.rows.length === 0) {
      const first = await client.execute({ sql: `SELECT id FROM user_profiles WHERE user_id = ? ORDER BY sort_order ASC, id ASC LIMIT 1`, args: [user.id] });
      if (first.rows.length) {
        await client.execute({ sql: `UPDATE user_profiles SET is_default = 1 WHERE id = ?`, args: [String(first.rows[0].id)] });
      }
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[profiles DELETE] 失败:", e);
    return NextResponse.json({ success: false, error: { message: "删除失败" } }, { status: 500 });
  }
}
