// ─── GET|POST /api/documents/[id]/versions — 版本历史 ──
// GET:  获取所有版本列表
// POST: 恢复到指定版本

import { NextRequest, NextResponse } from "next/server";
import { db, client } from "@/server/db";
import { documents, versions } from "@/server/db/schema";
import { getServerUser } from "@/server/auth/guard";
import { eq, and, isNull, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

// ─── GET 版本列表 ──────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
  }

  try {
    const { id } = await params;
    const doc = await db.select().from(documents).where(and(eq(documents.id, id), isNull(documents.deletedAt))).limit(1);
    if (doc.length === 0) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "文档不存在" } }, { status: 404 });
    }

    const versionList = await db
      .select({ id: versions.id, type: versions.type, content: versions.content, versionNumber: versions.versionNumber, createdAt: versions.createdAt })
      .from(versions)
      .where(eq(versions.documentId, id))
      .orderBy(desc(versions.versionNumber));

    return NextResponse.json({ success: true, data: versionList });
  } catch (error) {
    console.error("[Versions GET] Error:", error);
    return NextResponse.json({ success: false, error: { code: "SERVER_ERROR", message: "获取版本失败" } }, { status: 500 });
  }
}

// ─── POST 恢复版本 ─────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "未登录" } }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { versionId } = await req.json();
    if (!versionId) {
      return NextResponse.json({ success: false, error: { code: "MISSING_FIELDS", message: "缺少版本ID" } }, { status: 400 });
    }

    // 查找目标版本
    const targetVersion = await db.select().from(versions).where(and(eq(versions.id, versionId), eq(versions.documentId, id))).limit(1);
    if (targetVersion.length === 0) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "版本不存在" } }, { status: 404 });
    }

    // 查找文档确认权限
    const doc = await db.select().from(documents).where(and(eq(documents.id, id), isNull(documents.deletedAt))).limit(1);
    if (doc.length === 0 || doc[0].userId !== user.id) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "无权操作" } }, { status: 403 });
    }

    const now = Math.floor(Date.now() / 1000);

    // 查询当前最大版本号（使用原生 SQL 避免 drizzle sql 模板潜在问题）
    const maxRow = await client.execute({
      sql: "SELECT MAX(version_number) as max_v FROM versions WHERE document_id = ?",
      args: [id],
    });
    const currentMax = Number((maxRow.rows?.[0] as any)?.max_v || 0);
    const snapshotVer = currentMax + 1;

    // 创建回退快照（保留回退前的状态，**不删除任何已有历史**）
    await client.execute({
      sql: "INSERT INTO versions (id, document_id, content, type, version_number, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      args: [`ver${nanoid(16)}`, id, doc[0].content, "回退", snapshotVer, now],
    });

    // 更新文档内容为目标版本
    await client.execute({
      sql: "UPDATE documents SET content = ?, updated_at = ? WHERE id = ?",
      args: [targetVersion[0].content, now, id],
    });

    return NextResponse.json({ success: true, data: { content: targetVersion[0].content } });
  } catch (error) {
    console.error("[Versions POST] Error:", error);
    return NextResponse.json({ success: false, error: { code: "SERVER_ERROR", message: "恢复版本失败" } }, { status: 500 });
  }
}
