// ─── GET|POST|DELETE /api/templates — 模板管理 ──
// GET:   获取全部模板（内置 + 用户自定义，含首选标记）
// POST:  新建自定义模板
// PUT:   更新自定义模板
// DELETE:删除自定义模板（body: { id }）

import { NextRequest, NextResponse } from "next/server";
import { db, client } from "@/server/db";
import { templates } from "@/server/db/schema";
import { getServerUser } from "@/server/auth/guard";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { BUILTIN_TEMPLATES } from "@/lib/builtin-templates";

export async function GET() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  }

  try {
    // 查询用户自定义模板
    const userTemplates = await db
      .select()
      .from(templates)
      .where(eq(templates.userId, user.id))
      .orderBy(desc(templates.createdAt));

    // 查询首选模板
    let preferredId: string | null = null;
    const userRow = await client.execute({
      sql: "SELECT preferred_template_id FROM users WHERE id = ?",
      args: [user.id],
    });
    const row = (userRow.rows?.[0] as any);
    if (row?.preferred_template_id) {
      preferredId = row.preferred_template_id;
    }

    return NextResponse.json({
      success: true,
      data: {
        builtin: BUILTIN_TEMPLATES,
        custom: userTemplates.map((t) => ({
          id: t.id,
          name: t.name,
          type: t.type,
          category: t.category,
          content: t.content,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        })),
        preferredId,
      },
    });
  } catch (error) {
    console.error("[Templates GET] Error:", error);
    return NextResponse.json({ success: false, error: { message: "获取模板失败" } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, content, category } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: { message: "模板名称不能为空" } }, { status: 400 });
    }

    // 全局查重（同名拦截）
    const existing = await db
      .select({ id: templates.id })
      .from(templates)
      .where(and(eq(templates.userId, user.id), eq(templates.name, name.trim())))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: { message: `模板名称「${name.trim()}」已存在，请使用其他名称` } },
        { status: 409 }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const id = `tpl${nanoid(16)}`;

    await client.execute({
      sql: "INSERT INTO templates (id, user_id, name, type, category, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [id, user.id, name.trim(), "custom", category || "通用", content || "[]", now, now],
    });

    return NextResponse.json({ success: true, data: { id, name: name.trim(), type: "custom", category: category || "通用", content: content || "[]" } });
  } catch (error) {
    console.error("[Templates POST] Error:", error);
    return NextResponse.json({ success: false, error: { message: "创建模板失败" } }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, name, content } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: { message: "缺少模板ID" } }, { status: 400 });
    }

    // 校验归属
    const existing = await db
      .select()
      .from(templates)
      .where(and(eq(templates.id, id), eq(templates.userId, user.id)))
      .limit(1);
    if (existing.length === 0) {
      return NextResponse.json({ success: false, error: { message: "模板不存在或无权修改" } }, { status: 404 });
    }

    // 同名校验（排除自身）
    if (name && name.trim() !== existing[0].name) {
      const dup = await db
        .select({ id: templates.id })
        .from(templates)
        .where(and(eq(templates.userId, user.id), eq(templates.name, name.trim()), eq(templates.type, "custom")))
        .limit(1);
      if (dup.length > 0 && dup[0].id !== id) {
        return NextResponse.json({ success: false, error: { message: `模板名称「${name.trim()}」已存在` } }, { status: 409 });
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const updates: string[] = [];
    const values: any[] = [];
    if (name !== undefined) { updates.push("name = ?"); values.push(name.trim()); }
    if (content !== undefined) { updates.push("content = ?"); values.push(content); }
    updates.push("updated_at = ?");
    values.push(now);
    values.push(id);

    await client.execute({
      sql: `UPDATE templates SET ${updates.join(", ")} WHERE id = ?`,
      args: values,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Templates PUT] Error:", error);
    return NextResponse.json({ success: false, error: { message: "更新模板失败" } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: { message: "缺少模板ID" } }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(templates)
      .where(and(eq(templates.id, id), eq(templates.userId, user.id)))
      .limit(1);
    if (existing.length === 0) {
      return NextResponse.json({ success: false, error: { message: "模板不存在或无权删除" } }, { status: 404 });
    }

    await client.execute({
      sql: "DELETE FROM templates WHERE id = ?",
      args: [id],
    });

    // 如果删除的是首选模板，清除用户的 preferred_template_id
    const userRow = await client.execute({
      sql: "SELECT preferred_template_id FROM users WHERE id = ?",
      args: [user.id],
    });
    const row = (userRow.rows?.[0] as any);
    if (row?.preferred_template_id === id) {
      await client.execute({
        sql: "UPDATE users SET preferred_template_id = NULL WHERE id = ?",
        args: [user.id],
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Templates DELETE] Error:", error);
    return NextResponse.json({ success: false, error: { message: "删除模板失败" } }, { status: 500 });
  }
}
