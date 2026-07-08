// ─── GET /api/admin/crawler/list ────────────────
// 超管获取所有爬虫数据源列表。普通用户返回 403（无数据泄露）。
// 鉴权：当前登录用户必须位于 sys_super_admin 白名单。

import { NextRequest, NextResponse } from "next/server";
import { client } from "@/server/db";
import { getServerUser } from "@/server/auth/guard";
import { isSuperAdmin } from "@/server/auth/super-admin";

export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  }
  if (!(await isSuperAdmin(user.id))) {
    return NextResponse.json(
      { success: false, error: { message: "无权限：仅超级管理员可访问" } },
      { status: 403 }
    );
  }

  try {
    const rows = await client.execute({
      sql: "SELECT * FROM crawler_source ORDER BY create_time DESC",
      args: [],
    });
    return NextResponse.json({ success: true, data: rows.rows });
  } catch (e) {
    console.error("[crawler/list] Error:", e);
    return NextResponse.json({ success: false, error: { message: "查询失败" } }, { status: 500 });
  }
}
