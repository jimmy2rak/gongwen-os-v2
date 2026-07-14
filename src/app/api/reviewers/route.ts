// ─── GET|PUT /api/reviewers — 审阅人管理 ─────────
// GET:  返回审阅人列表（从数据库 readers 表读取，与编辑器/文档管理共用同一数据源）
// PUT:  整体替换审阅人列表（设置页保存时调用，保证自定义审阅人实时同步到编辑器）
// 历史默认审阅人仅在数据库为空时兜底返回，避免旧 localStorage 数据丢失。

import { NextRequest, NextResponse } from "next/server";
import { client } from "@/server/db";
import { getServerUser } from "@/server/auth/guard";

// 兜底默认审阅人（数据库为空时使用）
const DEFAULT_REVIEWERS = [
  { id: "r1", name: "张主任", department: "办公室" },
  { id: "r2", name: "李副主任", department: "办公室" },
  { id: "r3", name: "王科长", department: "综合科" },
  { id: "r4", name: "赵副科长", department: "综合科" },
];

export async function GET() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  try {
    const res = await client.execute({
      sql: `SELECT id, name, department FROM reviewers ORDER BY sort_order ASC, name ASC`,
    });
    const rows = (res.rows as any[]) || [];
    if (rows.length === 0) {
      return NextResponse.json({ success: true, data: DEFAULT_REVIEWERS });
    }
    const data = rows.map((r) => ({
      id: String(r.id),
      name: String(r.name || ""),
      department: String(r.department || ""),
    }));
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("[reviewers GET] 失败，兜底默认:", e);
    return NextResponse.json({ success: true, data: DEFAULT_REVIEWERS });
  }
}

// 整体替换审阅人列表
export async function PUT(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: { message: "请求体解析失败" } }, { status: 400 });
  }

  const list = Array.isArray(body?.reviewers) ? body.reviewers : [];
  // 校验每条记录
  const clean = list
    .filter((r: any) => r && typeof r.name === "string" && r.name.trim())
    .map((r: any, i: number) => ({
      id: typeof r.id === "string" && r.id ? r.id : `rv${Date.now()}_${i}`,
      name: r.name.trim().slice(0, 50),
      department: typeof r.department === "string" ? r.department.trim().slice(0, 50) : "",
      sort: i,
    }));

  try {
    // 全量替换：先清后插
    await client.execute(`DELETE FROM reviewers`);
    const now = Math.floor(Date.now() / 1000);
    for (const r of clean) {
      await client.execute({
        sql: `INSERT INTO reviewers (id, name, department, sort_order, created_at) VALUES (?, ?, ?, ?, ?)`,
        args: [r.id, r.name, r.department, r.sort, now],
      });
    }
    return NextResponse.json({ success: true, data: clean });
  } catch (e) {
    console.error("[reviewers PUT] 失败:", e);
    return NextResponse.json({ success: false, error: { message: "保存失败" } }, { status: 500 });
  }
}
