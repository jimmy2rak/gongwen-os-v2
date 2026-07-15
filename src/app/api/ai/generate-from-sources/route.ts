// ─── POST /api/ai/generate-from-sources ──────────
// 根据用户勾选的来源（知识库 / 文档管理 / 金句库 / 热点推送），
// 聚合材料并调用 LLM 生成「公文模板」或「写作规范 Skill」，
// 返回可直接预览/编辑/保存的文本内容。
// 客户端 templates 页面在新建模板/Skill 弹窗中调用此接口。

import { NextRequest, NextResponse } from "next/server";
import { client, db } from "@/server/db";
import { getServerUser } from "@/server/auth/guard";
import { eq, and, isNull, desc } from "drizzle-orm";
import { documents, hotArticle, apiKeys } from "@/server/db/schema";
import { decryptApiKey } from "@/server/lib/crypto";
import { getProvider } from "@/server/lib/ai/providers";
import { getSystemMiniCPMConfig } from "@/server/lib/ai/system-minicpm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SourceKey = "knowledge" | "documents" | "quotations" | "hotspots";

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const type: "template" | "skill" = body.type === "template" ? "template" : "skill";
  const sources: SourceKey[] = Array.isArray(body.sources)
    ? body.sources.filter((s: string) => ["knowledge", "documents", "quotations", "hotspots"].includes(s))
    : [];
  if (!category) return NextResponse.json({ success: false, error: { message: "请选择公文类型" } }, { status: 400 });
  if (sources.length === 0) return NextResponse.json({ success: false, error: { message: "请至少勾选一个来源" } }, { status: 400 });

  const modelInfo = await resolveModel(user.id);
  if (!modelInfo) {
    return NextResponse.json(
      { success: false, error: { message: "请先在「系统设置 → API 配置」添加并启用密钥，或配置系统 MiniCPM" } },
      { status: 400 },
    );
  }

  const sourceText = await gatherSources(user.id, sources);
  if (!sourceText.trim()) {
    return NextResponse.json({ success: false, error: { message: "所选来源暂无可用的写作材料" } }, { status: 400 });
  }

  const prompt = buildPrompt(type, category, sourceText);
  try {
    const raw = await callLLM(modelInfo, prompt);
    if (!raw) return NextResponse.json({ success: false, error: { message: "生成失败（模型无返回）" } }, { status: 500 });

    let content = raw.trim();
    let name = "";
    if (type === "template") {
      // 期望 JSON；提取首个 { } 块（容忍围栏）
      content = extractJson(raw) || raw.trim();
      if (!content.startsWith("{")) content = raw.trim();
    } else {
      name = `${category}写作规范（AI 生成）`;
    }
    return NextResponse.json({ success: true, content, name, type });
  } catch (e) {
    console.error("[generate-from-sources] 生成失败:", e);
    return NextResponse.json({ success: false, error: { message: "调用模型失败" } }, { status: 500 });
  }
}

// ── 模型解析（用户启用 Key → 系统 MiniCPM）──
async function resolveModel(userId: string): Promise<{ apiKey: string; baseUrl: string; model: string } | null> {
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
      } catch { return null; }
    }
    const sys = await getSystemMiniCPMConfig();
    if (sys && sys.isActive && sys.apiKey) {
      const model = sys.defaultModel || (sys.models && sys.models[0]) || "";
      return { apiKey: sys.apiKey, baseUrl: sys.baseUrl || "", model };
    }
  } catch { return null; }
  return null;
}

// ── 聚合所选来源材料 ──
async function gatherSources(userId: string, sources: SourceKey[]): Promise<string> {
  const parts: string[] = [];
  const MAX = 12000;
  const budgetLeft = () => MAX - parts.join("\n\n").length;

  if (sources.includes("documents") || sources.includes("knowledge")) {
    try {
      const docs = await db
        .select({ title: documents.title, content: documents.content, reviewed: documents.reviewed, category: documents.category })
        .from(documents)
        .where(and(eq(documents.userId, userId), isNull(documents.deletedAt)))
        .orderBy(desc(documents.updatedAt))
        .limit(25);
      for (const d of docs) {
        const tag = d.reviewed ? "【知识库文章】" : "【公文文档】";
        const isKnowledge = sources.includes("knowledge") && d.reviewed;
        const isDoc = sources.includes("documents") && !d.reviewed;
        if (!isKnowledge && !isDoc && !(sources.includes("documents") && sources.includes("knowledge"))) continue;
        const text = stripHtml(d.content || "");
        if (!text.trim()) continue;
        if (text.length > budgetLeft()) break;
        parts.push(`${tag}（${d.category || ""}）标题：${d.title || "（无标题）"}\n${text}`);
      }
    } catch (e) { console.error("[generate-from-sources] 文档查询失败:", e); }
  }

  if (sources.includes("quotations")) {
    try {
      const qRes = await client.execute({
        sql: "SELECT content, category FROM quotations WHERE user_id = ? ORDER BY created_at DESC LIMIT 60",
        args: [userId],
      });
      const qRows = (qRes.rows as any[]) || [];
      if (qRows.length > 0 && budgetLeft() > 300) {
        const qLines = qRows
          .map((r) => `- ${String(r.content || "")}${r.category ? `（${r.category}）` : ""}`)
          .join("\n");
        parts.push(`【金句库（用户精选佳句）】\n${qLines.slice(0, budgetLeft())}`);
      }
    } catch (e) { console.error("[generate-from-sources] 金句查询失败:", e); }
  }

  if (sources.includes("hotspots")) {
    try {
      const rows = await db
        .select({ title: hotArticle.title, contentPlain: hotArticle.contentPlain, columnId: hotArticle.columnId })
        .from(hotArticle)
        .orderBy(desc(hotArticle.createdAt))
        .limit(20);
      for (const r of rows) {
        const text = (r.contentPlain || "").trim();
        if (!text) continue;
        if (text.length > budgetLeft()) break;
        parts.push(`【热点推送文章】标题：${r.title || ""}\n${text}`);
      }
    } catch (e) { console.error("[generate-from-sources] 热点查询失败:", e); }
  }

  return parts.join("\n\n").slice(0, MAX);
}

// ── 提示词构建 ──
function buildPrompt(type: "template" | "skill", category: string, sourceText: string): string {
  const common = `你是资深中文党政机关公文写作专家。下面提供了该用户相关的写作材料（文档库、知识库、金句库、热点推送）。\n请基于这些材料的文风、术语、结构、论证方式与表达习惯，为该公文类型「${category}」生成一份可复用的写作资源。\n\n────── 材料开始 ──────\n${sourceText}\n────── 材料结束 ──────`;
  if (type === "skill") {
    return (
      common +
      `\n\n请生成「${category}」的写作规范（Skill），用 Markdown 编号列表输出，每条一条明确、可操作的写作规则，涵盖：文种适用场景、行文思路、结构框架、标题与句式规范、情态词与语气、常见错误、以及可引用金句库佳句的写法。\n只输出 Markdown 列表本身，不要额外解释。`
    );
  }
  return (
    common +
    `\n\n请生成「${category}」的公文模板，严格只输出一个 JSON 对象（不要任何解释或 Markdown 围栏），结构如下：\n` +
    `{\n  "titlePattern": "关于{topic}的${category}",\n  "sections": ["标题","主送机关","正文","发文机关","成文日期"],\n  "sectionSamples": ["", "", "（基于材料风格的示例正文片段）", "", ""],\n  "structureHint": "（整体结构说明）",\n  "formatRules": ["规则1","规则2"]\n}\nsectionSamples 应与 sections 一一对应，正文示例需贴合材料风格。`
  );
}

// ── 调用 LLM（非流式）──
async function callLLM(modelInfo: { apiKey: string; baseUrl: string; model: string }, prompt: string): Promise<string> {
  const upstreamUrl = `${modelInfo.baseUrl}/chat/completions`;
  const resp = await fetch(upstreamUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${modelInfo.apiKey}` },
    body: JSON.stringify({
      model: modelInfo.model,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      temperature: 0.5,
    }),
  });
  if (!resp.ok) { console.error("[generate-from-sources] 上游错误", resp.status); return ""; }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

// ── 工具 ──
function extractJson(text: string): string | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const s = fence ? fence[1].trim() : text.trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) return s.slice(start, end + 1);
  return null;
}

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
