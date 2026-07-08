// ─── POST /api/ai/chat — 流式公文 AI 对话 ───────
// 1) 校验登录；2) 取该用户指定厂商且启用状态的 API Key 并解密；
// 3) 调用厂商 OpenAI 兼容 /chat/completions（stream:true）；
// 4) 将厂商 SSE 原样透传回前端（text/event-stream）。

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { apiKeys } from "@/server/db/schema";
import { getServerUser } from "@/server/auth/guard";
import { eq, and } from "drizzle-orm";
import { decryptApiKey } from "@/server/lib/crypto";
import { getProvider, isValidProvider } from "@/server/lib/ai/providers";
import { buildSystemPrompt, ChatMessage } from "@/server/lib/ai/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatBody {
  messages?: ChatMessage[];
  provider?: string;
  model?: string;
  /** 客户端拼接的全局上下文（默认画像 + 全局 Skill），追加到系统提示词 */
  systemExtra?: string;
}

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  }

  let body: ChatBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: { message: "请求体解析失败" } }, { status: 400 });
  }

  const { messages, provider, model } = body;

  if (!provider || !isValidProvider(provider)) {
    return NextResponse.json({ success: false, error: { message: "未指定有效厂商" } }, { status: 400 });
  }
  if (!model || typeof model !== "string") {
    return NextResponse.json({ success: false, error: { message: "未指定模型" } }, { status: 400 });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ success: false, error: { message: "消息为空" } }, { status: 400 });
  }

  // 仅保留合法角色，防止注入
  const safeMessages = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content }));

  if (safeMessages.length === 0) {
    return NextResponse.json({ success: false, error: { message: "消息为空" } }, { status: 400 });
  }

  // 查询该用户指定厂商且启用的密钥
  const rows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, user.id), eq(apiKeys.provider, provider), eq(apiKeys.isActive, true)))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json(
      { success: false, error: { message: "该厂商尚未配置或启用 API Key，请到系统设置 → API 配置中添加" } },
      { status: 400 }
    );
  }

  const row = rows[0];
  let apiKey: string;
  try {
    apiKey = decryptApiKey(row.encrypted, row.iv);
  } catch {
    return NextResponse.json({ success: false, error: { message: "密钥解密失败" } }, { status: 500 });
  }

  const preset = getProvider(provider)!;
  const upstreamUrl = `${preset.baseURL}/chat/completions`;

  // 透传 SSE 流（在公文系统提示词基础上追加全局上下文：画像 + 全局 Skill）
  const systemPrompt = buildSystemPrompt(body.systemExtra);
  const payload = JSON.stringify({
    model,
    messages: [{ role: "system", content: systemPrompt }, ...safeMessages],
    stream: true,
    temperature: 0.7,
  });

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: payload,
    });
  } catch (err) {
    console.error("[ai/chat] 上游请求异常:", err);
    return NextResponse.json({ success: false, error: { message: "调用模型服务失败（网络错误）" } }, { status: 502 });
  }

  // 上游返回非 2xx（如 401 密钥错误 / 429 限流 / 模型不存在）
  if (!upstream.ok || !upstream.body) {
    let detail = "";
    try {
      detail = await upstream.text();
      // 截断，避免把长错误回传给前端
      detail = detail.slice(0, 300);
    } catch {}
    console.error(`[ai/chat] 上游错误 ${upstream.status}:`, detail);
    return NextResponse.json(
      { success: false, error: { message: `模型调用失败(${upstream.status})，请检查 API Key 与模型名` } },
      { status: 502 }
    );
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
