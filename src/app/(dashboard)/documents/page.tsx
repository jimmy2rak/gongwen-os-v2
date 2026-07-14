// ─── 文档管理页面 ────────────────────────────────
// 表格展示、搜索、复选框批量操作、预览、审阅、下载、软删除

"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PreviewModal } from "@/components/editor/PreviewModal";
import { ExportMenu } from "@/components/editor/ExportMenu";
import { ReviewDialog } from "@/components/editor/ReviewDialog";
import { ImportDocxModal } from "@/components/editor/ImportDocxModal";
import { CategoryFilterPills } from "@/components/ui/CategoryFilterPills";
import { getCategoryColor, getAllCategories, DOCUMENT_CATEGORIES } from "@/types";
import { getFavoriteIds, isFavorite, toggleFavorite } from "@/lib/favorite-store";
import { cachedFetch, invalidateCache } from "@/lib/cache";
import {
  Search, Plus, FileText, Trash2, Edit3, Eye, SendHorizonal,
  Clock, CheckCircle, AlertCircle, X, Filter, ArrowUpDown, Star, FileUp,
} from "lucide-react";

interface DocItem {
  id: string;
  title: string;
  category: string;
  format: string;
  content?: string;
  reviewed: boolean;
  reviewerId: string | null;
  reviewerName?: string;
  createdAt: string | number;
  updatedAt: string | number;
  reviewedAt: string | number | null;
}

export default function DocumentsPage() {
  const { user } = useAuthStore();

  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [error, setError] = useState("");

  // 审阅人映射（从 API 返回的 reviewerName 直接读取）
  const getReviewerName = (doc: DocItem): string => {
    if (!doc.reviewed) return "待审阅";
    return (doc as any).reviewerName || "待审阅";
  };

  // 选中状态
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // 删除确认
  const [confirmDelete, setConfirmDelete] = useState<string | "batch" | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 内部弹窗（替代原生 alert / 已审阅拦截）
  const [dialog, setDialog] = useState<{ title: string; message: string } | null>(null);
  const showDialog = (title: string, message: string) => setDialog({ title, message });
  const closeDialog = () => setDialog(null);

  // 预览
  const [previewDoc, setPreviewDoc] = useState<DocItem | null>(null);
  // 收藏
  const [favIds, setFavIds] = useState<Set<string>>(new Set(getFavoriteIds()));
  const [favFilter, setFavFilter] = useState(false);

  // 审阅
  const [reviewDocId, setReviewDocId] = useState<string | "batch" | null>(null);

  // 搜索状态
  const [search, setSearch] = useState("");
  // 分类筛选
  const [catFilter, setCatFilter] = useState("");
  const allCats = getAllCategories();
  // 多元排序：字段 + 优先级（下标越小越优先）
  const sortFields = ["更新时间", "文件名", "公文类型", "审阅状态"] as const;
  const [sortPriority, setSortPriority] = useState<string[]>(["更新时间", "文件名", "公文类型", "审阅状态"]);
  const [showSortMenu, setShowSortMenu] = useState(false);
  // 从 Word 导入弹窗
  const [showDocxImport, setShowDocxImport] = useState(false);

  // 排序函数：按优先级多字段排序
  const sortDocs = (list: DocItem[]): DocItem[] => {
    return [...list].sort((a, b) => {
      for (const field of sortPriority) {
        let cmp = 0;
        switch (field) {
          case "更新时间":
            cmp = (new Date(b.updatedAt || 0).getTime()) - (new Date(a.updatedAt || 0).getTime());
            break;
          case "文件名":
            cmp = a.title.localeCompare(b.title, "zh-CN");
            break;
          case "公文类型":
            cmp = a.category.localeCompare(b.category, "zh-CN");
            break;
          case "审阅状态":
            cmp = Number(a.reviewed) - Number(b.reviewed);
            break;
        }
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
  };

  // 加载文档列表（含缓存）
  const loadDocs = useCallback(async (q: string, cat?: string, skipCache = false) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ pageSize: "100" });
      if (q) params.set("search", q);
      if (cat) params.set("category", cat);
      const url = `/api/documents?${params}`;
      const fetcher = async () => {
        const res = await fetch(url);
        if (res.status === 401 || res.redirected) return { __unauthorized: true };
        if (!res.ok) throw new Error("请求失败");
        return res.json();
      };
      const body = await cachedFetch(
        `documents:${q}:${cat || ""}`,
        fetcher,
        skipCache ? 0 : 30_000,
      );
      if ((body as any).__unauthorized) {
        setLoading(false);
        return;
      }
      if (body.success) {
        const list = body.data || [];
        setDocs(list);
      } else {
        setError(body.error?.message || "加载失败");
      }
    } catch (e) {
      console.error("[loadDocs] 异常:", e);
      setError("网络错误，请刷新重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) loadDocs("", catFilter); }, [user, loadDocs, catFilter]);

  // 分类变化时重新加载
  useEffect(() => { if (user) { loadDocs(searchInput, catFilter); } }, [catFilter]);

  // 路由切换/浏览历史返回时刷新数据
  useEffect(() => {
    const onShow = () => { if (user) loadDocs("", catFilter, true); };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, [user, loadDocs, catFilter]);

  // 搜索防抖
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      if (searchInput !== search) loadDocs(searchInput);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // 全选/取消
  useEffect(() => {
    if (selectAll) {
      setSelected(new Set(docs.map((d) => d.id)));
    }
  }, [selectAll, docs]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelectAll(next.size === docs.length && docs.length > 0);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelected(new Set());
      setSelectAll(false);
    } else {
      setSelectAll(true);
    }
  };

  // ─── 日期格式化 ─────────────────────────────
  // 接口返回的是 ISO 字符串如 "2026-07-03T15:08:23.000Z"，直接 new Date(ts) 即可
  const fmtTime = (ts: string | number | null | undefined): string => {
    if (ts === null || ts === undefined || ts === "" || ts === 0) return "--";
    try {
      // 兼容旧数据：如果是数字且小于 1e12 则视为秒级时间戳（*1000）
      const val = typeof ts === "number" && ts < 1000000000000 ? ts * 1000 : ts;
      const d = new Date(val);
      if (isNaN(d.getTime())) return "--";
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return `今天 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      }
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) {
        return `昨天 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      }
      return `${y}/${m}/${day}`;
    } catch {
      return "--";
    }
  };

  // ─── 字数 ───────────────────────────────────
  const countChars = (html: string | undefined | null): number => {
    if (!html) return 0;
    try {
      const text = html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
      const cn = (text.match(/[\u4e00-\u9fff]/g) || []).length;
      const en = text.replace(/[\u4e00-\u9fff]/g, " ").split(/\s+/).filter(Boolean).length;
      return cn + en;
    } catch {
      return 0;
    }
  };

  // ─── 操作函数 ───────────────────────────────
  const handleEdit = (id: string) => { window.location.href = `/documents/${id}`; };
  const handleNew = () => { window.location.href = "/"; };

  // 从 Word 导入：创建新文档并刷新列表
  const importDocx = async (data: { html: string; title: string; category: string }) => {
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: data.title, category: data.category, content: data.html, format: "gb" }),
      });
      const b = await res.json();
      if (b.success) {
        setShowDocxImport(false);
        invalidateCache("documents:");
        loadDocs(searchInput, catFilter, true);
        showDialog("导入成功", `「${data.title}」已导入到文档库`);
      } else {
        showDialog("导入失败", b.error?.message || "创建文档失败");
      }
    } catch {
      showDialog("导入失败", "网络错误");
    }
  };

  // ─── 删除前置校验 + 执行 ─────────────────────
  // 先检查选中文档的审阅状态，已审阅 → 弹窗拦截；非已审阅 → 走原有删除流程
  const handleDeleteClick = async (id: string) => {
    try {
      const res = await fetch(`/api/documents/${id}`);
      if (!res.ok) return;
      const body = await res.json();
      if (body.success && body.data?.reviewed) {
        // 已审阅 → 弹窗拦截，DOM 不动
        showDialog("无法删除", "该文档已完成审阅，无法直接删除，请先退回审阅后再执行删除操作");
        return;
      }
    } catch {}
    // 非已审阅 → 弹出原有确认按钮（原有交互不动）
    setConfirmDelete(id);
  };

  // 批量删除前置校验
  const handleBatchDeleteClick = async () => {
    const ids = Array.from(selected);
    try {
      // 并行预检所有选中文档状态
      const checks = await Promise.all(
        ids.map(async (id) => {
          const res = await fetch(`/api/documents/${id}`);
          if (!res.ok) return null;
          const body = await res.json();
          return body.data;
        })
      );
      const reviewed = checks.filter((d) => d?.reviewed);
      if (reviewed.length > 0) {
        showDialog("无法批量删除", `存在 ${reviewed.length} 篇已完成审阅的文档无法删除，请先退回审阅后再执行删除操作`);
        return;
      }
    } catch {}
    // 全部可删除 → 弹出原有批量确认按钮
    setConfirmDelete("batch");
  };

  // 执行删除（仅在用户点击「确认」后调用）
  const performDelete = async (ids: string[]) => {
    setDeleting(true);
    try {
      const res = await fetch("/api/documents/batch/delete", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const body = await res.json();
      if (body.success) {
        setDocs((prev) => prev.filter((d) => !ids.includes(d.id)));
        setSelected(new Set());
        setSelectAll(false);
        invalidateCache("documents:");
        if (body.blocked?.length > 0) {
          showDialog("删除结果", `${body.blocked.length} 篇已审阅文档被跳过删除`);
        }
      } else {
        showDialog("删除失败", body.error?.message || "操作失败");
      }
    } catch {
      showDialog("网络错误", "删除失败，请检查网络后重试");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  // 审阅
  const handleReview = async (reviewerId: string, reviewerName: string, approved: boolean) => {
    const ids = reviewDocId === "batch" ? Array.from(selected) : [reviewDocId!];
    if (ids.length === 0) return;
    try {
      for (const id of ids) {
        await fetch(`/api/documents/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewed: approved, reviewerId: approved ? reviewerId : null }),
        });
      }
      setReviewDocId(null);
      showDialog("审阅完成", approved ? `已审阅 ${ids.length} 篇` : `已驳回`);
      invalidateCache("documents:");
      loadDocs(search, catFilter, true);
    } catch {
      showDialog("审阅失败", "审阅操作失败，请重试");
    }
  };

  const selectedCount = selected.size;

  return (
    <DashboardLayout title="文档管理">
      <div className="p-6 max-w-6xl mx-auto">
        {/* 工具栏 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm" style={{ cursor: "default" }}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" style={{ cursor: "default" }} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onBlur={() => window.getSelection()?.removeAllRanges()}
              placeholder="搜索文档标题..."
              className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 [&:not(:focus)]:cursor-default"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                title="清除搜索"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={handleNew}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> 新建文档
          </button>
          <button
            onClick={() => setShowDocxImport(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileUp className="w-4 h-4" /> 导入 DOCX
          </button>
        </div>

        {/* 筛选与排序 */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {/* 收藏筛选 */}
          <button onClick={() => { setFavFilter(!favFilter); if (favFilter) setCatFilter(""); }}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
              favFilter ? "bg-amber-50 border-amber-300 text-amber-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}>
            <Star className="w-3 h-3" fill={favFilter ? "currentColor" : "none"} /> 收藏
          </button>

          {/* 分类筛选 — 改为 pill 样式（公文类型联动机制不变） */}
          <CategoryFilterPills
            active={catFilter}
            onChange={(cat) => setCatFilter(cat)}
          />

          {/* 排序设置 */}
          <div className="relative">
            <button onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
              <ArrowUpDown className="w-3 h-3" /> 排序
            </button>
            {showSortMenu && (
              <div className="absolute left-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                <div className="px-3 py-1.5 text-[10px] text-gray-400 border-b border-gray-100">排序优先级（拖动调整）</div>
                {sortPriority.map((field, i) => (
                  <div key={field} className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
                    <span className="text-[10px] text-gray-300 w-4">{i + 1}</span>
                    <input type="checkbox" checked={sortPriority.includes(field)}
                      onChange={() => {
                        setSortPriority((prev) => {
                          if (prev.includes(field)) return prev.filter((f) => f !== field);
                          return [...prev, field];
                        });
                      }}
                      className="w-3 h-3 rounded border-gray-300 text-[#163f3a] focus:ring-[#163f3a]/30" />
                    <span className="flex-1">{field}</span>
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => {
                        if (i > 0) {
                          setSortPriority((prev) => {
                            const next = [...prev];
                            [next[i - 1], next[i]] = [next[i], next[i - 1]];
                            return next;
                          });
                        }
                      }} className="text-[9px] text-gray-300 hover:text-gray-500">▲</button>
                      <button onClick={() => {
                        if (i < sortPriority.length - 1) {
                          setSortPriority((prev) => {
                            const next = [...prev];
                            [next[i], next[i + 1]] = [next[i + 1], next[i]];
                            return next;
                          });
                        }
                      }} className="text-[9px] text-gray-300 hover:text-gray-500">▼</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 批量操作栏 */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-2 mb-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg">
            <span className="text-xs text-red-600 font-medium">已选 {selectedCount} 篇</span>
            <span className="w-px h-4 bg-red-200" />
            <button
              onClick={handleBatchDeleteClick}
              className="flex items-center gap-1 px-3 py-1 text-[11px] bg-white border border-red-200 text-red-600 rounded-md hover:bg-red-100 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> 批量删除
            </button>
            <button
              onClick={() => setReviewDocId("batch")}
              className="flex items-center gap-1 px-3 py-1 text-[11px] bg-white border border-amber-300 text-amber-600 rounded-md hover:bg-amber-50 transition-colors"
            >
              <SendHorizonal className="w-3 h-3" /> 批量提交审阅
            </button>
            <button
              onClick={() => { setSelected(new Set()); setSelectAll(false); }}
              className="ml-auto flex items-center gap-1 px-2 py-1 text-[11px] text-gray-500 hover:text-gray-700"
            >
              <X className="w-3 h-3" /> 取消
            </button>
          </div>
        )}

        {/* 错误 */}
        {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

        {/* 加载中 */}
        {loading && (
          <div className="text-center py-16 text-sm text-gray-400">
            <div className="w-8 h-8 border-2 border-red-300 border-t-red-600 rounded-full animate-spin mx-auto mb-3" />
            加载中...
          </div>
        )}

        {/* 空状态 */}
        {!loading && !error && docs.length === 0 && (
          <div className="text-center py-20">
            <FileText className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <h3 className="text-sm font-medium text-gray-500 mb-2">还没有文档</h3>
            <p className="text-xs text-gray-400 mb-5">去新建一篇公文吧</p>
            <button
              onClick={handleNew}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> 新建文档
            </button>
          </div>
        )}

        {/* 文档表格 */}
        {!loading && !error && docs.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto md:overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#c9a55c]/10 bg-[#c9a55c]/[0.06]">
                  <th className="w-10 px-3 py-3">
                    <input type="checkbox" checked={selectAll} onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-[#c9a55c]/30 text-[#c9a55c] focus:ring-[#c9a55c]/30 cursor-pointer" />
                  </th>
                  <th className="text-left px-2 py-3 text-[11px] font-medium text-[#c9a55c] uppercase tracking-wider">标题</th>
                  <th className="text-left px-2 py-3 text-[11px] font-medium text-[#c9a55c] uppercase tracking-wider hidden sm:table-cell">分类</th>
                  <th className="text-center px-2 py-3 text-[11px] font-medium text-[#c9a55c] uppercase tracking-wider hidden md:table-cell">字数</th>
                  <th className="text-left px-2 py-3 text-[11px] font-medium text-[#c9a55c] uppercase tracking-wider hidden lg:table-cell">创建时间</th>
                  <th className="text-left px-2 py-3 text-[11px] font-medium text-[#c9a55c] uppercase tracking-wider hidden lg:table-cell">修改时间</th>
                  <th className="text-left px-2 py-3 text-[11px] font-medium text-[#c9a55c] uppercase tracking-wider hidden xl:table-cell">审阅人</th>
                  <th className="text-center px-2 py-3 text-[11px] font-medium text-[#c9a55c] uppercase tracking-wider">审阅状态</th>
                  <th className="text-right px-3 py-3 text-[11px] font-medium text-[#c9a55c] uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody>
                {sortDocs(favFilter ? docs.filter((d) => favIds.has(d.id)) : docs).map((doc) => {
                  const isSelected = selected.has(doc.id);
                  return (
                    <tr key={doc.id} className={`border-b border-gray-50 transition-colors ${isSelected ? "bg-red-50/50" : "hover:bg-[#c9a55c]/[0.04]"}`}>
                      {/* 复选框 */}
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(doc.id)}
                          className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer" />
                      </td>
                      {/* 标题——最宽列，最多两行，溢出省略号 */}
                      <td className="px-2 py-3" style={{ maxWidth: "35%", minWidth: 160 }}>
                        <span className="text-xs leading-5 text-gray-800 font-medium"
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            wordBreak: "break-word",
                          }}>
                          {doc.title}
                        </span>
                      </td>
                      {/* 分类 */}
                      <td className="px-2 py-3 hidden sm:table-cell">
                        <span className="inline-block px-2 py-0.5 text-[10px] font-medium rounded-full"
                          style={{ backgroundColor: getCategoryColor(doc.category) + "15", color: getCategoryColor(doc.category) }}>
                          {doc.category}
                        </span>
                      </td>
                      {/* 字数 */}
                      <td className="px-2 py-3 text-center hidden md:table-cell">
                        <span className="text-xs text-gray-400">{countChars(doc.content)}</span>
                      </td>
                      {/* 创建时间 */}
                      <td className="px-2 py-3 hidden lg:table-cell">
                        <span className="text-xs text-gray-500">{fmtTime(doc.createdAt)}</span>
                      </td>
                      {/* 修改时间 */}
                      <td className="px-2 py-3 hidden lg:table-cell">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-gray-300 flex-shrink-0" />
                          <span className="text-xs text-gray-500">{fmtTime(doc.updatedAt)}</span>
                        </div>
                      </td>
                      {/* 审阅人 */}
                      <td className="px-2 py-3 hidden xl:table-cell">
                        <span className={`text-xs ${doc.reviewed ? "text-gray-600" : "text-gray-400"}`}>
                          {getReviewerName(doc)}
                        </span>
                      </td>
                      {/* 审阅状态 */}
                      <td className="px-2 py-3 text-center">
                        {doc.reviewed ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-green-600">
                            <CheckCircle className="w-3 h-3" /> 已审阅
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-600">
                            <AlertCircle className="w-3 h-3" /> 未审阅
                          </span>
                        )}
                      </td>
                      {/* 操作 */}
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-0.5 min-w-0 md:min-w-[210px]">
                          <button onClick={() => { const nowFav = toggleFavorite(doc.id); setFavIds(new Set(getFavoriteIds())); }}
                            className={`p-1.5 rounded-md transition-colors ${favIds.has(doc.id) ? "text-amber-400 hover:text-amber-500" : "text-gray-300 hover:text-amber-400"}`}
                            title={favIds.has(doc.id) ? "取消收藏" : "收藏"}>
                            <Star className="w-3.5 h-3.5" fill={favIds.has(doc.id) ? "currentColor" : "none"} />
                          </button>
                          <button onClick={() => handleEdit(doc.id)} className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="编辑">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setPreviewDoc(doc)} className="p-1.5 rounded-md text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors" title="预览">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { if (doc.id) setReviewDocId(doc.id); }}
                            className="p-1.5 rounded-md text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="提交审阅">
                            <SendHorizonal className="w-3.5 h-3.5" />
                          </button>
                          <ExportMenu title={doc.title} content={doc.content || ""} size="sm" />
                          {confirmDelete === doc.id ? (
                            <div className="flex items-center gap-1 ml-1">
                              <button onClick={() => performDelete([doc.id])} disabled={deleting}
                                className="px-2 py-1 text-[10px] bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
                                {deleting ? "..." : "确认"}
                              </button>
                              <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 text-[10px] bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200">取消</button>
                            </div>
                          ) : (
                            <button onClick={() => handleDeleteClick(doc.id)} className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="删除">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 底部统计 */}
        {!loading && !error && docs.length > 0 && (
          <div className="mt-3 text-center text-[10px] text-gray-400">
            共 {docs.length} 篇文档
          </div>
        )}
      </div>

      {/* 批量删除确认弹窗 */}
      {confirmDelete === "batch" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-80" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-gray-800 mb-3">确认批量删除？</h3>
            <p className="text-xs text-gray-500 mb-5">将删除已选的 {selectedCount} 篇文档（软删除，可恢复）。</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">取消</button>
              <button onClick={() => performDelete(Array.from(selected))} disabled={deleting} className="flex-1 px-4 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {deleting ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 预览弹窗 */}
      <PreviewModal
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.title || ""}
        content={previewDoc?.content || ""}
        docId={previewDoc?.id || null}
        onFullEdit={() => { if (previewDoc) { const id = previewDoc.id; setPreviewDoc(null); handleEdit(id); } }}
      />

      {/* 审阅弹窗 */}
      <ReviewDialog
        open={!!reviewDocId}
        onClose={() => setReviewDocId(null)}
        onReview={handleReview}
      />

      {/* 从 Word 导入弹窗 */}
      <ImportDocxModal
        open={showDocxImport}
        onClose={() => setShowDocxImport(false)}
        onConfirm={importDocx}
        submitLabel="导入到文档库"
      />

      {/* 内部提示弹窗（替代原生 alert / 已审阅拦截） */}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeDialog}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-gray-800">{dialog.title}</h3>
                <p className="text-xs text-gray-500 mt-1">{dialog.message}</p>
              </div>
            </div>
            <button onClick={closeDialog}
              className="w-full px-4 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
              确定
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
