// ─── POST|PUT|DELETE /api/admin/crawler/sources ──
// 超管对爬虫数据源的增 / 改 / 删。所有操作先校验超管白名单。
// 前端只提交业务字段；create_by / 时间戳由后端写入，敏感参数不回传。

import { NextRequest, NextResponse } from "next/server";
import { client } from "@/server/db";
import { getServerUser } from "@/server/auth/guard";
import { isSuperAdmin } from "@/server/auth/super-admin";
import { nanoid } from "nanoid";

// ── 新增数据源 ──
export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  if (!(await isSuperAdmin(user.id))) {
    return NextResponse.json({ success: false, error: { message: "无权限" } }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { sourceName, baseUrl, targetColumnId, categoryTag, enable } = body;
    if (!sourceName?.trim() || !baseUrl?.trim()) {
      return NextResponse.json({ success: false, error: { message: "数据源名称与抓取根地址必填" } }, { status: 400 });
    }
    const id = `cs${nanoid(16)}`;
    const now = Math.floor(Date.now() / 1000);
    await client.execute({
      sql: `INSERT INTO crawler_source
            (id, source_name, base_url, target_column_id, category_tag, enable, create_by, create_time, update_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        sourceName.trim(),
        baseUrl.trim(),
        targetColumnId || null,
        categoryTag || "综合",
        enable === false ? 0 : 1,
        user.id,
        now,
        now,
      ],
    });
    return NextResponse.json({ success: true, data: { id, sourceName: sourceName.trim() } });
  } catch (e) {
    console.error("[crawler/sources POST] Error:", e);
    return NextResponse.json({ success: false, error: { message: "创建失败" } }, { status: 500 });
  }
}

// ── 编辑数据源 ──
export async function PUT(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  if (!(await isSuperAdmin(user.id))) {
    return NextResponse.json({ success: false, error: { message: "无权限" } }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, sourceName, baseUrl, targetColumnId, categoryTag, enable } = body;
    if (!id) return NextResponse.json({ success: false, error: { message: "缺少 ID" } }, { status: 400 });

    const sets: string[] = [];
    const vals: any[] = [];
    if (typeof sourceName === "string" && sourceName.trim()) { sets.push("source_name = ?"); vals.push(sourceName.trim()); }
    if (typeof baseUrl === "string" && baseUrl.trim()) { sets.push("base_url = ?"); vals.push(baseUrl.trim()); }
    if (typeof targetColumnId !== "undefined") { sets.push("target_column_id = ?"); vals.push(targetColumnId || null); }
    if (typeof categoryTag === "string") { sets.push("category_tag = ?"); vals.push(categoryTag); }
    if (typeof enable === "boolean") { sets.push("enable = ?"); vals.push(enable ? 1 : 0); }
    if (sets.length === 0) return NextResponse.json({ success: false, error: { message: "无更新字段" } }, { status: 400 });

    sets.push("update_time = ?");
    vals.push(Math.floor(Date.now() / 1000));
    vals.push(id);
    await client.execute({ sql: `UPDATE crawler_source SET ${sets.join(", ")} WHERE id = ?`, args: vals });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[crawler/sources PUT] Error:", e);
    return NextResponse.json({ success: false, error: { message: "更新失败" } }, { status: 500 });
  }
}

// ── 删除数据源 ──
export async function DELETE(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  if (!(await isSuperAdmin(user.id))) {
    return NextResponse.json({ success: false, error: { message: "无权限" } }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ success: false, error: { message: "缺少 ID" } }, { status: 400 });
    await client.execute({ sql: "DELETE FROM crawler_source WHERE id = ?", args: [id] });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[crawler/sources DELETE] Error:", e);
    return NextResponse.json({ success: false, error: { message: "删除失败" } }, { status: 500 });
  }
}
