// ─── GET|PUT /api/reviewers — 审阅人管理（按账号隔离）───────────
// GET:  返回当前登录账号的审阅人列表（reviewers 表现在按 user_id 隔离）。
//       若该账号尚无任何审阅人（新账号），自动播种一个示例「办公室-张三」。
// PUT:  整体替换当前账号的审阅人列表（先删本账号旧记录，再插入新记录）。
// 历史默认审阅人仅在数据库异常时兜底返回，避免前端崩溃。

import { NextRequest, NextResponse } from "next/server";
import { client } from "@/server/db";
import { getServerUser } from "@/server/auth/guard";
import { nanoid } from "nanoid";

// 兜底默认（数据库异常时使用，单条示例）
const FALLBACK_REVIEWERS = [{ id: "rv_zhangsan", name: "张三", department: "办公室" }];

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: "UNAUTHORIZED", message: "未登录" } },
    { status: 401 }
  );
}

export async function GET() {
  const user = await getServerUser();
  if (!user) return unauthorized();

  try {
    const res = await client.execute({
      sql: `SELECT id, name, department FROM reviewers WHERE user_id = ? ORDER BY sort_order ASC, name ASC`,
      args: [user.id],
    });
    let rows = (res.rows as any[]) || [];

    // 新账号：尚无任何审阅人 → 播种单个示例
    if (rows.length === 0) {
      const now = Math.floor(Date.now() / 1000);
      const id = `rv${nanoid(10)}`;
      await client.execute({
        sql: `INSERT INTO reviewers (id, name, department, sort_order, created_at, user_id) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [id, "张三", "办公室", 1, now, user.id],
      });
      rows = [{ id, name: "张三", department: "办公室" }];
    }

    const data = rows.map((r) => ({
      id: String(r.id),
      name: String(r.name || ""),
      department: String(r.department || ""),
    }));
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("[reviewers GET] 失败，兜底默认:", e);
    return NextResponse.json({ success: true, data: FALLBACK_REVIEWERS });
  }
}

// 整体替换当前账号的审阅人列表
export async function PUT(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return unauthorized();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: { message: "请求体解析失败" } }, { status: 400 });
  }

  const list = Array.isArray(body?.reviewers) ? body.reviewers : [];
  const clean = list
    .filter((r: any) => r && typeof r.name === "string" && r.name.trim())
    .map((r: any, i: number) => ({
      id: typeof r.id === "string" && r.id ? r.id : `rv${nanoid(10)}`,
      name: r.name.trim().slice(0, 50),
      department: typeof r.department === "string" ? r.department.trim().slice(0, 50) : "",
      sort: i,
    }));

  try {
    // 仅删除本账号的旧记录，避免误删其他账号数据
    await client.execute({ sql: `DELETE FROM reviewers WHERE user_id = ?`, args: [user.id] });
    const now = Math.floor(Date.now() / 1000);
    for (const r of clean) {
      await client.execute({
        sql: `INSERT INTO reviewers (id, name, department, sort_order, created_at, user_id) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [r.id, r.name, r.department, r.sort, now, user.id],
      });
    }
    return NextResponse.json({ success: true, data: clean });
  } catch (e) {
    console.error("[reviewers PUT] 失败:", e);
    return NextResponse.json({ success: false, error: { message: "保存失败" } }, { status: 500 });
  }
}
