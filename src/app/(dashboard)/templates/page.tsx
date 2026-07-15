// ─── 模板管理页（公文类型 + Skill 关联） ──────────
// 左侧竖排公文类型列表 + 右侧详情面板 + 底部[+添加公文类型]
// 数据源：/api/templates（内置模板来自 builtin-templates.ts）+ /api/skills（DB）
// 仅改排版，不动内部架构和实现方式

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  LayoutTemplate,
  Plus,
  Edit3,
  Trash2,
  Copy,
  Star,
  RotateCcw,
  X,
  FileText,
  Sparkles,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  FolderOpen,
  Check,
  Eye,
  RefreshCw,
  BookOpen,
} from "lucide-react";
import { DOCUMENT_CATEGORIES, getCategoryColor, CATEGORY_COLORS, type DocumentCategory } from "@/types";
import {
  BUILTIN_TEMPLATES,
  getBuiltinSkillsForCategory,
  type BuiltinTemplate,
  type GovDocTemplateContent,
} from "@/lib/builtin-templates";
import { ContentPreviewModal } from "@/components/ui/ContentPreviewModal";
import { cachedFetch, invalidateCache } from "@/lib/cache";
import { useAuthStore } from "@/stores/auth.store";
import { getCachedData, writePreload, invalidatePreload } from "@/lib/preload-cache";

// ── 类型定义 ──

interface DocSkill {
  id: string;
  category: string;
  name: string;
  content: string;
  isBuiltin: boolean;
}

interface CustomTemplate {
  id: string;
  name: string;
  category: string;
  content: string;
}

// 用户自定义的公文类型（从 DB 加载或新增）
interface CustomCategory {
  id?: string;       // DB id（用户自建时存在）
  name: string;      // 类型名称，如"决议"
  isBuiltin: boolean; // false = 用户创建
  color?: string;    // 标签颜色（用户选择时设定）
}

const LAST_CAT_KEY = "gw-templates-last-cat";

// ── 确认弹窗 action 类型 ──
interface ConfirmAction {
  type: "delete-tpl" | "delete-skill" | "restore" | "copy-builtin";
  id?: string;
  name?: string;
  content?: string;
}

// ── localStorage 辅助：当前使用的模板/Skill ──
const ACTIVE_TPL_PREFIX = "gw-active-tpl-";
const ACTIVE_SKILL_PREFIX = "gw-active-skills-";
function getActiveTemplateId(c: string): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(ACTIVE_TPL_PREFIX + c); } catch { return null; }
}
function setActiveTemplateId(c: string, id: string) {
  try { localStorage.setItem(ACTIVE_TPL_PREFIX + c, id); } catch {}
}
function getActiveSkillSet(c: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { const r = localStorage.getItem(ACTIVE_SKILL_PREFIX + c); return r ? new Set(JSON.parse(r)) : new Set(); } catch { return new Set(); }
}
function toggleActiveSkillId(c: string, id: string) {
  try {
    const r = localStorage.getItem(ACTIVE_SKILL_PREFIX + c);
    const s: Set<string> = r ? new Set(JSON.parse(r)) : new Set();
    if (s.has(id)) s.delete(id); else s.add(id);
    localStorage.setItem(ACTIVE_SKILL_PREFIX + c, JSON.stringify([...s]));
  } catch {}
}

// ── 主组件 ───────────────────────────────────────

export default function TemplatesPage() {
  const [activeCat, setActiveCatRaw] = useState<string>(DOCUMENT_CATEGORIES[0]);
  const setActiveCat = (cat: string) => {
    setActiveCatRaw(cat);
    try { localStorage.setItem(LAST_CAT_KEY, cat); } catch {}
  };
  const [allCustomTpls, setAllCustomTpls] = useState<CustomTemplate[]>([]);
  const [allSkills, setAllSkills] = useState<DocSkill[]>([]);
  const [loading, setLoading] = useState(true);
  // 侧栏宽度（可拖拽缩放）
  const [asideWidth, setAsideWidth] = useState<number>(208);
  const draggingRef = useRef(false);
  const [dialog, setDialog] = useState<{ title: string; message: string } | null>(null);

  // 弹窗状态
  const [tplModal, setTplModal] = useState<{ edit?: CustomTemplate; cat?: string } | null>(null);
  const [skillModal, setSkillModal] = useState<{ edit?: DocSkill; cat: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  // 当前分类选中的模板 ID 和 Skill ID 集合
  const [activeTplId, setActiveTplId] = useState<string | null>(null);
  const [activeSkillIds, setActiveSkillIds] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<{ title: string; content: string; type: "template" | "skill"; category?: string } | null>(null);

  // 切换分类时重读 localStorage，首次使用时自动勾选内置 Skill
  useEffect(() => {
    setActiveTplId(getActiveTemplateId(activeCat));
    const saved = localStorage.getItem(ACTIVE_SKILL_PREFIX + activeCat);
    if (!saved) {
      // 首次使用该分类：自动勾选当前分类的所有内置 Skill
      const builtinSkillDefs = getBuiltinSkillsForCategory(activeCat);
      if (builtinSkillDefs.length > 0) {
        // 找到匹配的 DB Skill ID（通过名称匹配）
        const matchingIds = allSkills
          .filter((s) => s.isBuiltin && s.category === activeCat && builtinSkillDefs.some((d) => d.name === s.name))
          .map((s) => s.id);
        if (matchingIds.length > 0) {
          localStorage.setItem(ACTIVE_SKILL_PREFIX + activeCat, JSON.stringify(matchingIds));
        }
      }
    }
    setActiveSkillIds(getActiveSkillSet(activeCat));
  }, [activeCat]);

  // 添加公文类型弹窗
  const [catModalOpen, setCatModalOpen] = useState(false);

  // 用户自定义分类列表（从 DB 或 localStorage 获取）
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);

  // 所有可用的分类 = 内置11类 + 用户自定义
  const allCategories = [...DOCUMENT_CATEGORIES, ...customCategories.map(c => c.name)];

  // 恢复上次选中的分类
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_CAT_KEY);
      if (saved && allCategories.includes(saved)) {
        setActiveCatRaw(saved);
      }
    } catch {}
  }, []);

  // 解析任意分类的有效颜色（内置从 CATEGORY_COLORS 取，自定义从自身 color 取）
  const resolveCatColor = (cat: string): string => {
    if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
    const cc = customCategories.find((c) => c.name === cat);
    return cc?.color || "#6b7280";
  };

  // ── 数据加载（缓存优先：先秒开，再后台同步）──
  const userId = useAuthStore((s) => s.user?.id);

  const loadData = useCallback(async () => {
    // 先读本地预加载缓存，秒开
    const cachedTpl = getCachedData<{ data: { custom?: any[] } }>(userId, "templates");
    const cachedSkills = getCachedData<{ data: any[] }>(userId, "skills");
    let seeded = false;
    if (cachedTpl?.data?.custom?.length) { setAllCustomTpls(cachedTpl.data.custom); seeded = true; }
    if (cachedSkills?.data?.length) { setAllSkills(cachedSkills.data); seeded = true; }
    if (seeded) setLoading(false); else setLoading(true);
    try {
      const [tplRes, skillRes] = await Promise.all([
        cachedFetch("templates:list", () => fetch("/api/templates").then((r) => r.json()), 30_000),
        cachedFetch("skills:list", () => fetch("/api/skills").then((r) => r.json()), 30_000),
      ]);
      if (tplRes.success && tplRes.data?.custom) { setAllCustomTpls(tplRes.data.custom); writePreload(userId, "templates", tplRes); }
      if (skillRes.success) { setAllSkills(skillRes.data || []); writePreload(userId, "skills", skillRes); }
    } catch { /* ignore */ }
    setLoading(false);
  }, [userId]);

  const refreshData = () => {
    invalidateCache("templates:");
    invalidateCache("skills:");
    invalidatePreload(userId, "templates");
    invalidatePreload(userId, "skills");
    loadData();
  };

  useEffect(() => { loadData(); }, [loadData]);

  // 当前分类的内置模板
  const builtinTpl: BuiltinTemplate | undefined = BUILTIN_TEMPLATES.find((t) => t.category === activeCat);
  const builtinSkills = getBuiltinSkillsForCategory(activeCat);
  const catColor = resolveCatColor(activeCat);
  const isBuiltinCategory = DOCUMENT_CATEGORIES.includes(activeCat as DocumentCategory);

  // 当前分类的自定义模板 / Skill（由全量数据过滤，供右侧面板）
  const customTpls = allCustomTpls.filter((t) => t.category === activeCat);
  const skills = allSkills.filter((s) => s.category === activeCat);

  // 各分类计数（供竖排菜单显示：笔=模板数，星=Skill数）
  // 内置类别：自定义数 + 内置模板(1) / 内置Skill(N)
  // 自定义类别：仅自定义数（无内置）
  const tplCountByCat: Record<string, number> = {};
  const skillCountByCat: Record<string, number> = {};
  for (const c of allCategories) {
    const isBuiltin = DOCUMENT_CATEGORIES.includes(c as DocumentCategory);
    tplCountByCat[c] = allCustomTpls.filter((t) => t.category === c).length + (isBuiltin ? 1 : 0);
    skillCountByCat[c] = allSkills.filter((s) => s.category === c).length + (isBuiltin ? getBuiltinSkillsForCategory(c).length : 0);
  }

  // 拖拽调整侧栏宽度
  const startResize = (e: ReactMouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = asideWidth;
    const onMove = (ev: MouseEvent) => {
      const w = Math.min(Math.max(startW + ev.clientX - startX, 160), 440);
      setAsideWidth(w);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ── 操作方法（原封不动保留） ──

  const showDialog = (title: string, message: string) => setDialog({ title, message });

  const saveTemplate = async (data: { name: string; category: string; content: string }) => {
    if (!data.name.trim()) return;
    const isEdit = !!tplModal?.edit;
    const res = await fetch("/api/templates", {
      method: isEdit ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, ...(isEdit ? { id: tplModal!.edit!.id } : {}) }),
    });
    const body = await res.json();
    if (body.success) {
      showDialog("成功", isEdit ? "模板已更新" : "模板已创建");
      setTplModal(null);
      refreshData();
    } else {
      showDialog("失败", body.error?.message || "操作失败");
    }
  };

  const deleteTemplate = async () => {
    if (!confirmAction?.id) return;
    const res = await fetch("/api/templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: confirmAction.id }),
    });
    if (res.ok) {
      showDialog("成功", "模板已删除");
      setConfirmAction(null);
      refreshData();
    }
  };

  const copyBuiltin = async () => {
    if (!builtinTpl) return;
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${builtinTpl.name}（副本）`,
        category: activeCat,
        content: builtinTpl.content,
      }),
    });
    const body = await res.json();
    if (body.success) {
      showDialog("成功", "已复制为自定义模板");
      setConfirmAction(null);
      refreshData();
    } else {
      showDialog("失败", body.error?.message || "复制失败");
    }
  };

  // 从知识库刷新当前分类的模板/Skill
  const handleKbRefresh = async (mode: "all" | "select") => {
    if (mode === "all") {
      const res = await fetch(`/api/documents?reviewed=true&category=${encodeURIComponent(activeCat)}&pageSize=50`);
      const body = await res.json();
      if (!body.success) { showDialog("提示", "获取知识库文档失败"); return; }
      const kbDocs = body.data?.items || body.data || [];
      if (kbDocs.length === 0) { showDialog("提示", `「${activeCat}」分类暂无知识库文档`); return; }
      showDialog("已刷新", `已从知识库获取 ${kbDocs.length} 篇「${activeCat}」公文作为样本参考。\n可在编辑器或 AI 出稿中使用它们改进生成质量。`);
    } else {
      // 多选模式：打开知识库文件选择器
      const res = await fetch("/api/documents?reviewed=true&pageSize=100");
      const body = await res.json();
      if (!body.success) { showDialog("提示", "获取知识库文档失败"); return; }
      const allKbDocs = body.data?.items || body.data || [];
      // 按分类分组后弹出选择提示
      const byCat: Record<string, number> = {};
      for (const d of allKbDocs) {
        byCat[d.category] = (byCat[d.category] || 0) + 1;
      }
      const summary = Object.entries(byCat).map(([c, n]) => `  ${c}: ${n}篇`).join("\n");
      showDialog("请选择", `知识库中共有 ${allKbDocs.length} 篇文档：\n${summary}\n\n（此功能为界面预览，完整多选交互将在后续版本中实现，当前可通过各文档链接进入编辑）`);
    }
  };

  const saveSkill = async (data: { name: string; category: string; content: string }) => {
    if (!data.name.trim()) return;
    const isEdit = !!skillModal?.edit;
    const url = "/api/skills";
    const method = isEdit ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, ...(isEdit ? { id: skillModal!.edit!.id } : {}) }),
    });
    const body = await res.json();
    if (body.success) {
      showDialog("成功", isEdit ? "Skill 已更新" : "Skill 已创建");
      setSkillModal(null);
      refreshData();
    } else {
      showDialog("失败", body.error?.message || "操作失败");
    }
  };

  const deleteSkill = async () => {
    if (!confirmAction?.id) return;
    const res = await fetch("/api/skills", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: confirmAction.id }),
    });
    if (res.ok) {
      showDialog("成功", "Skill 已删除");
      setConfirmAction(null);
      refreshData();
    }
  };

  const restoreDefaults = async () => {
    const res = await fetch("/api/templates/restore-defaults", { method: "POST" });
    if (res.ok) {
      showDialog("成功", "已恢复默认，所有自定义模板已清空");
      setConfirmAction(null);
      refreshData();
    }
  };

  // 添加自定义公文类型
  const addCustomCategory = (name: string, color?: string) => {
    if (!name.trim()) return;
    const trimmed = name.trim();
    if (allCategories.includes(trimmed)) {
      showDialog("提示", `「${trimmed}」已存在`);
      return;
    }
    // 持久化到 localStorage（后续迁移到 DB）
    const updated = [...customCategories, { name: trimmed, isBuiltin: false, color }];
    setCustomCategories(updated);
    try {
      localStorage.setItem("gw-custom-categories", JSON.stringify(updated));
    } catch {}
    setActiveCat(trimmed);
    setCatModalOpen(false);
    showDialog("成功", `已添加公文类型「${trimmed}」`);
  };

  // 删除自定义分类
  const removeCustomCategory = (name: string) => {
    const updated = customCategories.filter((c) => c.name !== name);
    setCustomCategories(updated);
    try {
      localStorage.setItem("gw-custom-categories", JSON.stringify(updated));
    } catch {}
    if (activeCat === name) {
      setActiveCat(DOCUMENT_CATEGORIES[0]);
    }
    showDialog("成功", `已删除公文类型「${name}」`);
  };

  // 初始化加载自定义分类
  useEffect(() => {
    try {
      const stored = localStorage.getItem("gw-custom-categories");
      if (stored) {
        const parsed: CustomCategory[] = JSON.parse(stored);
        if (Array.isArray(parsed)) setCustomCategories(parsed);
      }
    } catch {}
  }, []);

  // ── 渲染：左右分栏布局 ──

  return (
    <DashboardLayout title="模板管理">
      <div className="flex flex-col md:flex-row md:gap-0 h-full">
        {/* ══════════ 左侧：竖排公文类型列表（宽度可拖拽） ══════════ */}
        <aside style={{ width: asideWidth }} className="hidden md:flex md:flex-col md:flex-shrink-0 md:border-r md:border-[#e7e2d8] md:bg-[#f6f4ef] md:rounded-l-xl md:h-full">
          <div className="p-3 border-b border-[#e7e2d8]/60 flex items-center gap-2 flex-shrink-0">
            <FolderOpen className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-medium text-gray-500">公文类型</span>
          </div>

          {/* 内置 11 类 */}
          <div className="divide-y divide-[#e7e2d8]/40 flex-1">
            {DOCUMENT_CATEGORIES.map((cat) => {
              const isActive = cat === activeCat;
              const color = getCategoryColor(cat);
              return (
                <button key={cat} onClick={() => setActiveCat(cat)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between group ${
                    isActive
                      ? "font-semibold text-white shadow-sm"
                      : "text-gray-600 hover:bg-white/60"
                  }`}
                  style={isActive ? { backgroundColor: color } : undefined}>
                  <span>{cat}</span>
                  <span className={`flex items-center gap-2.5 text-[10px] ${isActive ? "text-white/85" : "text-gray-400"}`}>
                    <span className="flex items-center gap-0.5" title="模板数">
                      <Edit3 className="w-3 h-3" />{tplCountByCat[cat] ?? 0}
                    </span>
                    <span className="flex items-center gap-0.5" title="Skill 数">
                      <Sparkles className="w-3 h-3" />{skillCountByCat[cat] ?? 0}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* 自定义分类 */}
          {customCategories.length > 0 && (
            <div className="divide-y divide-[#e7e2d8]/40 border-t border-dashed border-[#c9a55c]/30 pt-1 flex-shrink-0">
              {customCategories.map((cc) => {
                const isActive = cc.name === activeCat;
                const ccColor = resolveCatColor(cc.name);
                return (
                  <div key={cc.name} className={`flex items-center justify-between px-2 py-0.5 ${isActive ? "rounded mx-1" : ""}`}
                    style={isActive ? { backgroundColor: ccColor + "18" } : undefined}>
                    <button onClick={() => setActiveCat(cc.name)}
                      className={`flex-1 text-left px-2 py-2 text-sm transition-colors flex items-center justify-between ${
                        isActive ? "font-semibold" : "text-gray-500 hover:bg-white/50 rounded"
                      }`}
                      style={isActive ? { color: ccColor } : undefined}>
                      <span>{cc.name}</span>
                      <span className="flex items-center gap-2 text-[10px] text-gray-400">
                        <span className="flex items-center gap-0.5" title="模板数"><Edit3 className="w-3 h-3" />{tplCountByCat[cc.name] ?? 0}</span>
                        <span className="flex items-center gap-0.5" title="Skill 数"><Sparkles className="w-3 h-3" />{skillCountByCat[cc.name] ?? 0}</span>
                      </span>
                    </button>
                    <button onClick={() => removeCustomCategory(cc.name)}
                      title="删除此类型"
                      className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 hover:opacity-100 mr-1">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* [+添加公文类型] 按钮 — 固定底部，与上方列表以边框分隔 */}
          <div className="p-3 border-t border-[#e7e2d8]/60 flex-shrink-0">
            <button onClick={() => setCatModalOpen(true)}
              className="w-full px-3 py-2 border border-dashed border-[#c9a55c]/40 rounded-lg text-xs text-gray-400 hover:text-[#163f3a] hover:border-[#163f3a]/30 hover:bg-[#163f3a]/5 flex items-center justify-center gap-1.5 transition-colors">
              <Plus className="w-3.5 h-3.5" />添加公文类型
            </button>
          </div>
        </aside>

        {/* 移动端：公文类型下拉选择（替代收起的左侧竖排菜单，保留模板数 / Skill 数） */}
        <select
          value={activeCat}
          onChange={(e) => setActiveCat(e.target.value)}
          className="md:hidden w-full flex-shrink-0 border border-[#e7e2d8] bg-white px-3 py-2.5 text-sm text-gray-700 rounded-lg mb-2"
        >
          {DOCUMENT_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}（模板 {tplCountByCat[cat] ?? 0} · 技能 {skillCountByCat[cat] ?? 0}）</option>
          ))}
          {customCategories.map((cc) => (
            <option key={cc.name} value={cc.name}>{cc.name}（模板 {tplCountByCat[cc.name] ?? 0} · 技能 {skillCountByCat[cc.name] ?? 0}）</option>
          ))}
        </select>

        {/* 拖拽分隔条 — 极细线，顶天立地 */}
        <div
          onMouseDown={startResize}
          className="hidden md:block w-[1px] flex-shrink-0 cursor-col-resize bg-[#e7e2d8]/50 hover:bg-[#c9a55c] transition-colors self-stretch"
          title="拖拽调整侧栏宽度"
        />

        {/* ══════════ 右侧：选中类型的详情面板 ══════════ */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#f6f4ef] h-full">
          {/* 面板头部：当前分类名 */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <span
                className="px-2.5 py-1 rounded-md text-white text-xs font-medium"
                style={{ backgroundColor: catColor }}>
                {activeCat}
              </span>
              {!isBuiltinCategory && (
                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">自定义类型</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* 从知识库刷新 */}
              <div className="relative group">
                <button
                  className="flex items-center gap-1 px-2 py-1.5 text-[11px] text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                  <RefreshCw className="w-3 h-3" />知识库刷新
                </button>
                <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 hidden group-hover:block">
                  <button onClick={() => handleKbRefresh("all")}
                    className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-blue-500" />
                    以知识库该类型全部文档为蓝本
                  </button>
                  <button onClick={() => handleKbRefresh("select")}
                    className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                    从知识库多选文件
                  </button>
                </div>
              </div>
              {isBuiltinCategory && (
                <button onClick={() => setConfirmAction({ type: "restore" })}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200">
                  <RotateCcw className="w-3.5 h-3.5" />恢复默认
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20 text-sm text-gray-400">加载中...</div>
          ) : (
            <div className="space-y-6 max-w-3xl">
              {/* ═══ 系统内置模板 ═══ */}
              {isBuiltinCategory && builtinTpl && (
                <section>
                  <h3 className="text-xs font-medium text-gray-800 mb-3 flex items-center gap-1.5 pb-2 border-b border-gray-100">
                    <FileText className="w-3.5 h-3.5" style={{ color: catColor }} /> 系统内置模板
                  </h3>
                  <BuiltinCard tpl={builtinTpl} color={catColor}
                    onCopy={() => setConfirmAction({ type: "copy-builtin" })}
                    isActive={activeTplId === builtinTpl.id}
                    onSetActive={() => { setActiveTemplateId(activeCat, builtinTpl.id); setActiveTplId(builtinTpl.id); }}
                    onPreview={() => setPreview({ title: builtinTpl.name, content: builtinTpl.content, type: "template", category: builtinTpl.category })}
                  />
                </section>
              )}

              {/* 自定义类型无内置模板时的提示 */}
              {!isBuiltinCategory && (
                <section>
                  <h3 className="text-xs font-medium text-gray-800 mb-3 flex items-center gap-1.5 pb-2 border-b border-gray-100">
                    <FileText className="w-3.5 h-3.5 text-gray-400" /> 系统内置模板
                  </h3>
                  <div className="text-center py-8 bg-gray-50/80 rounded-xl border border-dashed border-gray-200">
                    <p className="text-xs text-gray-400">此类型暂无系统内置模板，请通过上方「新建模板」创建</p>
                  </div>
                </section>
              )}

              {/* ═══ 自定义模板 ═══ */}
              <section>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                  <h3 className="text-xs font-medium text-gray-800 flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-blue-500" /> 自定义模板（{customTpls.length}）
                  </h3>
                  <button onClick={() => setTplModal({ cat: activeCat })}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] text-[#163f3a] hover:bg-[#163f3a]/5 rounded">
                    <Plus className="w-3 h-3" />新建模板
                  </button>
                </div>
                {customTpls.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50/80 rounded-xl border border-dashed border-gray-200">
                    <LayoutTemplate className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">暂无自定义模板，点击上方「新建模板」创建</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {customTpls.map((t) => (
                      <CustomTplCard key={t.id} tpl={t}
                        onEdit={() => setTplModal({ edit: t })}
                        onDelete={() => setConfirmAction({ type: "delete-tpl", id: t.id, name: t.name })}
                        isActive={activeTplId === t.id}
                        onSetActive={() => { setActiveTemplateId(activeCat, t.id); setActiveTplId(t.id); }}
                        onPreview={() => setPreview({ title: t.name, content: t.content, type: "template", category: t.category })}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* ═══ 写作规范 Skill ═══ */}
              <section>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                  <h3 className="text-xs font-medium text-gray-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> 写作规范 Skill（{skills.length}）
                  </h3>
                  <button onClick={() => setSkillModal({ cat: activeCat })}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] text-[#163f3a] hover:bg-[#163f3a]/5 rounded">
                    <Plus className="w-3 h-3" />新增 Skill
                  </button>
                </div>
                {skills.length === 0 ? (
                  <div className="text-center py-6 bg-gray-50/80 rounded-xl border border-dashed border-gray-200">
                    <p className="text-xs text-gray-400">该分类暂无 Skill，可新增自定义写作规范</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {skills.map((s) => (
                      <SkillRow key={s.id} skill={s}
                        onEdit={() => setSkillModal({ edit: s, cat: activeCat })}
                        onDelete={!s.isBuiltin ? () => setConfirmAction({ type: "delete-skill", id: s.id, name: s.name }) : undefined}
                        isActive={activeSkillIds.has(s.id)}
                        onToggleActive={() => { toggleActiveSkillId(activeCat, s.id); setActiveSkillIds(getActiveSkillSet(activeCat)); }}
                        onPreview={() => setPreview({ title: s.name, content: s.content, type: "skill", category: s.category })}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </main>
      </div>

      {/* ═══ 弹窗：添加公文类型 ═══ */}
      {catModalOpen && (
        <AddCategoryModal
          onAdd={addCustomCategory}
          onClose={() => setCatModalOpen(false)}
          onSaveTemplate={saveTemplate}
          onSaveSkill={saveSkill}
          customCategories={customCategories}
        />
      )}

      {/* ═══ 弹窗：新建/编辑模板 ═══ */}
      {tplModal && (
        <TemplateFormModal
          initial={tplModal.edit}
          defaultCategory={tplModal.cat || activeCat}
          allCategories={allCategories}
          onSave={saveTemplate}
          onClose={() => setTplModal(null)}
        />
      )}

      {/* ═══ 弹窗：新建/编辑 Skill ═══ */}
      {skillModal && (
        <SkillFormModal
          initial={skillModal.edit}
          defaultCategory={skillModal.cat}
          allCategories={allCategories}
          onSave={saveSkill}
          onClose={() => setSkillModal(null)}
        />
      )}

      {/* ═══ 确认弹窗 ═══ */}
      {confirmAction && (
        <ConfirmDialog
          action={confirmAction}
          onConfirm={() => {
            if (confirmAction.type === "delete-tpl") deleteTemplate();
            else if (confirmAction.type === "delete-skill") deleteSkill();
            else if (confirmAction.type === "copy-builtin") copyBuiltin();
            else if (confirmAction.type === "restore") restoreDefaults();
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* ═══ 预览弹窗 ═══ */}
      <ContentPreviewModal data={preview} onClose={() => setPreview(null)} />

      {/* ═══ 提示弹窗 ═══ */}
      {dialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"
          onClick={() => setDialog(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-800">{dialog.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{dialog.message}</p>
              </div>
            </div>
            <button onClick={() => setDialog(null)}
              className="w-full px-4 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">确定</button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// ── 预设调色板（排除内置11色后供用户选择） ──

const COLOR_PALETTE = [
  "#0d9488", "#14b8a6", "#2dd4bf", "#5eead4",   // teal 系
  "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe",   // blue 系
  "#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe",   // violet 系
  "#f59e0b", "#fbbf24", "#fcd34d", "#fde68a",   // amber 系
  "#ec4899", "#f472b6", "#f9a8d4", "#fbcfe8",   // pink 系
  "#84cc16", "#a3e635", "#bef264", "#d9f99d",   // lime 系
  "#06b6d4", "#22d3ee", "#67e8f9", "#a5f3fc",   // cyan 系
  "#f43f5e", "#fb7185", "#fda4af", "#fecdd3",   // rose 系
  "#78716c", "#a8a29e", "#d6d3d1", "#e7e5e4",   // stone 系
];

/** 获取已占用的颜色集合（内置11类 + 用户自定义已选） */
function getUsedColors(customCats: CustomCategory[]): Set<string> {
  const used = new Set(Object.values(CATEGORY_COLORS));
  for (const cc of customCats) { if (cc.color) used.add(cc.color); }
  return used;
}

// ── 子组件：添加公文类型弹窗（增强版） ───────────────

interface AddCategoryModalProps {
  onAdd: (name: string, color?: string) => void;
  onClose: () => void;
  /** 模板创建回调（可选，用户上传了模板时调用） */
  onSaveTemplate?: (data: { name: string; category: string; content: string }) => void;
  /** Skill 创建回调（可选，用户上传了 Skill 时调用） */
  onSaveSkill?: (data: { name: string; category: string; content: string }) => void;
  customCategories: CustomCategory[];
}

function AddCategoryModal({ onAdd, onClose, onSaveTemplate, onSaveSkill, customCategories }: AddCategoryModalProps) {
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [showColorPicker, setShowColorPicker] = useState(false);

  // 默认模板
  const [tplName, setTplName] = useState("");
  const [tplContent, setTplContent] = useState("");
  const [tplFile, setTplFile] = useState<File | null>(null);

  // Skill
  const [skillName, setSkillName] = useState("");
  const [skillContent, setSkillContent] = useState("");
  const [skillFile, setSkillFile] = useState<File | null>(null);

  const usedColors = getUsedColors(customCategories);
  const availableColors = COLOR_PALETTE.filter((c) => !usedColors.has(c));

  // 自动选第一个可用色
  useEffect(() => {
    if (!selectedColor && availableColors.length > 0) {
      setSelectedColor(availableColors[0]);
    }
  }, [availableColors]);

  // 文件读取辅助
  const readTextFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // 处理模板文件上传
  const handleTplFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTplFile(file);
    // 自动填名称
    if (!tplName) setTplName(file.name.replace(/\.[^.]+$/, ""));
    try {
      const text = await readTextFile(file);
      // .md 文件直接作为内容；.docx 尝试解析为文本（简单处理）
      if (file.name.endsWith(".md")) {
        // md → 转换为模板 JSON 结构
        const lines = text.split("\n").filter((l) => l.trim());
        const sections = lines.length > 0 ? ["标题", ...lines.map(l => l.replace(/^#+\s*/, ""))] : ["标题", "正文"];
        const tplJson: GovDocTemplateContent = {
          titlePattern: `关于{topic}的${name || "公文"}`,
          sections: sections.slice(0, 15),
          sectionSamples: [],
          structureHint: "基于用户上传的 Markdown 文件生成",
          formatRules: [],
        };
        setTplContent(JSON.stringify(tplJson, null, 2));
      } else if (file.name.endsWith(".json")) {
        setTplContent(text);
      } else {
        // .docx / 其他：存为原始内容提示
        setTplContent(JSON.stringify({
          titlePattern: `关于{topic}的${name || "公文"}`,
          sections: ["标题", "正文"],
          sectionSamples: [],
          structureHint: `基于用户上传的 ${file.name} 生成`,
          formatRules: [],
          _rawFile: file.name,
        } as GovDocTemplateContent, null, 2));
      }
    } catch {}
  };

  // 处理 Skill 文件上传
  const handleSkillFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSkillFile(file);
    if (!skillName) setSkillName(file.name.replace(/\.[^.]+$/, ""));
    try {
      const text = await readTextFile(file);
      if (file.name.endsWith(".json")) {
        // JSON 可能是多个 Skill 的数组或单个对象
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            setSkillContent(parsed.map((s: any) =>
              `- ${s.name || "未命名"}：${s.content || s.rule || ""}`
            ).join("\n"));
          } else if (parsed.content) {
            setSkillContent(parsed.content);
          } else {
            setSkillContent(text);
          }
        } catch { setSkillContent(text); }
      } else {
        // .md / 其他文本直接作为内容
        setSkillContent(text);
      }
    } catch {}
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    const trimmed = name.trim();
    const color = selectedColor || undefined;

    // 1. 创建分类
    onAdd(trimmed, color);

    // 2. 如果填写了默认模板，延迟创建（等分类已加入 allCategories）
    if (tplName.trim() && tplContent.trim() && onSaveTemplate) {
      setTimeout(() => {
        onSaveTemplate({ name: tplName.trim(), category: trimmed, content: tplContent.trim() });
      }, 100);
    }

    // 3. 如果填写了 Skill，延迟创建
    if (skillName.trim() && skillContent.trim() && onSaveSkill) {
      setTimeout(() => {
        onSaveSkill({ name: skillName.trim(), category: trimmed, content: skillContent.trim() });
      }, 150);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-[520px] max-w-[90vw] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-gray-800 mb-4">添加公文类型</h3>

        {/* ── 基本信息 ── */}
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-gray-500">类型名称 *</span>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="如：决议、意见、公报"
              autoFocus
              className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#163f3a]/20" />
          </label>

          {/* 标签颜色选择器 */}
          <div>
            <label className="text-xs text-gray-500 block mb-1.5">
              标签颜色{selectedColor && <span className="ml-1 inline-block w-3 h-3 rounded align-middle" style={{ backgroundColor: selectedColor }} />}
            </label>
            <button onClick={() => setShowColorPicker(!showColorPicker)}
              className={`w-full px-3 py-2 border rounded-lg text-sm flex items-center gap-2 transition-colors ${
                selectedColor ? "border-gray-300" : "border-dashed border-gray-300 text-gray-400"
              }`}>
              {selectedColor ? (
                <>
                  <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: selectedColor }} />
                  <span className="text-gray-700">{selectedColor}</span>
                  <span className="text-[10px] text-gray-400 ml-auto">点击更换</span>
                </>
              ) : (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-dashed border-gray-300" />
                  <span>选择标签颜色</span>
                </>
              )}
            </button>

            {showColorPicker && (
              <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-[10px] text-gray-400 mb-2">
                  可用颜色（已排除 {usedColors.size} 个已用色）· 共 {availableColors.length} 色
                </p>
                <div className="grid grid-cols-8 gap-1.5">
                  {COLOR_PALETTE.map((color) => {
                    const isUsed = usedColors.has(color);
                    const isSelected = color === selectedColor;
                    return (
                      <button key={color} disabled={isUsed}
                        onClick={() => { setSelectedColor(color); }}
                        title={`${color}${isUsed ? "（已占用）" : ""}`}
                        className={`w-7 h-7 rounded-lg transition-all ${
                          isSelected ? "ring-2 ring-offset-1 ring-[#163f3a] scale-110" : ""
                        } ${isUsed ? "opacity-25 cursor-not-allowed" : "hover:scale-110 hover:shadow-sm"}`}
                        style={{ backgroundColor: color }}>
                        {isSelected && (
                          <CheckCircle className="w-3.5 h-3.5 text-white mx-auto" strokeWidth={3} />
                        )}
                      </button>
                    );
                  })}
                </div>
                {availableColors.length === 0 && (
                  <p className="text-[10px] text-amber-600 mt-1">所有预设颜色均已使用，可手动输入自定义色值</p>
                )}
                {availableColors.length > 0 && !selectedColor && (
                  <p className="text-[10px] text-blue-500 mt-1">请选择一个颜色</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── 分隔线 ── */}
        <div className="border-t border-dashed border-gray-200 my-4" />

        {/* ── 默认模板上传（可选） ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">
              <LayoutTemplate className="w-3.5 h-3.5 inline mr-1" />默认模板（可选）
            </span>
            <span className="text-[10px] text-gray-400">支持 .md / .docx</span>
          </div>

          <input type="text" value={tplName} onChange={(e) => setTplName(e.target.value)}
            placeholder="模板名称（留空则不创建）"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#163f3a]/20" />

          <div className="relative">
            <textarea value={tplContent} onChange={(e) => setTplContent(e.target.value)} rows={4}
              placeholder='{"titlePattern":"...","sections":[...]} 或粘贴 Markdown 内容'
              className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#163f3a]/20" />
            <label className="absolute bottom-2 right-2 flex items-center gap-1.5">
              <input type="file" accept=".md,.docx,.txt,.json" className="hidden" onChange={handleTplFileChange} />
              <span className="px-2 py-1 bg-gray-100 text-[10px] text-gray-500 rounded cursor-pointer hover:bg-gray-200 flex items-center gap-1">
                <FileText className="w-3 h-3" />{tplFile ? tplFile.name : "上传文件"}
              </span>
              <span className="px-2 py-1 bg-amber-50 text-[10px] text-amber-600 rounded cursor-help flex items-center gap-1"
                title="上传图片或 PDF 后，调用 AI 自动识别提取模板框架（需配置 API 密钥）">
                <Sparkles className="w-3 h-3" />AI识别
              </span>
            </label>
          </div>
        </div>

        {/* ── 分隔线 ── */}
        <div className="border-t border-dashed border-gray-200 my-4" />

        {/* ── Skill 上传（可选） ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">
              <Sparkles className="w-3.5 h-3.5 inline mr-1" />写作规范 Skill（可选）
            </span>
            <span className="text-[10px] text-gray-400">支持 .md / .json</span>
          </div>

          <input type="text" value={skillName} onChange={(e) => setSkillName(e.target.value)}
            placeholder="Skill 名称（留空则不创建）"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#163f3a]/20" />

          <div className="relative">
            <textarea value={skillContent} onChange={(e) => setSkillContent(e.target.value)} rows={4}
              placeholder="输入写作规范内容...&#10;&#10;示例：&#10;1. 开头应简明说明发文背景和目的&#10;2. 正文采用分条列项式结构..."
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#163f3a]/20" />
            <label className="absolute bottom-2 right-2 flex items-center gap-1.5">
              <input type="file" accept=".md,.json,.txt" className="hidden" onChange={handleSkillFileChange} />
              <span className="px-2 py-1 bg-gray-100 text-[10px] text-gray-500 rounded cursor-pointer hover:bg-gray-200 flex items-center gap-1">
                <FileText className="w-3 h-3" />{skillFile ? skillFile.name : "上传文件"}
              </span>
              <span className="px-2 py-1 bg-amber-50 text-[10px] text-amber-600 rounded cursor-help flex items-center gap-1"
                title="上传图片或 PDF 后，调用 AI 自动识别提取写作规范（需配置 API 密钥）">
                <Sparkles className="w-3 h-3" />AI识别
              </span>
            </label>
          </div>
        </div>

        {/* ── 按钮 ── */}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose}
            className="px-4 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">取消</button>
          <button onClick={handleSubmit} disabled={!name.trim()}
            className="px-4 py-1.5 text-xs bg-[#163f3a] text-white rounded-lg hover:bg-[#163f3a]/90 disabled:bg-gray-300">
            确认添加
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 子组件：内置模板卡片（原封不动） ──────────────

function BuiltinCard({ tpl, color, onCopy, isActive, onSetActive, onPreview }: {
  tpl: BuiltinTemplate;
  color: string;
  onCopy: () => void;
  isActive: boolean;
  onSetActive: () => void;
  onPreview: () => void;
}) {
  let parsed: GovDocTemplateContent | null = null;
  try { parsed = JSON.parse(tpl.content); } catch {}

  return (
    <div className={`rounded-xl border bg-white p-5 shadow-sm ${isActive ? "ring-2 ring-[#163f3a]/20" : ""}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-medium text-white" style={{ backgroundColor: color }}>
              {tpl.category}
            </span>
            <h4 className="text-sm font-semibold text-gray-800">{tpl.name}</h4>
            {isActive && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#163f3a] text-white flex items-center gap-0.5">
                <Check className="w-2.5 h-2.5" /> 当前使用
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">{tpl.description}</p>
        </div>
          <div className="flex items-center gap-1">
            {!isActive && (
              <button onClick={onSetActive}
                className="flex items-center gap-1 px-2 py-1 bg-[#163f3a]/10 text-[#163f3a] text-[10px] rounded hover:bg-[#163f3a]/20">
                <Check className="w-3 h-3" /> 设为当前
              </button>
            )}
            <button onClick={onCopy}
              className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 text-[10px] rounded hover:bg-gray-200">
              <Copy className="w-3 h-3" /> 复制为自定义
            </button>
            <button onClick={onPreview} title="预览"
              className="p-1 text-gray-300 hover:text-gray-500">
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>
      </div>

      {parsed && (
        <div className="mb-3">
          <p className="text-[11px] text-gray-400 mb-1">标题模式：{parsed.titlePattern}</p>
          <div className="flex flex-wrap gap-1">
            {parsed.sections.filter((s) => s !== "标题").map((s) => (
              <span key={s} className="px-1.5 py-0.5 bg-gray-100 text-[10px] text-gray-500 rounded">{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 子组件：自定义模板卡片（原封不动） ────────────

function CustomTplCard({ tpl, onEdit, onDelete, isActive, onSetActive, onPreview }: {
  tpl: CustomTemplate;
  onEdit: () => void;
  onDelete: () => void;
  isActive: boolean;
  onSetActive: () => void;
  onPreview: () => void;
}) {
  let parsed: GovDocTemplateContent | null = null;
  try { parsed = JSON.parse(tpl.content); } catch {}

  return (
    <div className={`bg-white rounded-xl border ${isActive ? "border-[#163f3a]/30 ring-1 ring-[#163f3a]/20" : "border-gray-200"} p-4 hover:shadow-sm transition-shadow`}>
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-medium text-gray-800 truncate">{tpl.name}</h4>
            {isActive && (
              <span className="px-1 py-0.5 rounded text-[9px] font-medium bg-[#163f3a] text-white flex items-center gap-0.5 flex-shrink-0">
                <Check className="w-2 h-2" /> 当前
              </span>
            )}
          </div>
          <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded mt-1 inline-block">
            自定义 · {tpl.category || "通用"}
          </span>
        </div>
      </div>
      {parsed ? (
        <p className="text-[10px] text-gray-400 line-clamp-2 mt-2">
          标题：{parsed.titlePattern} · {parsed.sections.length} 个章节
        </p>
      ) : (
        <p className="text-[10px] text-gray-300 line-clamp-2 mt-2">无结构数据</p>
      )}
      <div className="flex gap-1.5 mt-3">
        {!isActive && (
          <button onClick={onSetActive}
            className="flex items-center gap-1 px-2 py-1 bg-[#163f3a]/10 text-[#163f3a] text-[10px] rounded hover:bg-[#163f3a]/20">
            <Check className="w-3 h-3" /> 设为当前
          </button>
        )}
        <button onClick={onEdit}
          className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 text-[10px] rounded hover:bg-blue-100">
          <Edit3 className="w-3 h-3" /> 编辑
        </button>
        <button onClick={onPreview} title="预览"
          className="p-1.5 text-gray-300 hover:text-gray-500">
          <Eye className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete}
          className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 text-[10px] rounded hover:bg-red-100">
          <Trash2 className="w-3 h-3" /> 删除
        </button>
      </div>
    </div>
  );
}

// ── 子组件：Skill 行（原封不动） ──────────────────

function SkillRow({ skill, onEdit, onDelete, isActive, onToggleActive, onPreview }: {
  skill: DocSkill;
  onEdit: () => void;
  onDelete?: () => void;
  isActive: boolean;
  onToggleActive: () => void;
  onPreview: () => void;
}) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors group ${
      isActive ? "bg-[#163f3a]/5 border-[#163f3a]/20" : "bg-white border-gray-200 hover:border-gray-300"
    }`}>
      <button onClick={onToggleActive} title={isActive ? "取消当前" : "设为当前使用的 Skill"}
        className={`flex items-center justify-center w-4 h-4 rounded border transition-colors flex-shrink-0 ${
          isActive
            ? "bg-[#163f3a] border-[#163f3a] text-white"
            : "border-gray-300 hover:border-[#163f3a]/40"
        }`}>
        {isActive && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
      </button>
      <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: skill.isBuiltin ? "#fef3c7" : "#f0fdf4" }}>
        <Sparkles className={`w-3.5 h-3.5 ${skill.isBuiltin ? "text-amber-500" : "text-green-500"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-800 truncate">{skill.name}</span>
          {skill.isBuiltin && (
            <span className="text-[9px] text-amber-600 bg-amber-50 px-1 py-0.5 rounded">内置</span>
          )}
        </div>
        <p className="text-[10px] text-gray-400 truncate mt-0.5">{skill.content.slice(0, 80)}...</p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onPreview} title="预览"
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
          <Eye className="w-3 h-3" />
        </button>
        <button onClick={onEdit}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-500">
          <Edit3 className="w-3.5 h-3.5" />
        </button>
        {onDelete && (
          <button onClick={onDelete}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── 子组件：模板表单弹窗（增加 allCategories prop） ──

function TemplateFormModal({ initial, defaultCategory, allCategories, onSave, onClose }: {
  initial?: CustomTemplate;
  defaultCategory: string;
  allCategories: string[];
  onSave: (d: { name: string; category: string; content: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [category, setCategory] = useState(initial?.category || defaultCategory);
  const [content, setContent] = useState(initial?.content || "");
  const [editMode, setEditMode] = useState<"md" | "json">("json");
  const [mdText, setMdText] = useState("");

  const defaultContent: GovDocTemplateContent = {
    titlePattern: `关于{topic}的${category}`,
    sections: ["标题", "主送机关", "正文", "发文机关", "成文日期"],
    sectionSamples: [],
    structureHint: "",
    formatRules: [],
  };

  // MD → JSON 转换
  const mdToJson = (md: string): string => {
    const lines = md.split("\n").filter((l) => l.trim());
    const firstLine = lines[0]?.replace(/^#\s*/, "").trim() || "新建公文";
    const restLines = lines.slice(1).filter((l) => !l.startsWith("#"));
    const sections = restLines.length > 0 ? ["标题", ...restLines.map((l) => l.replace(/^#+\s*/, "").trim())] : ["标题", "正文"];
    const json: GovDocTemplateContent = {
      titlePattern: `关于{topic}的${firstLine}`,
      sections: sections.slice(0, 15),
      sectionSamples: [],
      structureHint: "",
      formatRules: [],
    };
    // 如果有 ## 标题，取其后内容作为 sectionSamples
    const sampleLines: string[] = [];
    let currentIdx = -1;
    for (const line of md.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("## ")) {
        currentIdx++;
        sampleLines[currentIdx] = trimmed.replace(/^##\s*/, "");
      } else if (trimmed && currentIdx >= 0) {
        sampleLines[currentIdx] = (sampleLines[currentIdx] || "") + "\n" + trimmed;
      }
    }
    if (sampleLines.length > 0) {
      json.sectionSamples = sections.slice(1).map((_, i) => sampleLines[i + 1] || "");
    }
    return JSON.stringify(json, null, 2);
  };

  // JSON → MD 转换
  const jsonToMd = (jsonStr: string): string => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed || typeof parsed !== "object") return jsonStr;
      const title = parsed.titlePattern?.replace(/\{topic\}/g, "示例") || "新建公文";
      const lines = [`# ${title}`];
      (parsed.sections || []).forEach((s: string, i: number) => {
        if (s === "标题") return;
        lines.push(`\n## ${s}`);
        const sample = parsed.sectionSamples?.[i];
        if (sample) lines.push(sample);
      });
      return lines.join("\n");
    } catch { return jsonStr; }
  };

  const handleFileUpload = async (file: File) => {
    const text = await file.text();
    const fname = file.name.toLowerCase();
    if (fname.endsWith(".md")) {
      setEditMode("md");
      setMdText(text);
      setContent(mdToJson(text));
    } else if (fname.endsWith(".json")) {
      setEditMode("json");
      setContent(text);
      setMdText(jsonToMd(text));
    } else {
      // docx/其他 提示
      const hint = `【来自 ${file.name}】请参考原始文件内容编写模板结构。\n\n文件大小：${(file.size / 1024).toFixed(1)}KB`;
      setEditMode("md");
      setMdText(hint);
      setContent(mdToJson(hint));
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    const finalContent = editMode === "md" ? (content || mdToJson(mdText)) : (content || JSON.stringify(defaultContent));
    onSave({ name: name.trim(), category, content: finalContent });
  };

  // 同步 md → json
  useEffect(() => {
    if (editMode === "md" && mdText.trim()) {
      try { setContent(mdToJson(mdText)); } catch {}
    }
  }, [mdText, editMode]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-[640px] max-w-[90vw] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-gray-800 mb-4">
          {initial ? "编辑模板" : "新建公文模板"}
        </h3>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-gray-500">模板名称 *</span>
              <input value={name} onChange={(e) => setName(e.target.value)}
                placeholder="如：标准通知模板"
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#163f3a]/20" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">公文类型 *</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#163f3a]/20">
                {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>

          {/* 编辑模式切换 + 文件上传 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => { setEditMode("md"); setMdText(jsonToMd(content)); }}
                className={`px-3 py-1 text-[11px] rounded transition-colors ${editMode === "md" ? "bg-[#163f3a] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                MD 纯文本
              </button>
              <button onClick={() => { setEditMode("json"); }}
                className={`px-3 py-1 text-[11px] rounded transition-colors ${editMode === "json" ? "bg-[#163f3a] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                JSON 编辑
              </button>
            </div>
            <div className="flex items-center gap-1">
              <label className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-500 bg-gray-100 rounded cursor-pointer hover:bg-gray-200">
                <FileText className="w-3 h-3" /> 上传文件
                <input type="file" accept=".md,.json,.docx" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
              </label>
            </div>
          </div>

          <SourceGenerateBar
            type="template"
            category={category}
            onGenerated={(c, n) => {
              setContent(c);
              setEditMode("json");
              if (!name.trim() && n) setName(n);
            }}
          />

          {/* 编辑区 */}
          {editMode === "md" ? (
            <label className="block">
              <span className="text-xs text-gray-500">
                Markdown 格式（# 标题 → titlePattern，## 章节 → section，章节下方文字 → sectionSamples）
                <button onClick={() => { setMdText(`# 关于${name || "示例主题"}的${category}\n\n## 主送机关\n各有关单位：\n\n## 正文\n\n## 发文机关\n\n## 成文日期\n`); }}
                  className="ml-2 text-[#163f3a] hover:underline text-[10px]">插入示例</button>
              </span>
              <textarea value={mdText} onChange={(e) => setMdText(e.target.value)} rows={10}
                placeholder="# 关于{topic}的通知\n\n## 主送机关\n\n## 正文\n\n## 发文机关\n\n## 成文日期"
                className="mt-1 w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#163f3a]/20" />
            </label>
          ) : (
            <label className="block">
              <span className="text-xs text-gray-500">
                模板 JSON
                <a href="#" onClick={(e) => { e.preventDefault(); setContent(JSON.stringify(defaultContent, null, 2)); }}
                  className="ml-2 text-[#163f3a] hover:underline">重置为默认结构</a>
              </span>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10}
                placeholder='{"titlePattern":"关于{topic}的通知","sections":["标题","主送机关","正文","发文机关","成文日期"],"sectionSamples":[],"structureHint":"","formatRules":[]}'
                className="mt-1 w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#163f3a]/20" />
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose}
            className="px-4 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">取消</button>
          <button onClick={handleSubmit} disabled={!name.trim()}
            className="px-4 py-1.5 text-xs bg-[#163f3a] text-white rounded-lg hover:bg-[#163f3a]/90 disabled:bg-gray-300">保存</button>
        </div>
      </div>
    </div>
  );
}

// ── 子组件：Skill 表单弹窗 ──────────────────────

function SkillFormModal({ initial, defaultCategory, allCategories, onSave, onClose }: {
  initial?: DocSkill;
  defaultCategory: string;
  allCategories: string[];
  onSave: (d: { name: string; category: string; content: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [category, setCategory] = useState(initial?.category || defaultCategory);
  const [content, setContent] = useState(initial?.content || "");
  const [editMode, setEditMode] = useState<"md" | "json">("md");

  // MD ↔ JSON 转换
  const mdToJson = (md: string): string => {
    const lines = md.split("\n").filter((l) => l.trim());
    const items = lines.map((l) => l.replace(/^\d+[\.\)、\s]*/, "").replace(/^[-*]\s*/, "").trim()).filter(Boolean);
    return JSON.stringify(items, null, 2);
  };
  const jsonToMd = (jsonStr: string): string => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        return parsed.map((item, i) => `${i + 1}. ${typeof item === "string" ? item : JSON.stringify(item)}`).join("\n");
      } else if (typeof parsed === "object" && parsed !== null) {
        const rules = parsed.rules || parsed.items || [];
        if (Array.isArray(rules)) {
          return rules.map((item: any, i: number) => `${i + 1}. ${typeof item === "string" ? item : JSON.stringify(item)}`).join("\n");
        }
      }
      return jsonStr;
    } catch { return jsonStr; }
  };

  const handleFileUpload = async (file: File) => {
    const text = await file.text();
    const fname = file.name.toLowerCase();
    if (fname.endsWith(".md")) {
      setEditMode("md"); setContent(text);
    } else if (fname.endsWith(".json")) {
      setEditMode("json"); setContent(text);
    } else {
      setContent(`【来自 ${file.name}】${(file.size / 1024).toFixed(1)}KB，请参考原始文件编写 Skill 内容。`);
    }
  };

  const handleSubmit = () => {
    if (!name.trim() || !content.trim()) return;
    const finalContent = editMode === "md" ? mdToJson(content) : content;
    onSave({ name: name.trim(), category, content: finalContent });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-[640px] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-gray-800 mb-4">
          {initial ? "编辑 Skill" : "新建写作规范 Skill"}
        </h3>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-gray-500">Skill 名称 *</span>
              <input value={name} onChange={(e) => setName(e.target.value)}
                placeholder="如：通知写作规范"
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#163f3a]/20" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">公文类型 *</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#163f3a]/20">
                {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>

          {/* 模式切换 + 上传 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => { setEditMode("md"); setContent(jsonToMd(content)); }}
                className={`px-3 py-1 text-[11px] rounded transition-colors ${editMode === "md" ? "bg-[#163f3a] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                MD 纯文本
              </button>
              <button onClick={() => { setEditMode("json"); setContent(mdToJson(content)); }}
                className={`px-3 py-1 text-[11px] rounded transition-colors ${editMode === "json" ? "bg-[#163f3a] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                JSON 编辑
              </button>
            </div>
            <div className="flex items-center gap-1">
              <label className="flex items-center gap-1 px-2 py-1 text-[10px] text-gray-500 bg-gray-100 rounded cursor-pointer hover:bg-gray-200">
                <FileText className="w-3 h-3" /> 上传文件
                <input type="file" accept=".md,.json,.docx" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
              </label>
            </div>
          </div>

          <SourceGenerateBar
            type="skill"
            category={category}
            onGenerated={(c, n) => {
              setContent(c);
              setEditMode("md");
              if (!name.trim() && n) setName(n);
            }}
          />

          {/* 编辑区 */}
          {editMode === "md" ? (
            <label className="block">
              <span className="text-xs text-gray-500">
                Markdown 格式（每行一条规则，自动编号）
                <button onClick={() => setContent("1. 标题必须包含事由+文种\n2. 正文事项应具体可操作\n3. 结尾用「特此通知。」\n4. 成文日期用阿拉伯数字")}
                  className="ml-2 text-[#163f3a] hover:underline text-[10px]">插入示例</button>
              </span>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8}
                placeholder="1. 标题必须包含事由+文种&#10;2. 正文事项应具体可操作&#10;3. ..."
                className="mt-1 w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#163f3a]/20" />
            </label>
          ) : (
            <label className="block">
              <span className="text-xs text-gray-500">JSON 格式（字符串数组或 &#123;rules: [...]&#125; 对象）</span>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={8}
                placeholder='["标题必须包含事由+文种","正文事项应具体可操作"]'
                className="mt-1 w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#163f3a]/20" />
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose}
            className="px-4 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">取消</button>
          <button onClick={handleSubmit} disabled={!name.trim() || !content.trim()}
            className="px-4 py-1.5 text-xs bg-[#163f3a] text-white rounded-lg hover:bg-[#163f3a]/90 disabled:bg-gray-300">保存</button>
        </div>
      </div>
    </div>
  );
}

// ── 子组件：来源勾选 + AI 生成（基于知识库/文档管理/金句库/热点推送 生成模板或 Skill）──

const GEN_SOURCES: { key: string; label: string }[] = [
  { key: "knowledge", label: "知识库" },
  { key: "documents", label: "文档管理" },
  { key: "quotations", label: "金句库" },
  { key: "hotspots", label: "热点推送" },
];

function SourceGenerateBar({
  type,
  category,
  onGenerated,
}: {
  type: "template" | "skill";
  category: string;
  onGenerated: (content: string, name: string) => void;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set(["knowledge", "quotations"]));
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggle = (k: string) =>
    setSel((p) => {
      const n = new Set(p);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const run = async () => {
    if (sel.size === 0) {
      setErr("请至少勾选一个来源");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/ai/generate-from-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, category, sources: Array.from(sel) }),
      });
      const b = await r.json();
      if (b.success) onGenerated(b.content || "", b.name || "");
      else setErr(b.error?.message || "生成失败");
    } catch {
      setErr("网络错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-gray-500">基于所选来源 AI 生成：</span>
        {GEN_SOURCES.map((s) => (
          <label key={s.key} className="flex items-center gap-1 text-[11px] text-gray-700 cursor-pointer select-none">
            <input type="checkbox" checked={sel.has(s.key)} onChange={() => toggle(s.key)} className="accent-amber-500" />
            {s.label}
          </label>
        ))}
        <button
          onClick={run}
          disabled={loading}
          className="ml-auto flex items-center gap-1 px-2.5 py-1 text-[11px] text-white bg-amber-500 rounded hover:bg-amber-600 disabled:opacity-60"
        >
          <Sparkles className="w-3 h-3" /> {loading ? "生成中..." : "AI 生成"}
        </button>
      </div>
      {err && <div className="text-[11px] text-red-500">{err}</div>}
      <p className="text-[10px] text-gray-400">生成结果将填入下方编辑区，可预览修改后保存。</p>
    </div>
  );
}

// ── 子组件：确认弹窗 ─────────────────────────────

function ConfirmDialog({ action, onConfirm, onCancel }: {
  action: ConfirmAction;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const config = {
    "delete-tpl": { title: "确认删除模板？", desc: `删除「${action.name}」后无法恢复`, icon: "red" as const },
    "delete-skill": { title: "确认删除 Skill？", desc: `删除「${action.name}」后无法恢复`, icon: "red" as const },
    "restore": { title: "确认恢复默认？", desc: "将清空所有自定义模板，此操作不可撤销", icon: "red" as const },
    "copy-builtin": { title: "确认复制模板？", desc: `将「内置${action.name || "模板"}」复制为可编辑的自定义模板`, icon: "blue" as const },
  };
  const cfg = config[action.type];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            cfg.icon === "red" ? "bg-red-100" : "bg-blue-100"
          }`}>
            <AlertCircle className={`w-5 h-5 ${cfg.icon === "red" ? "text-red-500" : "text-blue-500"}`} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-gray-800">{cfg.title}</h3>
            <p className="text-xs text-gray-500 mt-1">{cfg.desc}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">取消</button>
          <button onClick={onConfirm}
            className={`flex-1 px-4 py-2 text-xs rounded-lg ${
              cfg.icon === "red"
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}>确认</button>
        </div>
      </div>
    </div>
  );
}
