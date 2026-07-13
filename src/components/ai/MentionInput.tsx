// ─── 提及输入组件（@ 文章 / / 技能）──────────────────
// 在文本框中输入「@」触发文章选择下拉（异步搜索），输入「/」触发技能选择下拉。
// 选中后插入 @标题 / /技能名 标记，并通过 onPickArticle / onPickSkill 回调上报 id。
// 被编辑器 AI 助手与知识库 AI 问答共用。

"use client";

import { useRef, useState, useCallback } from "react";
import { Loader2, FileText, Sparkles } from "lucide-react";

export interface MentionItem {
  id: string;
  label: string;
  sub?: string;
}

interface MentionInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** @ 触发时异步拉取文章列表 */
  resolveArticles: (q: string) => Promise<MentionItem[]>;
  /** 可选技能列表（/ 触发时本地过滤） */
  skills: MentionItem[];
  /** 选中文章回调（上报 id，父组件维护已选集合） */
  onPickArticle: (id: string) => void;
  /** 选中技能回调（父组件维护已选技能集合） */
  onPickSkill: (id: string) => void;
}

interface DropdownState {
  mode: "article" | "skill";
  query: string;
  triggerIndex: number;
  items: MentionItem[];
  active: number;
}

function detectTrigger(value: string, caret: number): { mode: "article" | "skill"; query: string; triggerIndex: number } | null {
  const before = value.slice(0, caret);
  const m = before.match(/(^|\s)([@/])([^\s@/]*)$/);
  if (!m) return null;
  return {
    mode: m[2] === "@" ? "article" : "skill",
    query: m[3],
    triggerIndex: caret - m[3].length - 1,
  };
}

export function MentionInput({
  value,
  onChange,
  onSend,
  placeholder,
  disabled,
  resolveArticles,
  skills,
  onPickArticle,
  onPickSkill,
}: MentionInputProps) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [dropdown, setDropdown] = useState<DropdownState | null>(null);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadArticles = useCallback(
    (query: string, triggerIndex: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setLoadingArticles(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const items = await resolveArticles(query);
          setDropdown((d) => (d && d.triggerIndex === triggerIndex ? { ...d, items, active: 0 } : d));
        } catch {
          setDropdown((d) => (d && d.triggerIndex === triggerIndex ? { ...d, items: [], active: 0 } : d));
        } finally {
          setLoadingArticles(false);
        }
      }, 200);
    },
    [resolveArticles],
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    const caret = e.target.selectionStart ?? v.length;
    onChange(v);
    const t = detectTrigger(v, caret);
    if (!t) {
      setDropdown(null);
      return;
    }
    if (t.mode === "article") {
      setDropdown({ mode: "article", query: t.query, triggerIndex: t.triggerIndex, items: [], active: 0 });
      loadArticles(t.query, t.triggerIndex);
    } else {
      const q = t.query.toLowerCase();
      const items = skills
        .filter((s) => s.label.toLowerCase().includes(q) || (s.sub || "").toLowerCase().includes(q))
        .slice(0, 8);
      setDropdown({ mode: "skill", query: t.query, triggerIndex: t.triggerIndex, items, active: 0 });
    }
  };

  const pick = (item: MentionItem | undefined) => {
    if (!item || !dropdown) return;
    const ta = taRef.current;
    if (!ta) return;
    const full = ta.value;
    const caret = ta.selectionStart ?? full.length;
    const before = full.slice(0, dropdown.triggerIndex);
    const after = full.slice(caret);
    const token = (dropdown.mode === "article" ? "@" : "/") + item.label + " ";
    const nv = before + token + after;
    onChange(nv);
    if (dropdown.mode === "article") onPickArticle(item.id);
    else onPickSkill(item.id);
    setDropdown(null);
    requestAnimationFrame(() => {
      const pos = before.length + token.length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (dropdown && dropdown.items.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setDropdown((d) => (d ? { ...d, active: Math.min(d.active + 1, d.items.length - 1) } : d));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setDropdown((d) => (d ? { ...d, active: Math.max(d.active - 1, 0) } : d));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        pick(dropdown.items[dropdown.active]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDropdown(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const ta = taRef.current;
      onSend(ta ? ta.value : value);
    }
  };

  return (
    <div className="relative">
      {dropdown && (
        <div className="absolute bottom-full mb-1 left-0 right-0 z-50 max-h-56 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="px-3 py-1.5 text-[10px] text-gray-400 border-b border-gray-100 flex items-center gap-1">
            {dropdown.mode === "article" ? (
              <>
                <FileText className="w-3 h-3" /> 选择要询问的文章（@）
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3" /> 选择要应用的技能（/）
              </>
            )}
          </div>
          {loadingArticles && dropdown.mode === "article" ? (
            <div className="px-3 py-3 text-xs text-gray-400 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> 加载文章…
            </div>
          ) : dropdown.items.length === 0 ? (
            <div className="px-3 py-3 text-xs text-gray-400">无匹配项</div>
          ) : (
            dropdown.items.map((it, i) => (
              <button
                key={it.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(it);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50 ${
                  i === dropdown.active ? "bg-gray-50" : ""
                }`}
              >
                {dropdown.mode === "article" ? (
                  <FileText className="w-3.5 h-3.5 text-[#163f3a] flex-shrink-0" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                )}
                <span className="truncate flex-1">
                  {dropdown.mode === "article" ? "@" : "/"}
                  {it.label}
                </span>
                {it.sub && <span className="text-[10px] text-gray-300 truncate max-w-[40%]">{it.sub}</span>}
              </button>
            ))
          )}
        </div>
      )}
      <textarea
        ref={taRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={2}
        disabled={disabled}
        placeholder={placeholder || "输入问题…（@ 选择文章，/ 选择技能）"}
        className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-red-300 disabled:opacity-40"
      />
    </div>
  );
}
