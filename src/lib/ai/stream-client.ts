// ─── 流式对话客户端（SSE 解析） ─────────────────
// 供「一键初稿」各页 + AI 助手复用：与 /api/ai/chat 一致。
// 支持 systemExtra（画像+全局Skill+分类Skill）。

"use client";

import type { ChatMessage } from "@/server/lib/ai/prompts";
import { buildGlobalContext, buildCategoryContext } from "@/lib/ai/context";

export interface StreamChatOptions {
  messages: ChatMessage[];
  provider: string;
  model: string;
  /** 是否自动注入全局上下文（画像+全局 Skill），默认 true */
  useGlobalContext?: boolean;
  /** 公文分类：自动从 DB 获取该分类的 Skill 并注入 systemExtra */
  category?: string;
  /** 额外追加到 system prompt 的文本（优先级最高，覆盖/追加在分类上下文之后） */
  extraSystemExtra?: string;
  signal: AbortSignal;
  onToken: (t: string) => void;
  onError: (m: string) => void;
}

export async function streamChat(opts: StreamChatOptions): Promise<void> {
  // 构建完整的 systemExtra
  let systemExtra = opts.useGlobalContext === false ? "" : buildGlobalContext();

  // 如果指定了分类且未提供额外 Skill 上下文，异步获取分类 Skill 并追加
  if (opts.category && !opts.extraSystemExtra) {
    try {
      const catCtx = await buildCategoryContext(opts.category);
      if (catCtx) {
        systemExtra = [systemExtra, catCtx].filter(Boolean).join("\n\n");
      }
    } catch { /* 分类 Skill 获取失败不阻断 */ }
  }

  // 追加用户额外指定的上下文（如手动勾选的 Skill）
  if (opts.extraSystemExtra) {
    systemExtra = [systemExtra, opts.extraSystemExtra].filter(Boolean).join("\n\n");
  }

  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: opts.messages,
      provider: opts.provider,
      model: opts.model,
      ...(systemExtra ? { systemExtra } : {}),
    }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    let msg = `请求失败 (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error?.message) msg = j.error.message;
    } catch {}
    opts.onError(msg);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) opts.onToken(delta);
      } catch {}
    }
  }
}
