// ─── POST /api/quotations/classify ───────────────
// AI 一键分类：读取当前账号金句 + 已有分类清单，调用 LLM 为每条金句归类，
// 返回建议（不落库）。前端预览、微调后再调用 PATCH /api/quotations 保存。
// body: { onlyUncategorized?: boolean }  默认 false（对全部金句给出建议）

import { NextRequest, NextResponse } from "next/server";
import { client, db } from "@/server/db";
import { getServerUser } from "@/server/auth/guard";
import { eq, and } from "drizzle-orm";
import { apiKeys } from "@/server/db/schema";
import { decryptApiKey } from "@/server/lib/crypto";
import { getProvider } from "@/server/lib/ai/providers";
import { getSystemMiniCPMConfig } from "@/server/lib/ai/system-minicpm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUOTES = 80;

function parseCategories(raw: string | null | undefined): string[] {
  const v = String(raw || "").trim();
  if (!v) return [];
  if (v.startsWith("[")) {
    try { return JSON.parse(v); } catch { return v ? [v] : []; }
  }
  return [v];
}

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const onlyUncategorized = body.onlyUncategorized === true;

  // 读取金句
  let sql = `SELECT id, content, category, source_title FROM quotations WHERE user_id = ?`;
  const args: string[] = [user.id];
  if (onlyUncategorized) sql += ` AND category = ''`;
  sql += ` ORDER BY created_at DESC LIMIT ${MAX_QUOTES}`;
  let quotes: { id: string; content: string; category: string; sourceTitle: string }[] = [];
  try {
    const res = await client.execute({ sql, args });
    quotes = ((res.rows as any[]) || []).map((r) => ({
      id: String(r.id),
      content: String(r.content || ""),
      category: String(r.category || ""),
      sourceTitle: String(r.source_title || ""),
    }));
  } catch (e) {
    console.error("[classify] 读取金句失败:", e);
    return NextResponse.json({ success: false, error: { message: "读取金句失败" } }, { status: 500 });
  }
  if (quotes.length === 0) {
    return NextResponse.json({ success: false, error: { message: onlyUncategorized ? "没有未分类的金句" : "金句库为空" } }, { status: 400 });
  }

  // 读取已有分类
  let categories: string[] = [];
  try {
    await client.execute({
      sql: `CREATE TABLE IF NOT EXISTS quote_categories (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL)`,
      args: [],
    });
    const cRes = await client.execute({ sql: `SELECT name FROM quote_categories WHERE user_id = ? ORDER BY created_at ASC`, args: [user.id] });
    categories = ((cRes.rows as any[]) || []).map((r) => String(r.name)).filter(Boolean);
  } catch { /* 忽略，AI 可自行归纳 */ }

  const modelInfo = await resolveModel(user.id);
  if (!modelInfo) {
    return NextResponse.json(
      { success: false, error: { message: "请先在「系统设置 → API 配置」添加并启用密钥，或配置系统 MiniCPM" } },
      { status: 400 },
    );
  }

  const prompt = buildPrompt(quotes, categories);
  try {
    const raw = await callLLM(modelInfo, prompt);
    if (!raw) return NextResponse.json({ success: false, error: { message: "分类失败（模型无返回）" } }, { status: 500 });
    const parsed = parseAssignments(raw);
    if (!parsed || parsed.length === 0) {
      return NextResponse.json({ success: false, error: { message: "模型返回无法解析，请重试" } }, { status: 500 });
    }
    // 只保留合法 id，并回填内容/来源，方便前端预览
    const byId = new Map(quotes.map((q) => [q.id, q]));
    const suggestions = parsed
      .filter((p) => byId.has(p.id))
      .map((p) => {
        const q = byId.get(p.id)!;
        return { id: q.id, content: q.content, sourceTitle: q.sourceTitle, oldCategories: parseCategories(q.category), categories: p.categories };
      });
    // 汇总建议出现的新分类（不在已有清单中的）
    const newCats = Array.from(
      new Set(suggestions.flatMap((s) => s.categories).filter((c) => c && !categories.includes(c)))
    );
    return NextResponse.json({ success: true, suggestions, newCategories: newCats, existingCategories: categories });
  } catch (e) {
    console.error("[classify] 调用模型失败:", e);
    return NextResponse.json({ success: false, error: { message: "调用模型失败" } }, { status: 500 });
  }
}

function buildPrompt(quotes: { id: string; content: string }[], categories: string[]): string {
  const catLine = categories.length > 0
    ? `已有分类（请优先复用）：${categories.join("、")}`
    : `目前没有已有分类，请你归纳出简洁、通用的分类。`;
  const list = quotes.map((q) => `[id=${q.id}] ${q.content}`).join("\n");
  return (
    `你是资深中文党政机关公文写作助手。请为下列"金句"逐条归类，允许一条金句同时属于多个分类。\n` +
    `${catLine}\n` +
    `分类规则：\n` +
    `1. 优先使用已有分类；确有必要才新增分类。\n` +
    `2. 分类名简洁规范（2-6 个汉字），如"党的政策""工作作风""乡村振兴""基层治理""担当作为""为民服务"等。\n` +
    `3. 一条金句可以归入多个贴切的分类；若没有合适分类，可返回空数组。\n\n` +
    `金句列表：\n${list}\n\n` +
    `请严格只输出一个 JSON 数组，每个元素形如 {"id":"金句id","categories":["分类名1","分类名2"]}，不要输出任何解释或 Markdown 围栏。`
  );
}

function parseAssignments(text: string): { id: string; categories: string[] }[] | null {
  try {
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    let s = fence ? fence[1].trim() : text.trim();
    const start = s.indexOf("[");
    const end = s.lastIndexOf("]");
    if (start >= 0 && end > start) s = s.slice(start, end + 1);
    const arr = JSON.parse(s);
    if (!Array.isArray(arr)) return null;
    return arr
      .filter((x: any) => x && typeof x.id === "string")
      .map((x: any) => {
        let cats: string[] = [];
        if (Array.isArray(x.categories)) {
          cats = x.categories.filter((c: any) => typeof c === "string").map((c: string) => c.trim());
        } else if (typeof x.category === "string") {
          cats = [x.category.trim()];
        } else if (Array.isArray(x.category)) {
          cats = x.category.filter((c: any) => typeof c === "string").map((c: string) => c.trim());
        }
        return { id: x.id, categories: cats };
      });
  } catch {
    return null;
  }
}

// ── 模型解析（用户启用 Key → 系统 MiniCPM），与 generate-from-sources 一致 ──
async function resolveModel(userId: string): Promise<{ apiKey: string; baseUrl: string; model: string } | null> {
  try {
    const rows = await db.select().from(apiKeys).where(and(eq(apiKeys.userId, userId), eq(apiKeys.isActive, true))).limit(1);
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

async function callLLM(modelInfo: { apiKey: string; baseUrl: string; model: string }, prompt: string): Promise<string> {
  const upstreamUrl = `${modelInfo.baseUrl}/chat/completions`;
  const resp = await fetch(upstreamUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${modelInfo.apiKey}` },
    body: JSON.stringify({
      model: modelInfo.model,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      temperature: 0.2,
    }),
  });
  if (!resp.ok) { console.error("[classify] 上游错误", resp.status); return ""; }
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content ?? "";
}
