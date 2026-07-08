// ─── GET|PUT|DELETE /api/documents/[id] — 文档详情/更新/删除 ──
// GET:   获取单篇文档详情（含完整内容）
// PUT:   更新文档（内容变化时自动生成版本快照）
// DELETE: 软删除文档（设置 deletedAt）

import { NextRequest, NextResponse } from "next/server";
import { db, client } from "@/server/db";
import { documents } from "@/server/db/schema";
import { getServerUser } from "@/server/auth/guard";
import { eq, and, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";

// ─── GET 文档详情 ───────────────────────────────
export async function GET(
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
    const doc = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), isNull(documents.deletedAt)))
      .limit(1);

    if (doc.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "文档不存在" } },
        { status: 404 }
      );
    }

    // 只允许查看自己的文档
    if (doc[0].userId !== user.id) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "无权访问此文档" } },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: doc[0] });
  } catch (error) {
    console.error("[Document GET] Error:", error);
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "获取文档失败" } },
      { status: 500 }
    );
  }
}

// ─── PUT 更新文档 ───────────────────────────────
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
    const body = await req.json();

    // 查找文档
    const existing = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), isNull(documents.deletedAt)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "文档不存在" } },
        { status: 404 }
      );
    }

    if (existing[0].userId !== user.id) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "无权修改此文档" } },
        { status: 403 }
      );
    }

    const doc = existing[0];
    const now = new Date();

    // 构建更新字段（只更新传了的字段）
    const updateData: Record<string, unknown> = { updatedAt: now };
    if (body.title !== undefined) updateData.title = body.title;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.format !== undefined) updateData.format = body.format;
    if (body.meta !== undefined) updateData.meta = typeof body.meta === "string" ? body.meta : JSON.stringify(body.meta);
    if (body.reviewed !== undefined) {
      updateData.reviewed = body.reviewed;
      updateData.reviewedAt = body.reviewed ? now : null;
    }
    if (body.reviewerId !== undefined) updateData.reviewerId = body.reviewerId;

    // 如果内容有变化（以纯文本为准），先创建版本快照，再更新内容
    // 对比纯文本避免 TipTap HTML 序列化格式差异导致误判
    if (body.content !== undefined && body.content !== doc.content) {
      const oldPlain = (doc.content || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      const newPlain = (body.content || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

      if (oldPlain !== newPlain) {
        // 查询当前最大版本号（使用原生 SQL）
        const maxRow = await client.execute({
          sql: "SELECT MAX(version_number) as max_v FROM versions WHERE document_id = ?",
          args: [id],
        });
        const nextVersion = Number((maxRow.rows?.[0] as any)?.max_v || 0) + 1;

        // 创建新版本（存储本次保存的完整内容，作为后续对比基准）
        await client.execute({
          sql: "INSERT INTO versions (id, document_id, content, type, version_number, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          args: [`ver${nanoid(16)}`, id, body.content, "保存", nextVersion, Math.floor(Date.now() / 1000)],
        });
      }

      // 更新内容（即使纯文本没变也允许更新 HTML 格式）
      updateData.content = body.content;
    }

    // 更新文档（用 execute 执行）
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    for (const [key, val] of Object.entries(updateData)) {
      // 跳过 undefined 值
      if (val === undefined) continue;
      // 将 camelCase key 转为 snake_case
      const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      updateFields.push(`\`${snakeKey}\` = ?`);
      // timestamp 字段需要特殊处理
      if (val instanceof Date) {
        updateValues.push(Math.floor(val.getTime() / 1000));
      } else if (typeof val === "boolean") {
        updateValues.push(val ? 1 : 0);
      } else {
        updateValues.push(val);
      }
    }
    updateValues.push(id);

    if (updateFields.length > 0) {
      await client.execute({
        sql: `UPDATE documents SET ${updateFields.join(", ")} WHERE id = ?`,
        args: updateValues,
      });
    }

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("[Document PUT] Error:", error);
    const errMsg = error instanceof Error ? error.message : "";
    if (errMsg.includes("FOREIGN KEY constraint failed")) {
      return NextResponse.json(
        { success: false, error: { code: "SESSION_EXPIRED", message: "登录已过期，请重新登录" } },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: errMsg || "更新文档失败" } },
      { status: 500 }
    );
  }
}

// ─── DELETE 软删除文档 ──────────────────────────
// 已审阅文档禁止删除，必须先退回审阅
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
      .where(and(eq(documents.id, id), isNull(documents.deletedAt)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "文档不存在" } },
        { status: 404 }
      );
    }

    if (existing[0].userId !== user.id) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "无权删除此文档" } },
        { status: 403 }
      );
    }

    // 已审阅文档禁止删除
    if (existing[0].reviewed) {
      return NextResponse.json(
        { success: false, error: { code: "REVIEWED", message: "该文档已完成审阅，无法直接删除，请先退回审阅后再执行删除操作" } },
        { status: 400 }
      );
    }

    // 软删除：设置 deletedAt 时间戳
    await client.execute({
      sql: "UPDATE documents SET deleted_at = ?, updated_at = ? WHERE id = ?",
      args: [Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000), id],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Document DELETE] Error:", error);
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "删除文档失败" } },
      { status: 500 }
    );
  }
}
