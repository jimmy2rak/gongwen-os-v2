// ─── 金句库视图 ───────────────────────────────────
// 特性：
//  1. 按来源文章归口成「一级文章展开菜单」，默认全部展开。
//  2. 分类 tab（全部 + 用户自定义分类）过滤；「全部」下按文章归口展示全部金句。
//  3. 每条金句卡片：日期左侧显示分类小标签；点击标签可就地改分类。
//  4. AI 一键分类：调用 /api/quotations/classify 得到建议 → 预览弹窗可微调 → 保存。
//  5. 自定义分类管理：新建 / 删除分类。

"use client";

import { useMemo, useState } from "react";
import {
  Quote as QuoteIcon, FileText, Trash2, MapPin, ChevronDown, ChevronRight,
  Sparkles, Tag, Plus, X, Loader2, Check, Settings2,
} from "lucide-react";
import type { Quote } from "@/lib/quotations/types";
import { useQuoteCategories, categoryColor } from "@/lib/quotations/use-categories";

interface Props {
  quotes: Quote[];
  loading: boolean;
  onDelete: (id: string) => void;
  onLocate: (q: Quote) => void;
  onSetCategory: (id: string, category: string) => Promise<any>;
  onApplyCategories: (items: { id: string; category: string }[]) => Promise<any>;
  onReloadQuotes: () => void;
  showToast: (type: "success" | "error", msg: string) => void;
}

interface Suggestion {
  id: string;
  content: string;
  sourceTitle: string;
  oldCategory: string;
  category: string;
}

const NO_SOURCE_KEY = "__manual__";

export function QuoteLibrary({
  quotes, loading, onDelete, onLocate, onSetCategory, onApplyCategories, onReloadQuotes, showToast,
}: Props) {
  const { categories, addCategory, deleteCategory, load: reloadCats } = useQuoteCategories();
  const [activeCat, setActiveCat] = useState<string>(""); // "" = 全部
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({}); // 默认全展开，仅记录被折叠的
  const [editingId, setEditingId] = useState<string | null>(null); // 正在就地改分类的金句

  // 分类管理弹窗
  const [manageOpen, setManageOpen] = useState(false);

  // AI 一键分类弹窗
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [aiNewCats, setAiNewCats] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const catNames = categories.map((c) => c.name);

  // 未分类数量
  const uncategorizedCount = quotes.filter((q) => !q.category).length;

  // 当前 tab 过滤后的金句
  const filtered = useMemo(() => {
    if (!activeCat) return quotes;
    if (activeCat === "__uncat__") return quotes.filter((q) => !q.category);
    return quotes.filter((q) => q.category === activeCat);
  }, [quotes, activeCat]);

  // 按来源文章归口
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; title: string; sourceType: string; sourceId: string; items: Quote[] }>();
    for (const q of filtered) {
      const key = q.sourceId ? `${q.sourceType}:${q.sourceId}` : NO_SOURCE_KEY;
      if (!map.has(key)) {
        map.set(key, {
          key,
          title: q.sourceId ? (q.sourceTitle || "未命名来源") : "手动录入 / 无来源",
          sourceType: q.sourceType,
          sourceId: q.sourceId,
          items: [],
        });
      }
      map.get(key)!.items.push(q);
    }
    // 按组内最新金句时间倒序
    return Array.from(map.values()).sort((a, b) => {
      const ta = Math.max(...a.items.map((x) => x.createdAt));
      const tb = Math.max(...b.items.map((x) => x.createdAt));
      return tb - ta;
    });
  }, [filtered]);

  const toggleGroup = (key: string) => setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  // ── AI 一键分类 ──
  const runAiClassify = async () => {
    setAiOpen(true);
    setAiLoading(true);
    setSuggestions([]);
    try {
      const r = await fetch("/api/quotations/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onlyUncategorized: false }),
      });
      const b = await r.json();
      if (b.success) {
        setSuggestions(b.suggestions || []);
        setAiNewCats(b.newCategories || []);
      } else {
        showToast("error", b.error?.message || "AI 分类失败");
        setAiOpen(false);
      }
    } catch {
      showToast("error", "网络错误");
      setAiOpen(false);
    } finally {
      setAiLoading(false);
    }
  };

  const changeSuggestion = (id: string, category: string) => {
    setSuggestions((s) => s.map((x) => (x.id === id ? { ...x, category } : x)));
  };

  const saveSuggestions = async () => {
    setSaving(true);
    try {
      // 先落地建议中出现的新分类，方便后续 tab 中出现
      const finalCats = Array.from(new Set(suggestions.map((s) => s.category).filter(Boolean)));
      const toCreate = finalCats.filter((c) => !catNames.includes(c));
      for (const c of toCreate) await addCategory(c);
      // 只保存有变化的
      const items = suggestions
        .filter((s) => (s.category || "") !== (s.oldCategory || ""))
        .map((s) => ({ id: s.id, category: s.category }));
      if (items.length > 0) {
        const b = await onApplyCategories(items);
        if (!b.success) { showToast("error", "保存失败"); setSaving(false); return; }
      }
      await reloadCats();
      showToast("success", `已归类 ${items.length} 条金句`);
      setAiOpen(false);
    } finally {
      setSaving(false);
    }
  };

  // ── 就地改分类 ──
  const handleSetCategory = async (id: string, cat: string) => {
    setEditingId(null);
    await onSetCategory(id, cat);
    await reloadCats();
  };

  if (loading) return <div className="text-center py-16 text-sm text-gray-400">加载中...</div>;

  return (
    <>
      {/* 工具条：AI 一键分类 + 分类管理 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex flex-wrap gap-1.5 items-center">
          <button onClick={() => setActiveCat("")}
            className={`px-2.5 py-1 text-[11px] rounded-full transition-colors ${!activeCat ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
            全部 <span className="opacity-70">({quotes.length})</span>
          </button>
          {uncategorizedCount > 0 && (
            <button onClick={() => setActiveCat("__uncat__")}
              className={`px-2.5 py-1 text-[11px] rounded-full transition-colors ${activeCat === "__uncat__" ? "bg-gray-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
              未分类 <span className="opacity-70">({uncategorizedCount})</span>
            </button>
          )}
          {categories.map((c) => (
            <button key={c.id} onClick={() => setActiveCat(activeCat === c.name ? "" : c.name)}
              className={`px-2.5 py-1 text-[11px] rounded-full transition-colors flex items-center gap-1 ${activeCat === c.name ? "text-white font-medium" : "text-gray-600 hover:bg-gray-100"}`}
              style={activeCat === c.name ? { backgroundColor: categoryColor(c.name, c.color) } : {}}>
              {c.name}{c.count > 0 && <span className="text-[9px] opacity-70">({c.count})</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={runAiClassify} title="AI 一键分类"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-violet-500 text-white rounded-lg hover:bg-violet-600">
            <Sparkles className="w-3.5 h-3.5" /> AI 一键分类
          </button>
          <button onClick={() => setManageOpen(true)} title="自定义分类"
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
            <Settings2 className="w-3.5 h-3.5" /> 自定义分类
          </button>
        </div>
      </div>

      {/* 分组列表 */}
      {quotes.length === 0 ? (
        <div className="text-center py-16 bg-gray-50/80 rounded-xl border border-dashed border-gray-200">
          <QuoteIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">金句库为空</p>
          <p className="text-xs text-gray-300 mt-1">在文档/热点中选中文字可添加金句，或点击右上角「手动录入」</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 bg-gray-50/80 rounded-xl border border-dashed border-gray-200">
          <Tag className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">该分类下暂无金句</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const isCollapsed = !!collapsed[g.key];
            return (
              <div key={g.key} className="bg-white rounded-xl border border-[#e7e2d8] overflow-hidden">
                {/* 一级文章展开菜单 */}
                <button onClick={() => toggleGroup(g.key)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-amber-50/40 transition-colors text-left">
                  {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                  <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-700 truncate flex-1">{g.title}</span>
                  <span className="text-[10px] text-gray-400 bg-gray-100 rounded-full px-2 py-0.5 flex-shrink-0">{g.items.length} 句</span>
                </button>

                {/* 金句卡片 */}
                {!isCollapsed && (
                  <div className="divide-y divide-gray-50 border-t border-gray-100">
                    {g.items.map((q) => (
                      <div key={q.id} className="flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50/60 transition-colors group">
                        <div className="w-1 self-stretch rounded-full flex-shrink-0 bg-amber-400" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-800 leading-relaxed cursor-pointer line-clamp-2"
                            onClick={() => onLocate(q)} title="点击定位到原文档">
                            “{q.content}”
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400 flex-wrap relative">
                            {/* 日期左侧的分类小标签（可点击改分类） */}
                            {editingId === q.id ? (
                              <CategoryPicker
                                current={q.category}
                                categories={catNames}
                                onPick={(c) => handleSetCategory(q.id, c)}
                                onClose={() => setEditingId(null)}
                              />
                            ) : (
                              <button onClick={() => setEditingId(q.id)} title="点击修改分类"
                                className="flex items-center gap-0.5 rounded px-1.5 py-0.5 hover:opacity-80 transition-opacity"
                                style={q.category
                                  ? { backgroundColor: `${categoryColor(q.category, categories.find((c) => c.name === q.category)?.color)}18`, color: categoryColor(q.category, categories.find((c) => c.name === q.category)?.color) }
                                  : { backgroundColor: "#f3f4f6", color: "#9ca3af" }}>
                                <Tag className="w-2.5 h-2.5" />
                                {q.category || "未分类"}
                              </button>
                            )}
                            <span>{new Date(q.createdAt * 1000).toLocaleDateString("zh-CN")}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => onLocate(q)} title="定位原文档"
                            className="p-1.5 rounded text-gray-400 hover:text-[#163f3a] hover:bg-[#163f3a]/5">
                            <MapPin className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onDelete(q.id)} title="删除金句"
                            className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 分类管理弹窗 */}
      {manageOpen && (
        <CategoryManageDialog
          categories={categories}
          onClose={() => setManageOpen(false)}
          onAdd={async (name) => {
            const b = await addCategory(name);
            if (b.success) showToast("success", b.existed ? "分类已存在" : "分类已创建");
            else showToast("error", b.error?.message || "创建失败");
          }}
          onDelete={async (id, name) => {
            const b = await deleteCategory(id);
            if (b.success) { showToast("success", `已删除分类「${name}」`); onReloadQuotes(); }
            else showToast("error", "删除失败");
          }}
        />
      )}

      {/* AI 一键分类预览弹窗 */}
      {aiOpen && (
        <AiClassifyDialog
          loading={aiLoading}
          saving={saving}
          suggestions={suggestions}
          newCats={aiNewCats}
          existingCats={catNames}
          onChange={changeSuggestion}
          onClose={() => setAiOpen(false)}
          onSave={saveSuggestions}
        />
      )}
    </>
  );
}

// ── 就地分类选择器（下拉） ──
function CategoryPicker({ current, categories, onPick, onClose }: {
  current: string; categories: string[]; onPick: (c: string) => void; onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute z-50 top-5 left-0 w-40 max-h-56 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1">
        <button onClick={() => onPick("")}
          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-1.5 ${!current ? "text-amber-600 font-medium" : "text-gray-500"}`}>
          {!current && <Check className="w-3 h-3" />} 未分类
        </button>
        {categories.length === 0 && (
          <div className="px-3 py-2 text-[10px] text-gray-300">暂无分类，请先「自定义分类」</div>
        )}
        {categories.map((c) => (
          <button key={c} onClick={() => onPick(c)}
            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-1.5 ${current === c ? "text-amber-600 font-medium" : "text-gray-600"}`}>
            {current === c && <Check className="w-3 h-3" />} {c}
          </button>
        ))}
      </div>
    </>
  );
}

// ── 分类管理弹窗 ──
function CategoryManageDialog({ categories, onClose, onAdd, onDelete }: {
  categories: { id: string; name: string; color: string; count: number }[];
  onClose: () => void;
  onAdd: (name: string) => Promise<void>;
  onDelete: (id: string, name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const v = name.trim();
    if (!v) return;
    setBusy(true);
    await onAdd(v);
    setName("");
    setBusy(false);
  };
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Tag className="w-4 h-4 text-amber-500" /> 自定义分类</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="输入分类名（如：党的政策）"
            className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
          <button onClick={submit} disabled={busy || !name.trim()}
            className="flex items-center gap-1 px-3 py-2 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50">
            <Plus className="w-3.5 h-3.5" /> 添加
          </button>
        </div>
        <div className="flex-1 overflow-auto p-3">
          {categories.length === 0 ? (
            <div className="text-center py-10 text-xs text-gray-400">还没有分类，先添加一个吧</div>
          ) : (
            <div className="space-y-1.5">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-50">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: categoryColor(c.name, c.color) }} />
                  <span className="text-xs text-gray-700 flex-1">{c.name}</span>
                  <span className="text-[10px] text-gray-400">{c.count} 句</span>
                  <button onClick={() => onDelete(c.id, c.name)} title="删除分类（该分类下金句将变为未分类）"
                    className="p-1 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[10px] text-gray-400 mt-3 leading-relaxed">删除分类不会删除金句，该分类下的金句会变为「未分类」。</p>
        </div>
      </div>
    </div>
  );
}

// ── AI 一键分类预览弹窗 ──
function AiClassifyDialog({ loading, saving, suggestions, newCats, existingCats, onChange, onClose, onSave }: {
  loading: boolean; saving: boolean;
  suggestions: Suggestion[]; newCats: string[]; existingCats: string[];
  onChange: (id: string, category: string) => void;
  onClose: () => void; onSave: () => void;
}) {
  // 全部可选分类 = 已有 + AI 新建
  const allCats = Array.from(new Set([...existingCats, ...newCats]));
  // 按建议分类归组展示
  const grouped = useMemo(() => {
    const m = new Map<string, Suggestion[]>();
    for (const s of suggestions) {
      const k = s.category || "未分类";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    }
    return Array.from(m.entries());
  }, [suggestions]);
  const changedCount = suggestions.filter((s) => (s.category || "") !== (s.oldCategory || "")).length;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" /> AI 分类建议
            {!loading && <span className="text-[10px] font-normal text-gray-400">（可逐条调整后保存）</span>}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-7 h-7 animate-spin mb-3 text-violet-400" />
              <p className="text-xs">AI 正在分析金句并归类…</p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-16 text-xs text-gray-400">没有可分类的金句</div>
          ) : (
            <>
              {newCats.length > 0 && (
                <div className="mb-3 text-[11px] text-violet-600 bg-violet-50 rounded-lg px-3 py-2">
                  将新增分类：{newCats.join("、")}
                </div>
              )}
              <div className="space-y-4">
                {grouped.map(([cat, items]) => (
                  <div key={cat}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColor(cat) }} />
                      <span className="text-xs font-medium text-gray-700">{cat}</span>
                      <span className="text-[10px] text-gray-400">({items.length})</span>
                    </div>
                    <div className="space-y-1.5">
                      {items.map((s) => (
                        <div key={s.id} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-gray-700 line-clamp-2">“{s.content}”</div>
                            {s.sourceTitle && <div className="text-[10px] text-gray-400 mt-0.5 truncate">来源：{s.sourceTitle}</div>}
                          </div>
                          <select value={s.category} onChange={(e) => onChange(s.id, e.target.value)}
                            className="text-[11px] border border-gray-200 rounded px-1.5 py-1 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-400/40 flex-shrink-0">
                            {!allCats.includes(s.category) && s.category && <option value={s.category}>{s.category}（新）</option>}
                            {allCats.map((c) => <option key={c} value={c}>{c}</option>)}
                            <option value="">未分类</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {!loading && suggestions.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <span className="text-[11px] text-gray-400">共 {suggestions.length} 条，{changedCount} 条将变更</span>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="px-3.5 py-1.5 text-xs text-gray-500 hover:text-gray-700">取消</button>
              <button onClick={onSave} disabled={saving}
                className="flex items-center gap-1 px-4 py-1.5 text-xs bg-violet-500 text-white rounded-lg hover:bg-violet-600 disabled:opacity-50">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} 保存归类
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
