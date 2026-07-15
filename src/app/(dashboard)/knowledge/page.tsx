// ─── 公文知识库（已审阅公文库 / 金句库） ──────────
// 顶部点选菜单可切换「已审阅公文库」与「金句库」。
// 默认展示已审阅公文库，不持久化用户偏好（刷新/重登回到已审阅公文库）。
// 金句库：手动录入、列表展示、点击定位原文档、删除。

"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PreviewModal } from "@/components/editor/PreviewModal";
import { ExportMenu } from "@/components/editor/ExportMenu";
import { ImportDocxModal } from "@/components/editor/ImportDocxModal";
import { CustomDialog } from "@/components/ui/CustomDialog";
import { AddQuoteDialog } from "@/components/quotations/AddQuoteDialog";
import { useQuotations } from "@/lib/quotations/use-quotations";
import { useQuotationStore } from "@/stores/quotation.store";
import Link from "next/link";
import {
  BookOpen, FileText, XCircle, Search, Filter,
  ExternalLink, Trash2, Clock, UserCheck, Eye, MessageSquare, FileUp,
  Quote as QuoteIcon, Plus, ChevronDown, MapPin,
} from "lucide-react";
import { KnowledgeChat } from "@/components/ai/KnowledgeChat";
import { getAllCategories, getCategoryColor } from "@/types";
import { cachedFetch, invalidateCache } from "@/lib/cache";
import { getCachedData, writePreload, invalidatePreload } from "@/lib/preload-cache";

interface KnowledgeDoc {
  id: string;
  title: string;
  category: string;
  format: string;
  content: string;
  reviewed: boolean;
  reviewedAt: string;
  reviewerName?: string;
  updatedAt: string;
}

type ViewMode = "reviewed" | "quotes";

export default function KnowledgePage() {
  const userId = useAuthStore((s) => s.user?.id);
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("reviewed"); // 默认已审阅公文库，不持久化
  const [menuOpen, setMenuOpen] = useState(false);

  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<string>("");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [previewDoc, setPreviewDoc] = useState<KnowledgeDoc | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ docId: string; title: string } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [showDocxImport, setShowDocxImport] = useState(false);
  const [showAddQuote, setShowAddQuote] = useState(false);
  const [locateDoc, setLocateDoc] = useState<{ id: string; title: string; content: string; locate: string } | null>(null);
  const allCats = getAllCategories();

  // 金句（全部）
  const { quotes, loading: quotesLoading, deleteQuote } = useQuotations();

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 2500);
  };

  const lastDocsKey = useRef("knowledge::");
  const bumpPreload = () => invalidatePreload(userId, lastDocsKey.current);

  const loadDocs = () => {
    const key = `knowledge:${activeCat}:${search}`;
    lastDocsKey.current = key;
    const cached = getCachedData<{ data: KnowledgeDoc[] }>(userId, key);
    if (cached?.data?.length) {
      setDocs(cached.data);
      setLoading(false);
    } else {
      setLoading(true);
    }
    const params = new URLSearchParams({ reviewed: "true", pageSize: "100" });
    if (activeCat) params.set("category", activeCat);
    if (search) params.set("search", search);
    const url = `/api/documents?${params}`;
    cachedFetch(
      `knowledge:${activeCat}:${search}`,
      () => fetch(url).then((r) => r.json()),
      30_000,
    )
      .then((b) => {
        if (b.success) {
          const list = b.data?.items || b.data || [];
          setDocs(list);
          writePreload(userId, key, { success: true, data: list });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadDocs(); }, [activeCat, search]);

  // 驳回审阅
  const rejectReview = async (docId: string, title: string) => {
    setConfirmDel({ docId, title });
  };

  const doRejectReview = async (docId: string, title: string) => {
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewed: false }),
      });
      const b = await res.json();
      if (b.success) {
        setDocs((prev) => prev.filter((d) => d.id !== docId));
        invalidateCache("knowledge:");
        bumpPreload();
        showToast("success", `已驳回审阅：「${title}」`);
      } else {
        showToast("error", "操作失败");
      }
    } catch {
      showToast("error", "网络错误");
    }
  };

  const filteredDocs = docs.filter((d) => {
    if (search && !d.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // 从 Word 导入并强制审阅（知识库仅收纳已审阅公文）
  const importDocx = async (data: { html: string; title: string; category: string }) => {
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          category: data.category,
          content: data.html,
          format: "gb",
          reviewed: true,
          reviewerName: "系统导入",
        }),
      });
      const b = await res.json();
      if (b.success) {
        setShowDocxImport(false);
        invalidateCache("knowledge:");
        bumpPreload();
        loadDocs();
        showToast("success", `「${data.title}」已导入并标记为已审阅`);
      } else {
        showToast("error", b.error?.message || "导入失败");
      }
    } catch {
      showToast("error", "网络错误");
    }
  };

  // 金句：点击定位到原文档/文章
  const handleLocate = async (q: { id: string; content: string; sourceType: string; sourceId: string }) => {
    if (q.sourceType === "hotspot") {
      if (!q.sourceId) { showToast("error", "该金句无来源"); return; }
      useQuotationStore.getState().setPendingLocate({ sourceId: q.sourceId, content: q.content });
      router.push("/hotspots");
      return;
    }
    if (q.sourceId) {
      try {
        const r = await fetch(`/api/documents/${q.sourceId}`).then((r) => r.json());
        if (r.success && r.data) {
          setLocateDoc({ id: q.sourceId, title: r.data.title, content: r.data.content, locate: q.content });
        } else {
          showToast("error", "未找到来源文档");
        }
      } catch {
        showToast("error", "网络错误");
      }
    } else {
      showToast("error", "该金句为手动录入，无来源文档");
    }
  };

  const doDeleteQuote = async (id: string) => {
    const r = await deleteQuote(id);
    if (r.success) showToast("success", "金句已删除");
    else showToast("error", "删除失败");
  };

  return (
    <DashboardLayout title="公文知识库">
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          {/* 点选菜单：已审阅公文库 / 金句库 */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700"
            >
              <BookOpen className="w-4 h-4" />
              <span>
                {view === "reviewed" ? "已审阅公文库" : "金句库"}
                （{view === "reviewed" ? docs.length : quotes.length}）
              </span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
                <div className="absolute z-30 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                  <button
                    onClick={() => { setView("reviewed"); setMenuOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 ${view === "reviewed" ? "text-[#163f3a] font-medium" : "text-gray-600"}`}
                  >
                    <BookOpen className="w-3.5 h-3.5" /> 已审阅公文库
                  </button>
                  <button
                    onClick={() => { setView("quotes"); setMenuOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-gray-50 ${view === "quotes" ? "text-amber-600 font-medium" : "text-gray-600"}`}
                  >
                    <QuoteIcon className="w-3.5 h-3.5" /> 金句库
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {view === "reviewed" ? (
              <>
                {/* 搜索 */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="搜索标题..."
                    className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-48 focus:outline-none focus:ring-1 focus:ring-[#163f3a]/30" />
                </div>
                <button onClick={loadDocs} title="刷新"
                  className="p-1.5 text-gray-400 hover:text-[#163f3a] rounded-lg hover:bg-[#163f3a]/5">
                  <Clock className="w-4 h-4" />
                </button>
                <button onClick={() => setShowDocxImport(true)} title="从 Word 导入"
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
                  <FileUp className="w-3.5 h-3.5" /> 导入 DOCX
                </button>
              </>
            ) : (
              <button onClick={() => setShowAddQuote(true)} title="手动录入金句"
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600">
                <Plus className="w-3.5 h-3.5" /> 手动录入
              </button>
            )}
          </div>
        </div>

        {/* ── 已审阅公文库视图 ── */}
        {view === "reviewed" ? (
          <>
            {/* 公文类型筛选 */}
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setActiveCat("")}
                className={`px-2.5 py-1 text-[11px] rounded-full transition-colors ${!activeCat ? "bg-[#163f3a] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                全部
              </button>
              {allCats.map((cat) => {
                const count = docs.filter((d) => d.category === cat).length;
                const color = getCategoryColor(cat);
                return (
                  <button key={cat} onClick={() => setActiveCat(activeCat === cat ? "" : cat)}
                    className={`px-2.5 py-1 text-[11px] rounded-full transition-colors flex items-center gap-1 ${
                      activeCat === cat ? "text-white font-medium" : "text-gray-500 hover:bg-gray-100"
                    }`}
                    style={activeCat === cat ? { backgroundColor: color } : {}}>
                    {cat}
                    {count > 0 && <span className="text-[9px] opacity-70">({count})</span>}
                  </button>
                );
              })}
            </div>

            {/* 文档列表 */}
            {loading ? (
              <div className="text-center py-16 text-sm text-gray-400">加载中...</div>
            ) : filteredDocs.length === 0 ? (
              <div className="text-center py-16 bg-gray-50/80 rounded-xl border border-dashed border-gray-200">
                <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">
                  {activeCat ? `暂无已审阅的「${activeCat}」公文` : "暂无已审阅的公文"}
                </p>
                <p className="text-xs text-gray-300 mt-1">已审阅的公文将自动出现在知识库中</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDocs.map((doc) => {
                  const color = getCategoryColor(doc.category);
                  return (
                    <div key={doc.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#e7e2d8] hover:shadow-sm transition-shadow group">
                      <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800 truncate">{doc.title}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded text-white flex-shrink-0" style={{ backgroundColor: color }}>
                            {doc.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {doc.reviewedAt ? new Date(doc.reviewedAt).toLocaleDateString("zh-CN") : ""}
                          </span>
                          {doc.reviewerName && (
                            <span className="flex items-center gap-1">
                              <UserCheck className="w-3 h-3" />
                              {doc.reviewerName}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setPreviewDoc(doc)}
                          className="p-1.5 rounded text-gray-400 hover:text-cyan-600 hover:bg-cyan-50" title="预览">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <Link href={`/documents/${doc.id}`} title="打开编辑"
                          className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                        <ExportMenu title={doc.title} content={doc.content || ""} size="sm" />
                        <button onClick={() => rejectReview(doc.id, doc.title)} title="驳回审阅（从知识库移除）"
                          className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50">
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* ── 金句库视图 ── */
          <>
            {quotesLoading ? (
              <div className="text-center py-16 text-sm text-gray-400">加载中...</div>
            ) : quotes.length === 0 ? (
              <div className="text-center py-16 bg-gray-50/80 rounded-xl border border-dashed border-gray-200">
                <QuoteIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">金句库为空</p>
                <p className="text-xs text-gray-300 mt-1">在文档/热点中选中文字可添加金句，或点击右上角「手动录入」</p>
              </div>
            ) : (
              <div className="space-y-2">
                {quotes.map((q) => (
                  <div key={q.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-[#e7e2d8] hover:shadow-sm transition-shadow group">
                    <div className="w-1 h-10 rounded-full flex-shrink-0 bg-amber-400" />
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-sm text-gray-800 leading-relaxed cursor-pointer line-clamp-2"
                        onClick={() => handleLocate(q)}
                        title="点击定位到原文档"
                      >
                        “{q.content}”
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400 flex-wrap">
                        {q.sourceTitle && <span className="flex items-center gap-1"><FileText className="w-2.5 h-2.5" />{q.sourceTitle}</span>}
                        {q.category && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">{q.category}</span>}
                        <span>{new Date(q.createdAt * 1000).toLocaleDateString("zh-CN")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => handleLocate(q)} title="定位原文档"
                        className="p-1.5 rounded text-gray-400 hover:text-[#163f3a] hover:bg-[#163f3a]/5">
                        <MapPin className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => doDeleteQuote(q.id)} title="删除金句"
                        className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-[100] px-4 py-2.5 rounded-xl shadow-lg text-xs flex items-center gap-2 ${
            toast.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {toast.type === "success" ? "✓" : "✗"} {toast.msg}
          </div>
        )}
      </div>

      {/* 知识库 AI 问答悬浮入口（@ 文章 / 技能） */}
      <button
        onClick={() => setChatOpen(true)}
        title="AI 问答（@ 选择文章 / 选择技能）"
        className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-red-600 text-white shadow-lg flex items-center justify-center hover:bg-red-700 active:scale-95 transition-transform"
      >
        <MessageSquare className="w-6 h-6" />
      </button>
      <KnowledgeChat open={chatOpen} onClose={() => setChatOpen(false)} />

      {/* 从 Word 导入弹窗（强制审阅） */}
      <ImportDocxModal
        open={showDocxImport}
        onClose={() => setShowDocxImport(false)}
        onConfirm={importDocx}
        forceReview
        submitLabel="导入并审阅"
      />

      {/* 预览弹窗（复刻文档管理预览） */}
      <PreviewModal
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.title || ""}
        content={previewDoc?.content || ""}
        docId={previewDoc?.id || null}
        sourceType="knowledge"
        onFullEdit={() => {
          if (previewDoc) {
            const id = previewDoc.id;
            setPreviewDoc(null);
            window.open(`/documents/${id}`, "_blank");
          }
        }}
      />

      {/* 从金句库点击定位：打开来源文档并滚动到金句 */}
      <PreviewModal
        open={!!locateDoc}
        onClose={() => setLocateDoc(null)}
        title={locateDoc?.title || ""}
        content={locateDoc?.content || ""}
        docId={locateDoc?.id || null}
        sourceType="document"
        locateText={locateDoc?.locate}
      />

      {/* 手动录入金句弹窗 */}
      <AddQuoteDialog
        open={showAddQuote}
        onClose={() => setShowAddQuote(false)}
        defaultText=""
        sourceType="manual"
        sourceId=""
        sourceTitle=""
      />

      {/* 驳回审阅确认弹窗 */}
      <CustomDialog
        open={!!confirmDel}
        mode="confirm"
        title="驳回审阅"
        message={confirmDel ? `确定将「${confirmDel.title}」从知识库中移除（驳回审阅）？原文档在文档管理中保留，不会被删除。` : ""}
        confirmText="确定驳回"
        cancelText="取消"
        onConfirm={() => {
          if (confirmDel) {
            doRejectReview(confirmDel.docId, confirmDel.title);
            setConfirmDel(null);
          }
        }}
        onCancel={() => setConfirmDel(null)}
      />
    </DashboardLayout>
  );
}
