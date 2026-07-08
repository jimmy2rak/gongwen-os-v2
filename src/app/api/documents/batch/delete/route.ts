// ─── PUT /api/documents/batch/delete — 批量软删除 ────
// 跳过已审阅文档，返回被跳过的文档列表

import { NextRequest, NextResponse } from "next/server";
import { db, client } from "@/server/db";
import { documents } from "@/server/db/schema";
import { getServerUser } from "@/server/auth/guard";
import { eq, and } from "drizzle-orm";

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
        { success: false, error: { code: "MISSING_PARAMS", message: "请提供文档 ID 列表" } },
        { status: 400 }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const reviewedBlocked: string[] = [];
    const deletedIds: string[] = [];

    for (const id of ids) {
      const existing = await db
        .select({ id: documents.id, reviewed: documents.reviewed })
        .from(documents)
        .where(and(eq(documents.id, id), eq(documents.userId, user.id)))
        .limit(1);

      if (existing.length === 0) continue;

      if (existing[0].reviewed) {
        reviewedBlocked.push(id);
      } else {
        await client.execute({
          sql: "UPDATE documents SET deleted_at = ?, updated_at = ? WHERE id = ?",
          args: [now, now, id],
        });
        deletedIds.push(id);
      }
    }

    return NextResponse.json({
      success: true,
      data: { deleted: deletedIds.length, blocked: reviewedBlocked.length },
      blocked: reviewedBlocked,
    });
  } catch (error) {
    console.error("[BatchDelete] Error:", error);
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "批量删除失败" } },
      { status: 500 }
    );
  }
}
