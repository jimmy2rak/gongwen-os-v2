// ─── GET / PUT / POST /api/user/memory ─────────────
// 读取 / 保存当前登录用户的 AI 写作记忆（按账号持久化）。
// 字段：personalInfo / languageHabits / writingEnhancements 由用户在前端编辑；
//       autoNotes 为系统自动学习笔记（可读写，由 AI 对话提取回写 / 手动更新生成）。
// 该记忆会注入到 AI 系统提示词，使生成内容贴合用户个人风格。
// POST /refresh：聚合用户全部公文/初稿/大纲/知识库/聊天历史，调用 LLM 抽取记忆并回传（不直接落库，由用户编辑后保存）。

import { NextRequest, NextResponse } from "next/server";
import { client, db } from "@/server/db";
import { getServerUser } from "@/server/auth/guard";
import { nanoid } from "nanoid";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { documents, apiKeys } from "@/server/db/schema";
import { decryptApiKey } from "@/server/lib/crypto";
import { getProvider, isValidProvider } from "@/server/lib/ai/providers";
import { getSystemMiniCPMConfig } from "@/server/lib/ai/system-minicpm";
import { extractMemory } from "@/server/lib/ai/extract-memory";

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

// 更新用户可编辑记忆（personalInfo / languageHabits / writingEnhancements 手动维护；
// autoNotes 由系统自动学习 / 手动更新生成，此处接受前端覆盖保存）。
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
  const autoNotes = sanitizeText(body.autoNotes);
  const now = Math.floor(Date.now() / 1000);

  try {
    await client.execute({
      sql: `INSERT INTO user_memory (id, user_id, personal_info, language_habits, writing_enhancements, auto_notes, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              personal_info = excluded.personal_info,
              language_habits = excluded.language_habits,
              writing_enhancements = excluded.writing_enhancements,
              auto_notes = excluded.auto_notes,
              updated_at = excluded.updated_at`,
      args: [`um${nanoid(12)}`, user.id, personalInfo, languageHabits, writingEnhancements, autoNotes, now],
    });
    return NextResponse.json({
      success: true,
      memory: { personalInfo, languageHabits, writingEnhancements, autoNotes },
    });
  } catch (e) {
    console.error("[user/memory PUT] Error:", e);
    return NextResponse.json({ success: false, error: { message: "保存失败" } }, { status: 500 });
  }
}

// ─── POST /refresh：手动更新记忆 ─────────────────
// 聚合用户全部公文（文档库）/ 已审阅知识库 / AI 聊天历史，调用 LLM 抽取写作偏好，
// 回传抽取结果（不直接落库），由用户在面板中查看、按需修改后保存。
export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  }

  // 1) 解析可用模型（优先用户启用 Key，回退系统 MiniCPM）
  const modelInfo = await resolveMemoryModel(user.id);
  if (!modelInfo) {
    return NextResponse.json(
      { success: false, error: { message: "请先在「系统设置 → API 配置」添加并启用密钥，或配置系统 MiniCPM" } },
      { status: 400 },
    );
  }

  // 2) 聚合材料
  const sourceText = await gatherMemorySources(user.id);

  // 3) 抽取
  try {
    const extracted = await extractMemory({ sourceText, ...modelInfo });
    return NextResponse.json({ success: true, extracted });
  } catch (e) {
    console.error("[user/memory refresh] 抽取失败:", e);
    return NextResponse.json({ success: false, error: { message: "记忆抽取失败" } }, { status: 500 });
  }
}

// 解析用于抽取的模型：返回 { apiKey, baseUrl, model }
async function resolveMemoryModel(userId: string): Promise<{ apiKey: string; baseUrl: string; model: string } | null> {
  try {
    const rows = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, userId), eq(apiKeys.isActive, true)))
      .limit(1);
    if (rows.length > 0) {
      const row = rows[0];
      try {
        const apiKey = decryptApiKey(row.encrypted, row.iv);
        const preset = getProvider(row.provider);
        if (!preset) return null;
        let models: string[] = [];
        try { models = JSON.parse(row.models || "[]"); } catch {}
        const model = row.defaultModel || models[0] || "";
        if (!model) return null;
        return { apiKey, baseUrl: row.baseUrl || preset.baseURL, model };
      } catch {
        return null;
      }
    }
    // 回退系统 MiniCPM
    const sys = await getSystemMiniCPMConfig();
    if (sys && sys.isActive && sys.apiKey) {
      const model = sys.defaultModel || (sys.models && sys.models[0]) || "";
      return { apiKey: sys.apiKey, baseUrl: sys.baseUrl || "", model };
    }
  } catch {
    return null;
  }
  return null;
}

// 聚合用户写作材料：文档库（全部未删除文档）+ 已审阅知识库 + AI 聊天历史
async function gatherMemorySources(userId: string): Promise<string> {
  const parts: string[] = [];
  const MAX = 14000; // 控制总 token，避免过长

  try {
    // 文档库 + 知识库（均来自 documents 表，已审阅=知识库）
    const docs = await db
      .select({ id: documents.id, title: documents.title, content: documents.content, reviewed: documents.reviewed, category: documents.category })
      .from(documents)
      .where(and(eq(documents.userId, userId), isNull(documents.deletedAt)))
      .orderBy(desc(documents.updatedAt))
      .limit(30);
    for (const d of docs) {
      const text = stripHtml(d.content || "");
      if (!text.trim()) continue;
      const tag = d.reviewed ? "【知识库文章】" : "【公文文档】";
      parts.push(`${tag}（${d.category || ""}）标题：${d.title || "（无标题）"}\n${text}`);
    }
  } catch (e) {
    console.error("[gatherMemorySources] 文档查询失败:", e);
  }

  let budget = MAX - parts.join("\n\n").length;
  if (budget > 1000) {
    try {
      const logs = await client.execute({
        sql: "SELECT role, content FROM ai_chat_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 200",
        args: [userId],
      });
      const rows = (logs.rows as any[]) || [];
      const chatLines: string[] = [];
      for (const r of rows) {
        const role = r.role === "user" ? "用户" : "助手";
        const c = stripHtml((r.content as string) || "");
        if (c.trim()) chatLines.push(`${role}：${c}`);
      }
      if (chatLines.length) {
        const chatText = chatLines.join("\n");
        parts.push(`【AI 对话历史】\n${chatText.slice(0, budget)}`);
      }
    } catch (e) {
      console.error("[gatherMemorySources] 聊天历史查询失败:", e);
    }
  }

  return parts.join("\n\n").slice(0, MAX);
}

// 简易 HTML 标签剥离，保留纯文本
function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
