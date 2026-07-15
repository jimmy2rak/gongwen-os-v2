// ─── DELETE /api/quotations/[id]?id=xxx — 删除金句（带 user_id 二次校验防越权）──

import { NextRequest, NextResponse } from "next/server";
import { client } from "@/server/db";
import { getServerUser } from "@/server/auth/guard";

function unauthorized() {
  return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getServerUser();
  if (!user) return unauthorized();
  const pathId = (await params).id;
  const id = pathId || req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: { message: "缺少 id" } }, { status: 400 });
  try {
    await client.execute({ sql: `DELETE FROM quotations WHERE id = ? AND user_id = ?`, args: [id, user.id] });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[quotations DELETE]", e);
    return NextResponse.json({ success: false, error: { message: "删除失败" } }, { status: 500 });
  }
}
