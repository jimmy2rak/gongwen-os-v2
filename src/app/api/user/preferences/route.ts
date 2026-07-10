// ─── GET / PUT /api/user/preferences ───────────────
// 读取 / 保存当前登录用户的个性化偏好（首页快捷入口等）。
// 按账号（user_id）同步，刷新或重新登录均不丢失。

import { NextRequest, NextResponse } from "next/server";
import { client } from "@/server/db";
import { getServerUser } from "@/server/auth/guard";
import { nanoid } from "nanoid";

export async function GET() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  }
  try {
    const rows = await client.execute({
      sql: "SELECT quick_entries FROM user_preference WHERE user_id = ?",
      args: [user.id],
    });
    const raw = rows.rows[0]?.quick_entries as string | undefined;
    let quickEntries: string[] | null = null;
    if (raw) {
      try { quickEntries = JSON.parse(raw); } catch { quickEntries = null; }
    }
    return NextResponse.json({ success: true, quickEntries });
  } catch (e) {
    console.error("[user/preferences GET] Error:", e);
    return NextResponse.json({ success: false, error: { message: "查询失败" } }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  }
  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const quickEntries = Array.isArray(body.quickEntries) ? body.quickEntries.filter((x: any) => typeof x === "string") : [];
  const now = Math.floor(Date.now() / 1000);
  try {
    await client.execute({
      sql: `INSERT INTO user_preference (id, user_id, quick_entries, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET quick_entries = excluded.quick_entries, updated_at = excluded.updated_at`,
      args: [`up${nanoid(12)}`, user.id, JSON.stringify(quickEntries), now],
    });
    return NextResponse.json({ success: true, quickEntries });
  } catch (e) {
    console.error("[user/preferences PUT] Error:", e);
    return NextResponse.json({ success: false, error: { message: "保存失败" } }, { status: 500 });
  }
}
