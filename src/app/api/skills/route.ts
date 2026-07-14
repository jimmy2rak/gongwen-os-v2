// ─── GET|POST|PUT|DELETE /api/skills ─────────────
// 公文写作 Skill 管理（DB 持久化，绑定用户账号）
// 内置 Skill 首次请求时自动 seed（11 类公文各 1 个默认规范）

import { NextRequest, NextResponse } from "next/server";
import { db, client } from "@/server/db";
import { skills } from "@/server/db/schema/skills";
import { getServerUser } from "@/server/auth/guard";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  getAllBuiltinSkills,
  type BuiltinSkillDef,
} from "@/lib/builtin-templates";

const now = () => Math.floor(Date.now() / 1000);

// ─── GET 列表 ───────────────────────────────
// query.category?: string — 按公文类型过滤
// 内置 Skill 统一从代码 getAllBuiltinSkills() 返回，保证所有账号完全一致（不再逐账号 seed，
// 避免代码更新后只有先查询过 /api/skills 的账号拿到新版，造成账号间不同步）。
export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  }

  const url = new URL(req.url);
  const catFilter = url.searchParams.get("category") || undefined;

  try {
    // 1) 内置 Skill：全局统一（所有账号看到的完全一致）
    const builtins = getAllBuiltinSkills().map(({ category, skill }, idx) => ({
      id: `blt-${category}-${idx}`,
      category,
      name: skill.name,
      content: skill.content,
      isBuiltin: true,
      createdAt: null,
      updatedAt: null,
    }));

    // 2) 用户自定义 Skill（仅本账号、且非内置）
    const conditions = [eq(skills.userId, user.id), eq(skills.isBuiltin, false)];
    if (catFilter) {
      conditions.push(eq(skills.category, catFilter));
    }

    const rows = await db
      .select()
      .from(skills)
      .where(and(...conditions))
      .orderBy(desc(skills.createdAt));

    const custom = rows.map((r) => ({
      id: r.id,
      category: r.category,
      name: r.name,
      content: r.content,
      isBuiltin: Boolean(r.isBuiltin),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      data: [...builtins, ...custom],
      builtinSynced: true,
    });
  } catch (error) {
    console.error("[skills GET] Error:", error);
    return NextResponse.json({ success: false, error: { message: "获取失败" } }, { status: 500 });
  }
}

// ─── POST 新建（仅自定义） ───────────────────
export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, category, content } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ success: false, error: { message: "名称不能为空" } }, { status: 400 });
    }
    if (!category || typeof category !== "string") {
      return NextResponse.json({ success: false, error: { message: "分类不能为空" } }, { status: 400 });
    }
    if (!content || typeof content !== "string") {
      return NextResponse.json({ success: false, error: { message: "内容不能为空" } }, { status: 400 });
    }

    const id = `sk${nanoid(16)}`;
    const t = now();

    await client.execute({
      sql: `INSERT INTO skills (id, user_id, category, name, content, is_builtin, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
      args: [id, user.id, category.trim(), name.trim(), content.trim(), t, t],
    });

    return NextResponse.json({
      success: true,
      data: { id, name: name.trim(), category: category.trim(), isBuiltin: false },
    });
  } catch (error) {
    console.error("[skills POST] Error:", error);
    return NextResponse.json({ success: false, error: { message: "创建失败" } }, { status: 500 });
  }
}

// ─── PUT 编辑（仅自定义） ───────────────────
export async function PUT(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, name, category, content } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: { message: "缺少 ID" } }, { status: 400 });
    }

    // 校验归属 + 不可编辑内置
    const existing = await db
      .select()
      .from(skills)
      .where(and(eq(skills.id, id), eq(skills.userId, user.id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ success: false, error: { message: "记录不存在或无权修改" } }, { status: 404 });
    }
    if (existing[0].isBuiltin) {
      return NextResponse.json({ success: false, error: { message: "内置 Skill 不允许编辑" } }, { status: 403 });
    }

    const sets: string[] = [];
    const vals: any[] = [];
    if (typeof name === "string" && name.trim()) { sets.push("name = ?"); vals.push(name.trim()); }
    if (typeof category === "string" && category.trim()) { sets.push("category = ?"); vals.push(category.trim()); }
    if (typeof content === "string") { sets.push("content = ?"); vals.push(content); }
    sets.push("updated_at = ?");
    vals.push(now());
    vals.push(id);

    await client.execute({
      sql: `UPDATE skills SET ${sets.join(", ")} WHERE id = ?`,
      args: vals,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[skills PUT] Error:", error);
    return NextResponse.json({ success: false, error: { message: "更新失败" } }, { status: 500 });
  }
}

// ─── DELETE（仅自定义） ─────────────────────
export async function DELETE(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: { message: "缺少 ID" } }, { status: 400 });
    }

    // 校验归属 + 不可删除内置
    const existing = await db
      .select()
      .from(skills)
      .where(and(eq(skills.id, id), eq(skills.userId, user.id)))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ success: false, error: { message: "记录不存在或无权删除" } }, { status: 404 });
    }
    if (existing[0].isBuiltin) {
      return NextResponse.json({ success: false, error: { message: "内置 Skill 不允许删除" } }, { status: 403 });
    }

    await client.execute({ sql: "DELETE FROM skills WHERE id = ?", args: [id] });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[skills DELETE] Error:", error);
    return NextResponse.json({ success: false, error: { message: "删除失败" } }, { status: 500 });
  }
}
