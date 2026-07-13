// ─── AI 公文助手侧栏 ─────────────────────────────
// 模型选择（已启用的 API Key）→ Skill 树状选择器 → 流式对话 → 输出插入/替换/复制
// 选中编辑器文字时浮出操作条（续写/润色/缩写/扩写/解释/翻译）
// Skill 选择在聊天框和文中选单之间复用映射

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorStore } from "@/stores/editor.store";
import { buildSelectionInstruction, ChatMessage } from "@/server/lib/ai/prompts";
import { buildGlobalContext } from "@/lib/ai/context";
import { getGlobalSkills } from "@/lib/global-skill-store";
import { Sparkles, Send, Copy, CornerDownLeft, Replace, X, RefreshCw, AlertCircle, Settings, ChevronDown, ChevronRight, Check, Quote } from "lucide-react";

interface ModelOption {
  provider: string;
  providerLabel: string;
  model: string;
  value: string; // `${provider}::${model}`
}

export function AiAssistant({ editor }: { editor: Editor | null }) {
  const selectedText = useEditorStore((s) => s.selectedText);
  const selectionRect = useEditorStore((s) => s.selectionRect);
  const setSelectedText = useEditorStore((s) => s.setSelectedText);
  const setSelectionRect = useEditorStore((s) => s.setSelectionRect);
  const currentCategory = useEditorStore((s) => s.category); // 当前公文类型

  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [model, setModel] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // 移动端：AI 面板默认隐藏，点击悬浮机器人图标展开为半屏浮层；桌面端保持右侧固定侧栏
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelClass = mobileOpen
    ? "fixed inset-x-0 bottom-0 top-auto z-50 flex flex-col h-[55vh] bg-white border-t border-gray-200 shadow-2xl md:static md:inset-auto md:top-auto md:h-full md:w-80 md:border-t-0 md:border-l md:flex md:flex-col md:shadow-none"
    : "hidden md:flex md:w-80 md:border-l md:flex-col md:flex-shrink-0 bg-white border-gray-200";
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const streamingTextRef = useRef("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // ── Skill 选择器状态 ──
  interface SkillItem {
    id: string;
    name: string;
    content: string;
    category: string;
    isBuiltin: boolean;
  }

  const [allSkills, setAllSkills] = useState<SkillItem[]>([]);
  const [globalSkills, setGlobalSkills] = useState<{ id: string; name: string; content: string; category?: string }[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());
  const [skillTreeOpen, setSkillTreeOpen] = useState<Record<string, boolean>>({});

  // 加载 Skill 列表：DB Skills（按分类） + localStorage 全局 Skills
  useEffect(() => {
    // 加载全局 Skill（localStorage）
    let gSkills: { id: string; name: string; content: string; category?: string }[] = [];
    try { gSkills = getGlobalSkills(); setGlobalSkills(gSkills); } catch {}
    // 加载 DB Skills（全量，前端分组）
    fetch("/api/skills")
      .then((r) => r.json())
      .then((b) => {
        if (b.success && Array.isArray(b.data)) {
          setAllSkills(b.data);
          // 默认勾选：当前公文类型的内置 Skill + 所有全局 Skill
          const defaultIds: string[] = [];
          for (const s of b.data) {
            if (s.isBuiltin && s.category === currentCategory) {
              defaultIds.push(s.id);
            }
          }
          for (const g of gSkills) {
            defaultIds.push(g.id);
          }
          setSelectedSkillIds(new Set(defaultIds));
          // 默认展开所有分类
          const opens: Record<string, boolean> = {};
          const catSet: Set<string> = new Set(b.data.map((s: SkillItem) => s.category));
          for (const c of catSet) {
            opens[c] = true;
          }
          if (gSkills.length > 0) opens["__global__"] = true;
          setSkillTreeOpen(opens);
        }
      })
      .catch(() => {});
  }, []);

  // 按 category 分组的 DB Skills
  const skillsByCategory = useCallback((): Record<string, SkillItem[]> => {
    const map: Record<string, SkillItem[]> = {};
    for (const s of allSkills) {
      (map[s.category] ||= []).push(s);
    }
    return map;
  }, [allSkills]);

  // 构建 Skill 上下文文本（供 AI 调用注入）
  const buildSkillContext = useCallback((): string => {
    const parts: string[] = [];
    // DB 选中的 Skill
    const selectedDb = allSkills.filter((s) => selectedSkillIds.has(s.id));
    if (selectedDb.length > 0) {
      const lines = selectedDb.map((s) => `- ${s.name}（${s.isBuiltin ? "内置" : "自定义"}）：${s.content}`).join("\n");
      parts.push(`【已选写作规范(Skill)，请严格遵循】\n${lines}`);
    }
    // 全局选中的 Skill
    const selectedGlobal = globalSkills.filter((s) => selectedSkillIds.has(s.id));
    if (selectedGlobal.length > 0) {
      const lines = selectedGlobal.map((s) => `- ${s.name}${s.category ? `（${s.category}）` : ""}：${s.content}`).join("\n");
      parts.push(`【全局写作规范(Skill)，请一并遵循】\n${lines}`);
    }
    return parts.join("\n\n");
  }, [allSkills, globalSkills, selectedSkillIds]);

  // 切换 Skill 勾选
  const toggleSkill = (id: string) => {
    setSelectedSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // 切换分类展开/折叠
  const toggleCategory = (cat: string) => {
    setSkillTreeOpen((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  // 加载已启用的模型列表
  useEffect(() => {
    fetch("/api/settings/api-keys")
      .then((r) => r.json())
      .then((b) => {
        if (!b.success) return;
        const opts: ModelOption[] = [];
        for (const k of b.data) {
          if (!k.isActive) continue;
          for (const m of k.models || []) {
            opts.push({ provider: k.provider, providerLabel: k.label, model: m, value: `${k.provider}::${m}` });
          }
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
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streamingText]);

  const streamChat = async (opts: {
    messages: ChatMessage[];
    provider: string;
    model: string;
    systemExtra?: string;
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
  };

  const send = async (userContent: string) => {
    if (!model) {
      setError("请先选择模型（系统设置 → API 配置）");
      return;
    }
    const [provider, modelName] = model.split("::");
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: userContent }];
    setMessages(nextMessages);
    setInput("");
    setStreaming(true);
    setStreamingText("");
    streamingTextRef.current = "";
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      // 合并：画像 + 全局 Skill + 用户选中的分类/全局 Skill
      const ctxParts = [buildGlobalContext(), buildSkillContext()].filter(Boolean);
      const systemExtra = ctxParts.length > 0 ? ctxParts.join("\n\n") : undefined;
      await streamChat({
        messages: nextMessages,
        provider,
        model: modelName,
        systemExtra,
        signal: controller.signal,
        onToken: (t) => {
          streamingTextRef.current += t;
          setStreamingText(streamingTextRef.current);
        },
        onError: (m) => setError(m),
      });
    } catch (e: any) {
      if (e?.name !== "AbortError") setError("生成失败：" + (e?.message || "未知错误"));
    } finally {
      const text = streamingTextRef.current;
      if (text.trim()) {
        setMessages((prev) => [...prev, { role: "assistant", content: text }]);
      }
      setStreamingText("");
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const quickAction = (action: "continue" | "polish" | "shorten" | "expand" | "explain" | "translate") => {
    if (!selectedText) return;
    send(buildSelectionInstruction(action, selectedText));
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    if (selectedText) {
      send(buildSelectionInstruction("custom", selectedText, text));
    } else {
      send(text);
    }
  };

  // 清除已选文本（焦点移到 Chatbox 后仍保留，用户可手动取消）
  const clearSelection = () => {
    setSelectedText("");
    setSelectionRect(null);
  };

  const cancel = () => abortRef.current?.abort();

  const insertAtCursor = () => {
    const text = streamingText || messages[messages.length - 1]?.content || "";
    if (!text || !editor) return;
    // 若存在选区（即本次生成基于选中文字），先折叠到选区末尾再插入（追加），避免覆盖
    editor.chain().focus().setTextSelection(editor.state.selection.to).insertContent(text).run();
  };

  const replaceSelection = () => {
    const text = streamingText || messages[messages.length - 1]?.content || "";
    if (!text || !editor) return;
    editor.chain().focus().insertContent(text).run();
  };

  const copyText = () => {
    const text = streamingText || messages[messages.length - 1]?.content || "";
    if (text) navigator.clipboard?.writeText(text);
  };

  const latestAssistant =
    streamingText || (messages[messages.length - 1]?.role === "assistant" ? messages[messages.length - 1]?.content : "");

  return (
    <>
      <div className={panelClass}>
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-red-500" /> AI 公文助手
        </span>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button onClick={() => { setMessages([]); setStreamingText(""); }} title="新建对话" className="text-gray-400 hover:text-gray-600">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => setMobileOpen(false)} title="收起" className="md:hidden text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 模型选择 */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
        {modelOptions.length === 0 ? (
          <a href="/settings" className="flex items-center gap-1.5 text-[11px] text-red-600 hover:underline">
            <Settings className="w-3 h-3" /> 请先在「系统设置 → API 配置」添加并启用密钥
          </a>
        ) : (
          <select
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              localStorage.setItem("gw2-ai-model", e.target.value);
            }}
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-red-300"
          >
            {modelOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.providerLabel} · {o.model}</option>
            ))}
          </select>
        )}
      </div>

      {/* ═══ Skill 树状选择器（可折叠，多选） ═══ */}
      {(allSkills.length > 0 || globalSkills.length > 0) && (
        <div className="border-b border-gray-100 bg-gray-50/50">
          {/* 折叠头 */}
          <button
            onClick={() => toggleCategory("__skill_panel__")}
            className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100/60 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-red-500" />
              写作规范 Skill
              {selectedSkillIds.size > 0 && (
                <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px]">
                  {selectedSkillIds.size}
                </span>
              )}
            </span>
            {skillTreeOpen["__skill_panel__"] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {/* 树内容 */}
          {skillTreeOpen["__skill_panel__"] && (
            <div className="max-h-48 overflow-y-auto px-2 pb-2 space-y-1">
              {/* ── 全局 Skills（localStorage）── */}
              {globalSkills.length > 0 && (
                <SkillGroup
                  label="全局 Skill"
                  count={globalSkills.length}
                  isOpen={skillTreeOpen["__global__"]}
                  onToggle={() => toggleCategory("__global__")}
                  allSelected={globalSkills.every((s) => selectedSkillIds.has(s.id))}
                  onSelectAll={(select) => {
                    const ids = select ? globalSkills.map((s) => s.id) : globalSkills.map((s) => s.id);
                    setSelectedSkillIds((prev) => {
                      const next = new Set(prev);
                      for (const id of ids) {
                        if (select) next.add(id); else next.delete(id);
                      }
                      return next;
                    });
                  }}
                >
                  {globalSkills.map((s) => (
                    <SkillLeaf
                      key={s.id}
                      name={s.name}
                      checked={selectedSkillIds.has(s.id)}
                      onToggle={() => toggleSkill(s.id)}
                      isGlobal
                    />
                  ))}
                </SkillGroup>
              )}

              {/* ── 按 DB 分类 Skills ── */}
              {Object.entries(skillsByCategory()).map(([cat, skills]) => (
                <SkillGroup
                  key={cat}
                  label={`${cat}类`}
                  count={skills.length}
                  isOpen={skillTreeOpen[cat]}
                  onToggle={() => toggleCategory(cat)}
                  allSelected={skills.every((s) => selectedSkillIds.has(s.id))}
                  onSelectAll={(select) => {
                    const ids = skills.map((s) => s.id);
                    setSelectedSkillIds((prev) => {
                      const next = new Set(prev);
                      for (const id of ids) {
                        if (select) next.add(id); else next.delete(id);
                      }
                      return next;
                    });
                  }}
                >
                  {skills.map((s) => (
                    <SkillLeaf
                      key={s.id}
                      name={s.name}
                      checked={selectedSkillIds.has(s.id)}
                      onToggle={() => toggleSkill(s.id)}
                      isBuiltin={s.isBuiltin}
                    />
                  ))}
                </SkillGroup>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 消息区 */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-3 py-3 space-y-3">
        {messages.length === 0 && !streaming && (
          <div className="text-[11px] text-gray-400 leading-relaxed mt-4">
            在左侧编辑器中选中文字，可一键「续写 / 润色 / 缩写 / 扩写 / 解释 / 翻译」。
            <br />也可直接在下方输入指令进行公文起草与问答。
          </div>
        )}

        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} content={m.content} />
        ))}

        {streaming && <Bubble role="assistant" content={streamingText} streaming />}

        {error && (
          <div className="flex items-start gap-1.5 text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* 输出操作（仅当有结果时） */}
      {latestAssistant && (
        <div className="px-3 py-2 border-t border-gray-100 flex items-center gap-1.5">
          <button onClick={insertAtCursor} disabled={!editor} title="插入到光标处"
            className="flex items-center gap-1 px-2 py-1 text-[11px] bg-blue-50 text-blue-600 rounded hover:bg-blue-100 disabled:opacity-40">
            <CornerDownLeft className="w-3 h-3" /> 插入
          </button>
          <button onClick={replaceSelection} disabled={!editor} title="替换选中文字"
            className="flex items-center gap-1 px-2 py-1 text-[11px] bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-40">
            <Replace className="w-3 h-3" /> 替换
          </button>
          <button onClick={copyText} title="复制结果"
            className="flex items-center gap-1 px-2 py-1 text-[11px] bg-gray-100 text-gray-600 rounded hover:bg-gray-200">
            <Copy className="w-3 h-3" /> 复制
          </button>
        </div>
      )}

      {/* 输入区 */}
      <div className="px-3 py-2 border-t border-gray-200">
        {/* 已选文本指示条：焦点移到 Chatbox 时仍保留，可一键清除 */}
        {selectedText && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 mb-2 rounded-lg bg-[#163f3a]/8 border border-[#163f3a]/15">
            <Quote className="w-3.5 h-3.5 text-[#163f3a] flex-shrink-0" />
            <span className="text-[11px] text-gray-600 truncate flex-1">
              已选 {selectedText.length} 字：{selectedText.slice(0, 36)}{selectedText.length > 36 ? "…" : ""}
            </span>
            <button onClick={clearSelection} title="取消选中" className="flex-shrink-0 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            rows={2}
            placeholder={selectedText ? "输入自定义指令（将作用于选中文字）..." : "输入公文指令或问题..."}
            className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-red-300"
          />
          {streaming ? (
            <button onClick={cancel} title="停止生成"
              className="flex-shrink-0 p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300">
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSend} disabled={!model || !input.trim()}
              title="发送"
              className="flex-shrink-0 p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300">
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 气泡菜单已移至面板之外作为全局浮层，避免被面板的 hidden 影响（见文件末尾） */}
    </div>

      {/* 选中文字浮出操作条（全局浮层，移动端/桌面端共用，不受面板 hidden 影响） */}
      {selectedText && selectionRect && (
        <div
          className="fixed z-[60] flex items-center gap-0.5 bg-gray-900 text-white rounded-lg shadow-lg px-1 py-1 max-w-[90vw] overflow-x-auto"
          style={{ top: Math.min(selectionRect.bottom + 8, (typeof window !== "undefined" ? window.innerHeight : 800) - 44), left: selectionRect.left }}
        >
          <BubbleBtn label="续写" onClick={() => quickAction("continue")} />
          <BubbleBtn label="润色" onClick={() => quickAction("polish")} />
          <BubbleBtn label="缩写" onClick={() => quickAction("shorten")} />
          <BubbleBtn label="扩写" onClick={() => quickAction("expand")} />
          <BubbleBtn label="解释" onClick={() => quickAction("explain")} />
          <BubbleBtn label="翻译" onClick={() => quickAction("translate")} />
        </div>
      )}

      {/* 移动端悬浮 AI 入口（仅 <768px 显示） */}
      {!mobileOpen && (
        <button
          onClick={() => setMobileOpen(true)}
          title="AI 公文助手"
          className="md:hidden fixed bottom-4 right-4 z-40 w-12 h-12 rounded-full bg-red-600 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}
    </>
  );
}

function Bubble({ role, content, streaming }: { role: "user" | "assistant" | "system"; content: string; streaming?: boolean }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[90%] text-xs leading-relaxed rounded-xl px-3 py-2 whitespace-pre-wrap break-words ${
          isUser ? "bg-red-600 text-white" : "bg-gray-100 text-gray-800"
        }`}
      >
        {content}
        {streaming && <span className="inline-block w-1.5 h-3 ml-0.5 bg-gray-400 align-middle animate-pulse" />}
      </div>
    </div>
  );
}

function BubbleBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 px-2 py-1 text-[11px] rounded hover:bg-white/20 whitespace-nowrap"
    >
      {label}
    </button>
  );
}

// ── Skill 树状选择器子组件 ──

function SkillGroup({ label, count, isOpen, onToggle, onSelectAll, allSelected, children }: {
  label: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  onSelectAll: (select: boolean) => void;
  allSelected: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-gray-200/80 bg-white overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
      >
        {isOpen ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
        <span>{label}</span>
        <span className="text-[10px] text-gray-400">({count})</span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSelectAll(!allSelected); }}
          className="text-[10px] px-1.5 py-0.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          {allSelected ? "取消全选" : "全选"}
        </button>
      </button>
      {isOpen && <div className="pl-4 pr-1 pb-1 space-y-0.5 border-t border-gray-100/60">{children}</div>}
    </div>
  );
}

function SkillLeaf({ name, checked, onToggle, isBuiltin, isGlobal }: {
  name: string;
  checked: boolean;
  onToggle: () => void;
  isBuiltin?: boolean;
  isGlobal?: boolean;
}) {
  return (
    <label
      className="flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer hover:bg-red-50/50 transition-colors group"
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={(e) => { e.preventDefault(); onToggle(); }}
        className={`flex items-center justify-center w-3.5 h-3.5 rounded-[3px] border transition-all flex-shrink-0 ${
          checked
            ? "bg-red-500 border-red-500 text-white"
            : "border-gray-300 group-hover:border-red-300"
        }`}
      >
        {checked && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
      </button>
      <span className={`text-[11px] truncate ${checked ? "text-gray-800 font-medium" : "text-gray-500"}`}>
        {name}
      </span>
      {isBuiltin && (
        <span className="text-[9px] px-1 rounded bg-blue-50 text-blue-500 flex-shrink-0">内置</span>
      )}
      {isGlobal && !isBuiltin && (
        <span className="text-[9px] px-1 rounded bg-amber-50 text-amber-600 flex-shrink-0">全局</span>
      )}
    </label>
  );
}
