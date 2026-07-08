// ─── DELETE /api/documents/[id]/hard — 永久物理删除 ──
// 仅已软删除文档可执行；不可逆操作

import { NextRequest, NextResponse } from "next/server";
import { db, client } from "@/server/db";
import { documents } from "@/server/db/schema";
import { getServerUser } from "@/server/auth/guard";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;

    const existing = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, user.id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "文档不存在" } },
        { status: 404 }
      );
    }

    if (!existing[0].deletedAt) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_DELETED", message: "文档未删除，请先软删除" } },
        { status: 400 }
      );
    }

    if (existing[0].reviewed) {
      return NextResponse.json(
        { success: false, error: { code: "REVIEWED", message: "该文档已完成审阅，无法直接删除，请先退回审阅后再执行删除操作" } },
        { status: 400 }
      );
    }

    // 先删除关联版本
    await client.execute({
      sql: "DELETE FROM versions WHERE document_id = ?",
      args: [id],
    });

    // 物理删除文档
    await client.execute({
      sql: "DELETE FROM documents WHERE id = ?",
      args: [id],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[HardDelete] Error:", error);
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "永久删除失败" } },
      { status: 500 }
    );
  }
}
