// ─── DELETE /api/documents/batch/hard — 批量永久删除 ─
// 仅已软删除 + 未审阅文档可批量物理删除

import { NextRequest, NextResponse } from "next/server";
import { db, client } from "@/server/db";
import { documents } from "@/server/db/schema";
import { getServerUser } from "@/server/auth/guard";
import { eq, and } from "drizzle-orm";

export async function DELETE(req: NextRequest) {
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
        { success: false, error: { code: "MISSING_PARAMS", message: "请提供要删除的文档 ID 列表" } },
        { status: 400 }
      );
    }

    const reviewedBlocked: string[] = [];
    const deletedIds: string[] = [];

    for (const id of ids) {
      const existing = await db
        .select({ id: documents.id, reviewed: documents.reviewed, deletedAt: documents.deletedAt })
        .from(documents)
        .where(and(eq(documents.id, id), eq(documents.userId, user.id)))
        .limit(1);

      if (existing.length === 0) continue;

      if (existing[0].reviewed) {
        reviewedBlocked.push(id);
        continue;
      }
      if (!existing[0].deletedAt) continue;

      // 先删版本
      await client.execute({
        sql: "DELETE FROM versions WHERE document_id = ?",
        args: [id],
      });
      // 物理删文档
      await client.execute({
        sql: "DELETE FROM documents WHERE id = ?",
        args: [id],
      });
      deletedIds.push(id);
    }

    return NextResponse.json({ success: true, data: { deleted: deletedIds.length, blocked: reviewedBlocked.length } });
  } catch (error) {
    console.error("[BatchHardDelete] Error:", error);
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "批量永久删除失败" } },
      { status: 500 }
    );
  }
}
