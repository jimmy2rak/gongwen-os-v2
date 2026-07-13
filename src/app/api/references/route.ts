// ─── GET /api/references ──────────────────────────
// 返回当前用户的文章列表（用于 AI 问答的 @ 提及选择）：
// 文档库（全部未删除文档）+ 知识库（已审阅文档），仅返回 id/title/category/reviewed。

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { documents } from "@/server/db/schema";
import { getServerUser } from "@/server/auth/guard";
import { eq, isNull, like, desc, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const conditions = [eq(documents.userId, user.id), isNull(documents.deletedAt)];
    if (search) conditions.push(like(documents.title, `%${search}%`));
    const list = await db
      .select({
        id: documents.id,
        title: documents.title,
        category: documents.category,
        reviewed: documents.reviewed,
      })
      .from(documents)
      .where(and(...conditions))
      .orderBy(desc(documents.updatedAt))
      .limit(50);
    return NextResponse.json({ success: true, data: list });
  } catch (e) {
    console.error("[references GET] Error:", e);
    return NextResponse.json({ success: false, error: { message: "查询失败" } }, { status: 500 });
  }
}
