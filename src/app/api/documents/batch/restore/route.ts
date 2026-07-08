// ─── PUT /api/documents/batch/restore — 批量恢复 ─────
// 批量清空 deleted_at，一次性恢复多条文档

import { NextRequest, NextResponse } from "next/server";
import { client } from "@/server/db";
import { getServerUser } from "@/server/auth/guard";

export async function PUT(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_PARAMS", message: "请提供要恢复的文档 ID 列表" } },
        { status: 400 }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    for (const id of ids) {
      await client.execute({
        sql: "UPDATE documents SET deleted_at = NULL, updated_at = ? WHERE id = ? AND user_id = ?",
        args: [now, id, user.id],
      });
    }

    return NextResponse.json({ success: true, data: { count: ids.length } });
  } catch (error) {
    console.error("[BatchRestore] Error:", error);
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "批量恢复失败" } },
      { status: 500 }
    );
  }
}
