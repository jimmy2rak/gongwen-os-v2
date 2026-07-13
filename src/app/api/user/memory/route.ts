// ─── GET / PUT /api/user/memory ────────────────────
// 读取 / 保存当前登录用户的 AI 写作记忆（按账号持久化）。
// 字段：personalInfo / languageHabits / writingEnhancements 由用户在前端编辑；
//       autoNotes 为系统自动学习笔记（只读，由 AI 对话提取回写）。
// 该记忆会注入到 AI 系统提示词，使生成内容贴合用户个人风格。

import { NextRequest, NextResponse } from "next/server";
import { client } from "@/server/db";
import { getServerUser } from "@/server/auth/guard";
import { nanoid } from "nanoid";

type MemoryPayload = {
  personalInfo?: string;
  languageHabits?: string;
  writingEnhancements?: string;
  autoNotes?: string;
};

function sanitizeText(v: any): string {
  return typeof v === "string" ? v : "";
}

export async function GET() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  }
  try {
    const rows = await client.execute({
      sql: `SELECT personal_info, language_habits, writing_enhancements, auto_notes
            FROM user_memory WHERE user_id = ?`,
      args: [user.id],
    });
    const row = rows.rows[0];
    const memory: MemoryPayload = {
      personalInfo: (row?.personal_info as string) ?? "",
      languageHabits: (row?.language_habits as string) ?? "",
      writingEnhancements: (row?.writing_enhancements as string) ?? "",
      autoNotes: (row?.auto_notes as string) ?? "",
    };
    return NextResponse.json({ success: true, memory });
  } catch (e) {
    console.error("[user/memory GET] Error:", e);
    return NextResponse.json({ success: false, error: { message: "查询失败" } }, { status: 500 });
  }
}

// 仅更新用户可编辑的三段（personalInfo / languageHabits / writingEnhancements）。
// autoNotes 由系统自动回写，不在此处接受前端覆盖。
export async function PUT(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  }
  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  const personalInfo = sanitizeText(body.personalInfo);
  const languageHabits = sanitizeText(body.languageHabits);
  const writingEnhancements = sanitizeText(body.writingEnhancements);
  const now = Math.floor(Date.now() / 1000);

  try {
    await client.execute({
      sql: `INSERT INTO user_memory (id, user_id, personal_info, language_habits, writing_enhancements, auto_notes, updated_at)
            VALUES (?, ?, ?, ?, ?, '', ?)
            ON CONFLICT(user_id) DO UPDATE SET
              personal_info = excluded.personal_info,
              language_habits = excluded.language_habits,
              writing_enhancements = excluded.writing_enhancements,
              updated_at = excluded.updated_at`,
      args: [`um${nanoid(12)}`, user.id, personalInfo, languageHabits, writingEnhancements, now],
    });
    return NextResponse.json({
      success: true,
      memory: { personalInfo, languageHabits, writingEnhancements, autoNotes: "" },
    });
  } catch (e) {
    console.error("[user/memory PUT] Error:", e);
    return NextResponse.json({ success: false, error: { message: "保存失败" } }, { status: 500 });
  }
}
