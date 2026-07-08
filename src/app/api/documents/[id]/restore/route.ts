// ─── PUT /api/documents/[id]/restore — 恢复文档 ──────
// 清除 deleted_at 标记，文档回到正常列表

import { NextRequest, NextResponse } from "next/server";
import { db, client } from "@/server/db";
import { documents } from "@/server/db/schema";
import { getServerUser } from "@/server/auth/guard";
import { eq, and } from "drizzle-orm";

export async function PUT(
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
        { success: false, error: { code: "ALREADY_RESTORED", message: "文档未被删除，无需恢复" } },
        { status: 400 }
      );
    }

    // 恢复：清空 deleted_at
    await client.execute({
      sql: "UPDATE documents SET deleted_at = NULL, updated_at = ? WHERE id = ?",
      args: [Math.floor(Date.now() / 1000), id],
    });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("[Restore] Error:", error);
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "恢复文档失败" } },
      { status: 500 }
    );
  }
}
