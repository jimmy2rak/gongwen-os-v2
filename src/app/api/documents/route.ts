// ─── GET|POST /api/documents — 文档列表 / 创建 ──────
// GET:  获取当前用户的文档列表（分页+搜索+软删除过滤）
// POST: 创建新文档，同时生成初始版本

import { NextRequest, NextResponse } from "next/server";
import { db, client } from "@/server/db";
import { documents, reviews } from "@/server/db/schema";
import { getServerUser } from "@/server/auth/guard";
import { eq, desc, like, and, isNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

// ─── GET 文档列表 ───────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category") || "";
    const reviewed = searchParams.get("reviewed"); // "true" | "false" | undefined
    const deleted = searchParams.get("deleted");   // "true" 则查已删除文档

    // 构建查询条件
    const conditions = [eq(documents.userId, user.id)];

    if (deleted === "true") {
      // 回收站：只查已软删除
      conditions.push(sql`${documents.deletedAt} IS NOT NULL`);
    } else {
      // 正常列表：只查未删除
      conditions.push(isNull(documents.deletedAt));
    }

    if (search) {
      conditions.push(like(documents.title, `%${search}%`));
    }
    if (category) {
      conditions.push(eq(documents.category, category));
    }
    if (reviewed === "true") {
      conditions.push(eq(documents.reviewed, true));
    } else if (reviewed === "false") {
      conditions.push(eq(documents.reviewed, false));
    }

    console.log(`[Documents GET] 查询条件:`, JSON.stringify({ page, pageSize, search, category, reviewed, deleted }));

    // 查询总数
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(documents)
      .where(and(...conditions));

    const total = Number(countResult[0]?.count || 0);

    // 查询列表（按更新时间倒序）
    // 使用子查询联查 users 表获取审阅人姓名，子句中 documents.id 是裸 SQL 字符串，
    // 由 SQLite 直接解析为外层表 documents 的主键，避免 drizzle 模板绑定歧义
    const list = await db
      .select({
        id: documents.id,
        title: documents.title,
        category: documents.category,
        format: documents.format,
        content: documents.content,
        reviewed: documents.reviewed,
        reviewerId: documents.reviewerId,
        reviewerName: sql<string>`COALESCE(
          (SELECT r.reviewer_name
           FROM reviews r
           WHERE r.document_id = documents.id
             AND r.review_status = 'approved'
           ORDER BY r.created_at DESC
           LIMIT 1),
          ''
        )`,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
        reviewedAt: documents.reviewedAt,
        deletedAt: documents.deletedAt,
      })
      .from(documents)
      .where(and(...conditions))
      .orderBy(desc(documents.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return NextResponse.json({
      success: true,
      data: list,
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error: any) {
    console.error("[Documents GET] 完整异常:", error);
    if (error?.sql) console.error("[Documents GET] 原始SQL:", error.sql);
    if (error?.message) console.error("[Documents GET] 错误消息:", error.message);
    if (error?.stack) console.error("[Documents GET] 堆栈:", error.stack);
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "获取文档列表失败" } },
      { status: 500 }
    );
  }
}

// ─── POST 创建文档 ──────────────────────────────
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
    const { title, category, content, format, meta, reviewed, reviewerId, reviewerName } = body;

    if (!title) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_FIELDS", message: "标题不能为空" } },
        { status: 400 }
      );
    }

    const now = new Date();
    const nowSec = Math.floor(Date.now() / 1000);
    const docId = `doc${nanoid(16)}`;
    const metaStr = meta ? (typeof meta === "string" ? meta : JSON.stringify(meta)) : "{}";
    const formatVal = format || "gb";

    // 知识库导入等场景可携带 reviewed=true 强制标记已审阅
    const reviewedFlag = reviewed === true ? 1 : 0;
    const reviewerIdVal = reviewedFlag ? (reviewerId || user.id) : null;
    const reviewerNameVal = reviewedFlag ? (reviewerName || user.name || user.email || "系统导入") : null;

    // 先创建文档（使用原生 libSQL 客户端，drizzle 的 insert 在某些版本有兼容问题）
    await client.execute({
      sql: "INSERT INTO documents (id, title, category, format, content, meta, user_id, reviewed, reviewer_id, reviewed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [docId, title, category || "通知", formatVal, content || "", metaStr, user.id, reviewedFlag, reviewerIdVal, reviewedFlag ? nowSec : null, nowSec, nowSec],
    });

    // 再创建初始版本 v0（存储基线内容，所有后续编辑基于此对比）
    await client.execute({
      sql: "INSERT INTO versions (id, document_id, content, data, type, version_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [`ver${nanoid(16)}`, docId, content || "", JSON.stringify({ title, category, content, format: formatVal, meta: metaStr }), "初始", 0, nowSec],
    });

    // 强制审阅（知识库导入）：写入一条 approved 审阅记录，使知识库列表能显示审阅人
    if (reviewedFlag) {
      await client.execute({
        sql: "INSERT INTO reviews (id, document_id, reviewer_id, reviewer_name, department, review_status, comment, operated_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          `rev${nanoid(16)}`,
          docId,
          reviewerIdVal,
          reviewerNameVal || "系统导入",
          "",
          "approved",
          "从 Word 文档导入并自动审阅",
          nowSec,
          nowSec,
          nowSec,
        ],
      });
    }

    return NextResponse.json({
      success: true,
      data: { id: docId, title, category, format: formatVal, reviewed: !!reviewedFlag },
    });
  } catch (error) {
    console.error("[Documents POST] Error details:", error);
    const errMsg = error instanceof Error ? error.message : "";
    // 检测外键约束失败（JWT 中的用户不存在于数据库）
    if (errMsg.includes("FOREIGN KEY constraint failed")) {
      return NextResponse.json(
        { success: false, error: { code: "SESSION_EXPIRED", message: "登录已过期，请重新登录" } },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: errMsg || "创建文档失败" } },
      { status: 500 }
    );
  }
}
