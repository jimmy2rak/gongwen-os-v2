// ─── POST /api/reviews — 提交审阅记录 ─────────────
// 写入 reviews 表，同时更新 documents 表审阅状态

import { NextRequest, NextResponse } from "next/server";
import { db, client } from "@/server/db";
import { documents } from "@/server/db/schema";
import { getServerUser } from "@/server/auth/guard";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { documentId, reviewerId, reviewerName, department, approved, comment } = body;

    if (!documentId || !reviewerId) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_FIELDS", message: "缺少必要参数" } },
        { status: 400 }
      );
    }

    // 确认文档属于当前用户
    const doc = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.userId, user.id)))
      .limit(1);

    if (doc.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "文档不存在" } },
        { status: 404 }
      );
    }

    const now = new Date();
    const nowTs = Math.floor(now.getTime() / 1000);
    const reviewId = `rv${nanoid(16)}`;
    const status = approved ? "approved" : "rejected";

    // 写入 reviews 表（使用数据库中实际存在的字段）
    await client.execute({
      sql: "INSERT INTO reviews (id, document_id, reviewer_id, status, comment, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [reviewId, documentId, reviewerId, status, comment || "", nowTs, nowTs],
    });

    // 更新文档审阅状态
    await client.execute({
      sql: "UPDATE documents SET reviewed = ?, reviewer_id = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
      args: [approved ? 1 : 0, reviewerId, nowTs, nowTs, documentId],
    });

    return NextResponse.json({
      success: true,
      data: { id: reviewId, status },
    });
  } catch (error) {
    console.error("[Review POST] Error:", error);
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "提交审阅失败" } },
      { status: 500 }
    );
  }
}
