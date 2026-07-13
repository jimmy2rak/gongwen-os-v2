// ─── 知识库 AI 问答弹窗 ─────────────────────────
// 知识库页悬浮按钮呼出：支持 @ 选择要问的文章、/ 选择要应用的技能，
// 调用统一的 /api/ai/chat（服务端解析文章内容注入上下文）。

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Sparkles, Send, CornerDownLeft, Copy, Loader2, MessageSquare, Settings, FileText } from "lucide-react";
import { MentionInput, type MentionItem } from "@/components/ai/MentionInput";
import { getGlobalSkills } from "@/lib/global-skill-store";
import type { ChatMessage } from "@/server/lib/ai/prompts";

interface ModelOption {
  provider: string;
  providerLabel: string;
  model: string;
  value: string;
}

interface SkillItem {
  id: string;
  name: string;
  content: string;
  category?: string;
  isBuiltin?: boolean;
}

export function KnowledgeChat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [model, setModel] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [allSkills, setAllSkills] = useState<SkillItem[]>([]);
  const [globalSkills, setGlobalSkills] = useState<{ id: string; name: string; content: string; category?: string }[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());
  const [selectedArticleIds, setSelectedArticleIds] = useState<Set<string>>(new Set());
  const [articleTitles, setArticleTitles] = useState<Record<string, string>>({});

  const abortRef = useRef<AbortController | null>(null);
  const streamingTextRef = useRef("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const resolveArticles = useCallback(async (q: string): Promise<MentionItem[]> => {
    const url = `/api/references?search=${encodeURIComponent(q)}`;
    const b = await (await fetch(url)).json();
    if (!b.success || !Array.isArray(b.data)) return [];
    return b.data.map((d: any) => ({
      id: d.id,
      label: d.title,
      sub: d.category + (d.reviewed ? " · 已审阅" : " · 文档库"),
    }));
  }, []);

  // 技能候选（/ 触发）
  const mentionSkills = allSkills
    .map((s) => ({ id: s.id, label: s.name, sub: s.category }))
    .concat(globalSkills.map((s) => ({ id: s.id, label: s.name, sub: s.category || "全局" })));

  // 加载模型、技能
  useEffect(() => {
    if (!open) return;
    let gSkills: { id: string; name: string; content: string; category?: string }[] = [];
    try { gSkills = getGlobalSkills(); setGlobalSkills(gSkills); } catch {}
    fetch("/api/skills")
      .then((r) => r.json())
      .then((b) => {
        if (b.success && Array.isArray(b.data)) {
          setAllSkills(b.data);
          const ids = new Set<string>(gSkills.map((s) => s.id));
          for (const s of b.data) if (s.isBuiltin) ids.add(s.id);
          setSelectedSkillIds(ids);
        }
      })
      .catch(() => {});
    fetch("/api/settings/api-keys")
      .then((r) => r.json())
      .then((b) => {
        if (!b.success) return;
        const opts: ModelOption[] = [];
        for (const k of b.data) {
          if (!k.isActive) continue;
          for (const m of k.models || []) opts.push({ provider: k.provider, providerLabel: k.label, model: m, value: `${k.provider}::${m}` });
        }
        setModelOptions(opts);
        if (opts.length === 0) return;
        const saved = typeof window !== "undefined" ? localStorage.getItem("gw2-ai-model") : null;
        const savedOpt = opts.find((o) => o.value === saved);
        if (savedOpt) { setModel(savedOpt.value); return; }
        const def = opts.find((o) => (b.data.find((k: any) => k.provider === o.provider)?.defaultModel) === o.model);
        setModel(def ? def.value : opts[0].value);
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streamingText]);

  const buildSkillContext = useCallback((): string => {
    const parts: string[] = [];
    const selDb = allSkills.filter((s) => selectedSkillIds.has(s.id));
    if (selDb.length > 0) {
      parts.push(`【已选写作规范(Skill)，请严格遵循】\n${selDb.map((s) => `- ${s.name}：${s.content}`).join("\n")}`);
    }
    const selG = globalSkills.filter((s) => selectedSkillIds.has(s.id));
    if (selG.length > 0) {
      parts.push(`【全局写作规范(Skill)，请一并遵循】\n${selG.map((s) => `- ${s.name}：${s.content}`).join("\n")}`);
    }
    return parts.join("\n\n");
  }, [allSkills, globalSkills, selectedSkillIds]);

  const streamChat = async (opts: {
    messages: ChatMessage[];
    provider: string;
    model: string;
    systemExtra?: string;
    articleIds?: string[];
    signal: AbortSignal;
    onToken: (t: string) => void;
    onError: (m: string) => void;
  }) => {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: opts.messages,
        provider: opts.provider,
        model: opts.model,
        systemExtra: opts.systemExtra,
        articleIds: opts.articleIds || [],
      }),
      signal: opts.signal,
    });
    if (!res.ok || !res.body) {
      let msg = `请求失败 (${res.status})`;
      try { const j = await res.json(); if (j?.error?.message) msg = j.error.message; } catch {}
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
  };

  const send = async (userContent: string) => {
    if (!model) { setError("请先选择模型（系统设置 → API 配置）"); return; }
    const text = userContent.trim();
    if (!text) return;
    const [provider, modelName] = model.split("::");
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setStreaming(true);
    setStreamingText("");
    streamingTextRef.current = "";
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const ctx = buildSkillContext();
      await streamChat({
        messages: next,
        provider,
        model: modelName,
        systemExtra: ctx || undefined,
        articleIds: [...selectedArticleIds],
        signal: controller.signal,
        onToken: (t) => { streamingTextRef.current += t; setStreamingText(streamingTextRef.current); },
        onError: (m) => setError(m),
      });
    } catch (e: any) {
      if (e?.name !== "AbortError") setError("生成失败：" + (e?.message || "未知错误"));
    } finally {
      const txt = streamingTextRef.current;
      if (txt.trim()) setMessages((prev) => [...prev, { role: "assistant" as const, content: txt }]);
      setStreamingText("");
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const handleSend = (raw?: string) => send(raw ?? input);

  const cancel = () => abortRef.current?.abort();
  const latest = streamingText || (messages[messages.length - 1]?.role === "assistant" ? messages[messages.length - 1]?.content : "");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center sm:justify-center bg-black/30" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg h-[78vh] sm:h-[70vh] bg-white flex flex-col rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-red-500" /> 知识库 AI 问答
          </span>
          <div className="flex items-center gap-2">
            {modelOptions.length === 0 ? (
              <a href="/settings" className="flex items-center gap-1 text-[11px] text-red-600 hover:underline">
                <Settings className="w-3 h-3" /> 配置密钥
              </a>
            ) : (
              <select
                value={model}
                onChange={(e) => { setModel(e.target.value); localStorage.setItem("gw2-ai-model", e.target.value); }}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-red-300"
              >
                {modelOptions.map((o) => (<option key={o.value} value={o.value}>{o.providerLabel} · {o.model}</option>))}
              </select>
            )}
            <button onClick={onClose} title="关闭" className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* 已选引用：文章 chips + 技能数 */}
        {(selectedArticleIds.size > 0 || selectedSkillIds.size > 0) && (
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/60 flex flex-wrap gap-1.5">
            {[...selectedArticleIds].map((id) => (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full bg-[#163f3a]/10 text-[#163f3a]">
                <FileText className="w-3 h-3" />
                {articleTitles[id] || "文章"}
                <button onClick={() => { setSelectedArticleIds((p) => { const n = new Set(p); n.delete(id); return n; }); }} className="hover:text-red-600"><X className="w-2.5 h-2.5" /></button>
              </span>
            ))}
            {selectedSkillIds.size > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full bg-red-50 text-red-600">
                <Sparkles className="w-3 h-3" /> {selectedSkillIds.size} 个技能
              </span>
            )}
          </div>
        )}

        {/* 消息区 */}
        <div ref={scrollRef} className="flex-1 overflow-auto px-3 py-3 space-y-3">
          {messages.length === 0 && !streaming && (
            <div className="text-[11px] text-gray-400 leading-relaxed mt-4">
              可输入 <span className="text-[#163f3a]">@</span> 选择要问的文章，<span className="text-red-500">/</span> 选择要应用的写作技能。
              <br />例如：「@某公文 帮我总结其核心观点，按 /总结要点 的风格输出」。
            </div>
          )}
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} content={m.content} />
          ))}
          {streaming && <Bubble role="assistant" content={streamingText} streaming />}
          {error && (
            <div className="flex items-start gap-1.5 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-2">
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* 输入区 */}
        <div className="px-3 py-2 border-t border-gray-200">
          <MentionInput
            value={input}
            onChange={setInput}
            onSend={handleSend}
            disabled={streaming}
            placeholder="输入问题…（@ 选文章，/ 选技能）"
            resolveArticles={async (q) => {
              const items = await resolveArticles(q);
              // 缓存标题供 chips 显示
              setArticleTitles((prev) => {
                const n = { ...prev };
                for (const it of items) { if (!(it.id in n)) n[it.id] = it.label; }
                return n;
              });
              return items;
            }}
            skills={mentionSkills}
            onPickArticle={(id) => setSelectedArticleIds((p) => new Set(p).add(id))}
            onPickSkill={(id) => setSelectedSkillIds((p) => new Set(p).add(id))}
          />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-gray-300">Enter 发送 · Shift+Enter 换行</span>
            {streaming ? (
              <button onClick={cancel} className="flex-shrink-0 px-3 py-1.5 text-xs bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300">停止</button>
            ) : (
              <button onClick={() => handleSend()} disabled={!model || !input.trim()} className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300">
                <Send className="w-3.5 h-3.5" /> 发送
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ role, content, streaming }: { role: "user" | "assistant" | "system"; content: string; streaming?: boolean }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[90%] text-xs leading-relaxed rounded-xl px-3 py-2 whitespace-pre-wrap break-words ${isUser ? "bg-red-600 text-white" : "bg-gray-100 text-gray-800"}`}>
        {content}
        {streaming && <span className="inline-block w-1.5 h-3 ml-0.5 bg-gray-400 align-middle animate-pulse" />}
      </div>
    </div>
  );
}
