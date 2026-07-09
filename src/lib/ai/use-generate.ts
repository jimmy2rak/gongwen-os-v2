// ─── 一键初稿生成 Hook ──────────────────────────
// 封装模型选择 + 流式生成，供「出稿 / 大纲」页复用。
// 自动注入全局上下文（画像 + 全局 Skill + 分类 Skill）。

"use client";

import { useState, useRef } from "react";
import { streamChat } from "@/lib/ai/stream-client";
import { useAiModel } from "@/lib/ai/use-ai-model";
import type { ChatMessage } from "@/server/lib/ai/prompts";

export function useGenerate() {
  const { options, model, setModel, loading } = useAiModel();
  const [streaming, setStreaming] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * 执行流式生成。
   * @param userPrompt 用户输入的提示词
   * @param category 公文分类（可选，传入后将自动注入该分类的 DB Skill）
   * @param extraSystemExtra 额外追加到 system prompt 的上下文文本（如用户勾选的 Skill）
   */
  const run = async (userPrompt: string, category?: string, extraSystemExtra?: string) => {
    if (!model) {
      setError("请先在「系统设置 → API 配置」添加并启用密钥");
      return;
    }
    const [provider, modelName] = model.split("::");
    setStreaming(true);
    setText("");
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamChat({
        messages: [{ role: "user", content: userPrompt } as ChatMessage],
        provider,
        model: modelName,
        signal: controller.signal,
        onToken: (t) => setText((prev) => prev + t),
        onError: (m) => setError(m),
        category, // ← 注入分类 Skill
        extraSystemExtra,
      });
    } catch (e: any) {
      if (e?.name !== "AbortError") setError("生成失败：" + (e?.message || "未知错误"));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const cancel = () => abortRef.current?.abort();

  return { options, model, setModel, loading, streaming, text, error, run, cancel };
}
