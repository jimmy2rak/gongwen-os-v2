// ─── 回收站页面 ──────────────────────────────────
// 已软删除文档列表：恢复 / 永久删除

"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { getCategoryColor } from "@/types";
import {
  Search, FileText, Trash2, RotateCcw, Clock,
  CheckCircle, AlertCircle, X, AlertTriangle,
} from "lucide-react";
import { cachedFetch, invalidateCache } from "@/lib/cache";

interface TrashItem {
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
  deletedAt: string | number | null;
}

export default function TrashPage() {
  const { user } = useAuthStore();

  const [docs, setDocs] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [error, setError] = useState("");

  // 选中
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // 操作状态
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmHardDelete, setConfirmHardDelete] = useState<string | "batch" | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // 审阅人映射（从 API 返回的 reviewerName 直接读取）
  const getReviewerName = (doc: any): string => {
    if (!doc.reviewed) return "待审阅";
    return doc.reviewerName || "待审阅";
  };

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  // 日期格式化
  const fmtTime = (ts: string | number | null | undefined): string => {
    if (ts === null || ts === undefined || ts === "" || ts === 0) return "--";
    try {
      const val = typeof ts === "number" && ts < 1000000000000 ? ts * 1000 : ts;
      const d = new Date(val);
      if (isNaN(d.getTime())) return "--";
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}/${m}/${day}`;
    } catch { return "--"; }
  };

  // 字数
  const countChars = (html: string | undefined | null): number => {
    if (!html) return 0;
    try { return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim().length; }
    catch { return 0; }
  };

  // 加载回收站列表（含缓存）
  const loadDocs = useCallback(async (q: string, skipCache = false) => {
    setLoading(true);
    setError("");
    try {
      const url = q
        ? `/api/documents?deleted=true&search=${encodeURIComponent(q)}&pageSize=100`
        : "/api/documents?deleted=true&pageSize=100";
      const fetcher = async () => {
        const res = await fetch(url);
        if (res.status === 401 || res.redirected) return { __unauthorized: true };
        if (!res.ok) throw new Error("请求失败");
        return res.json();
      };
      const body = await cachedFetch(`trash:${q}`, fetcher, skipCache ? 0 : 30_000);
      if ((body as any).__unauthorized) {
        setLoading(false);
        return;
      }
      if (body.success) {
        setDocs(body.data || []);
      } else {
        setError(body.error?.message || "加载失败");
      }
    } catch {
      setError("网络错误，请刷新重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) loadDocs(""); }, [user, loadDocs]);

  // 搜索防抖
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      if (searchInput !== search) loadDocs(searchInput);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput, search, loadDocs]);

  // 全选
  const toggleSelectAll = () => {
    if (selectAll) { setSelected(new Set()); setSelectAll(false); }
    else { setSelectAll(true); }
  };
  useEffect(() => {
    if (selectAll) setSelected(new Set(docs.map((d) => d.id)));
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

  // 恢复单条
  const handleRestore = async (id: string) => {
    setRestoring(true);
    try {
      const res = await fetch(`/api/documents/${id}/restore`, { method: "PUT" });
      const body = await res.json();
      if (body.success) {
        setDocs((prev) => prev.filter((d) => d.id !== id));
        setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
        invalidateCache("trash:");
        invalidateCache("documents:");
        showToast("success", "恢复成功");
      } else {
        showToast("error", body.error?.message || "恢复失败");
      }
    } catch {
      showToast("error", "网络错误");
    } finally {
      setRestoring(false);
    }
  };

  // 永久删除单条
  const handleHardDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${id}/hard`, { method: "DELETE" });
      const body = await res.json();
      if (body.success) {
        setDocs((prev) => prev.filter((d) => d.id !== id));
        setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
        invalidateCache("trash:");
        showToast("success", "已永久删除");
      } else {
        showToast("error", body.error?.message || "删除失败");
      }
    } catch {
      showToast("error", "网络错误");
    } finally {
      setDeleting(false);
      setConfirmHardDelete(null);
    }
  };

  // 批量恢复
  const handleBatchRestore = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setRestoring(true);
    try {
      const res = await fetch("/api/documents/batch/restore", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const body = await res.json();
      if (body.success) {
        setDocs((prev) => prev.filter((d) => !ids.includes(d.id)));
        setSelected(new Set());
        setSelectAll(false);
        invalidateCache("trash:");
        invalidateCache("documents:");
        showToast("success", `已恢复 ${ids.length} 篇文档`);
      } else {
        showToast("error", body.error?.message || "批量恢复失败");
      }
    } catch {
      showToast("error", "网络错误");
    } finally {
      setRestoring(false);
    }
  };

  // 批量永久删除
  const handleBatchHardDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/documents/batch/hard", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const body = await res.json();
      if (body.success) {
        setDocs((prev) => prev.filter((d) => !ids.includes(d.id)));
        setSelected(new Set());
        setSelectAll(false);
        invalidateCache("trash:");
        showToast("success", `已永久删除 ${ids.length} 篇文档`);
      } else {
        showToast("error", body.error?.message || "批量删除失败");
      }
    } catch {
      showToast("error", "网络错误");
    } finally {
      setDeleting(false);
      setConfirmHardDelete(null);
    }
  };

  const selectedCount = selected.size;

  return (
    <DashboardLayout title="回收站">
      <div className="p-6 max-w-6xl mx-auto">
        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm ${
            toast.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {toast.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.message}
          </div>
        )}

        {/* 标题 & 搜索 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text" value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="搜索已删除文档..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
            />
          </div>
        </div>

        {/* 批量操作栏 */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-2 mb-3 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
            <span className="text-xs text-amber-600 font-medium">已选 {selectedCount} 篇</span>
            <span className="w-px h-4 bg-amber-200" />
            <button
              onClick={handleBatchRestore} disabled={restoring}
              className="flex items-center gap-1 px-3 py-1 text-[11px] bg-white border border-green-300 text-green-600 rounded-md hover:bg-green-50 transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> {restoring ? "恢复中..." : "批量恢复"}
            </button>
            <button
              onClick={() => setConfirmHardDelete("batch")}
              className="flex items-center gap-1 px-3 py-1 text-[11px] bg-white border border-red-300 text-red-600 rounded-md hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> 批量永久删除
            </button>
            <button
              onClick={() => { setSelected(new Set()); setSelectAll(false); }}
              className="ml-auto flex items-center gap-1 px-2 py-1 text-[11px] text-gray-500 hover:text-gray-700"
            >
              <X className="w-3 h-3" /> 取消
            </button>
          </div>
        )}

        {error && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

        {/* 加载 */}
        {loading && (
          <div className="text-center py-16 text-sm text-gray-400">
            <div className="w-8 h-8 border-2 border-red-300 border-t-red-600 rounded-full animate-spin mx-auto mb-3" />
            加载中...
          </div>
        )}

        {/* 空状态 */}
        {!loading && !error && docs.length === 0 && (
          <div className="text-center py-20">
            <FileText className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">回收站为空</p>
          </div>
        )}

        {/* 表格 */}
        {!loading && !error && docs.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
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
                  <th className="text-left px-2 py-3 text-[11px] font-medium text-[#c9a55c] uppercase tracking-wider hidden lg:table-cell">删除时间</th>
                  <th className="text-right px-3 py-3 text-[11px] font-medium text-[#c9a55c] uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => {
                  const isSelected = selected.has(doc.id);
                  return (
                    <tr key={doc.id} className={`border-b border-gray-50 transition-colors ${isSelected ? "bg-amber-50/50" : "hover:bg-[#c9a55c]/[0.04]"}`}>
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(doc.id)}
                          className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer" />
                      </td>
                      <td className="px-2 py-3" style={{ maxWidth: "35%", minWidth: 160 }}>
                        <span className="text-xs leading-5 text-gray-800 font-medium"
                          style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis", wordBreak: "break-word" }}>
                          {doc.title}
                        </span>
                      </td>
                      <td className="px-2 py-3 hidden sm:table-cell">
                        <span className="inline-block px-2 py-0.5 text-[10px] font-medium rounded-full"
                          style={{ backgroundColor: getCategoryColor(doc.category) + "15", color: getCategoryColor(doc.category) }}>
                          {doc.category}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-center hidden md:table-cell">
                        <span className="text-xs text-gray-400">{countChars(doc.content)}</span>
                      </td>
                      <td className="px-2 py-3 hidden lg:table-cell">
                        <span className="text-xs text-gray-500">{fmtTime(doc.createdAt)}</span>
                      </td>
                      <td className="px-2 py-3 hidden lg:table-cell">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-gray-300 flex-shrink-0" />
                          <span className="text-xs text-gray-500">{fmtTime(doc.updatedAt)}</span>
                        </div>
                      </td>
                      <td className="px-2 py-3 hidden xl:table-cell">
                        <span className={`text-xs ${doc.reviewed ? "text-gray-600" : "text-gray-400"}`}>
                          {getReviewerName(doc)}
                        </span>
                      </td>
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
                      <td className="px-2 py-3 hidden lg:table-cell">
                        <span className="text-xs text-red-400">{fmtTime(doc.deletedAt)}</span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-0.5" style={{ minWidth: 120 }}>
                          <button onClick={() => handleRestore(doc.id)} disabled={restoring}
                            className="p-1.5 rounded-md text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors" title="恢复">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          {confirmHardDelete === doc.id ? (
                            <div className="flex items-center gap-1 ml-1">
                              <button onClick={() => handleHardDelete(doc.id)} disabled={deleting}
                                className="px-2 py-1 text-[10px] bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
                                {deleting ? "..." : "确认"}
                              </button>
                              <button onClick={() => setConfirmHardDelete(null)} className="px-2 py-1 text-[10px] bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200">取消</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmHardDelete(doc.id)}
                              className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="永久删除">
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
      </div>

      {/* 高危确认弹窗 */}
      {confirmHardDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmHardDelete(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-800">确认永久删除？</h3>
                <p className="text-xs text-gray-500 mt-1">此操作不可逆，文档将彻底从数据库移除，无法恢复。</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={confirmHardDelete === "batch" ? handleBatchHardDelete : () => handleHardDelete(confirmHardDelete)}
                className="flex-1 px-4 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                {deleting ? "删除中..." : "确认永久删除"}
              </button>
              <button onClick={() => setConfirmHardDelete(null)} className="flex-1 px-4 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
