// ─── 首页 — 公文编辑器 ──────────────────────────
// 核心页面：TipTap 公文编辑器 + 工具栏 + 元信息栏 + 底部状态栏

"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ExportMenu } from "@/components/editor/ExportMenu";
import { useAuthStore } from "@/stores/auth.store";
import { useEditorStore, DEFAULT_META } from "@/stores/editor.store";
import { CustomDialog } from "@/components/ui/CustomDialog";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DocEditor } from "@/components/editor/DocEditor";
import { AiAssistant } from "@/components/editor/AiAssistant";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { EditorMetaBar } from "@/components/editor/EditorMetaBar";
import { EditorFooterBar } from "@/components/editor/EditorFooterBar";
import { getAllCategories, getCategoryColor } from "@/types";
import { buildDocFromTemplate } from "@/lib/template-to-doc";
import { markdownToGovDocHtml, looksLikeMarkdown } from "@/lib/markdown";
import {
  Save, Download, ChevronDown, Plus, Clock, CheckCircle, AlertTriangle, Sparkles, X,
} from "lucide-react";
import type { Editor } from "@tiptap/react";
import { ReviewDialog } from "@/components/editor/ReviewDialog";
import { HistoryModal } from "@/components/editor/HistoryModal";

const HEADER_BUTTON_CLASS = "flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg transition-colors";

export default function HomePage() {
  const { user, isLoading, fetchUser } = useAuthStore();
  const router = useRouter();
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<Record<string, string>>({});
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [dialog, setDialog] = useState<{ title: string; message: string } | null>(null);
  const showDialog = (t: string, m: string) => setDialog({ title: t, message: m });
  const closeDialog = () => setDialog(null);
  // 缓存冲突校验状态
  const [conflictDialog, setConflictDialog] = useState<{
    docId: string; cloudUpdatedAt: number; cloudContent: any;
  } | null>(null);
  const [pendingInit, setPendingInit] = useState<any>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  // 新建文档弹窗状态
  const [newDocCat, setNewDocCat] = useState<string | null>(null);
  const [selectedTplId, setSelectedTplId] = useState<string>("");

  const store = useEditorStore();
  const allCats = getAllCategories();
  const editorRef = useRef<Editor | null>(null);
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const fetched = useRef(false);

  // 页面加载时获取用户（只执行一次）
  useEffect(() => {
    if (!fetched.current) {
      fetched.current = true;
      fetchUser();
    }
  }, [fetchUser]);

  // 未登录跳转（用 useEffect 避免渲染时更新 Router）
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [user, isLoading, router]);

  // ─── 自动保存草稿到 localStorage（每 30 秒） ──
  useEffect(() => {
    if (!store.docId) return;
    const interval = setInterval(() => {
      if (store.title || store.content) {
        const draftKey = `gw2-draft-${store.docId}`;
        localStorage.setItem(draftKey, JSON.stringify({
          title: store.title,
          content: store.content,
          savedAt: Date.now(),
        }));
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [store.docId, store.title, store.content]);

  // 手机端 AI 面板本地状态（不持久化，避免影响桌面端）
  const [mobileAiOpen, setMobileAiOpen] = useState(false);

  // ─── 手机端初始化：折叠元信息栏 ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      store.setMetaExpanded(false);
    }
  }, []); // 仅在页面挂载时执行一次

  // ─── 从 URL 加载文档（URL 格式：/documents/[id]） ──
  useEffect(() => {
    if (!user) return;
    // 从 URL 路径中提取文档 ID：/documents/xxx 或 /documents/xxx?...
    const match = window.location.pathname.match(/^\/documents\/([^/]+)$/);
    const docIdFromUrl = match ? match[1] : null;
    // 也检查是否有 edit-doc-id 参数（从其他页面跳转过来）
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get("edit") || docIdFromUrl;

    if (editId && editId !== store.docId) {
      (async () => {
        try {
          const res = await fetch(`/api/documents/${editId}`);
          if (res.ok) {
            const body = await res.json();
            if (body.success && body.data) {
              const doc = body.data;
              let meta: Record<string, string> = {};
              try { meta = JSON.parse(doc.meta || "{}"); } catch {}

              // 缓存冲突校验：检测 localStorage 草稿
              const draftKey = `gw2-draft-${editId}`;
              const localDraftRaw = localStorage.getItem(draftKey);
              const cloudUpdatedAt = typeof doc.updatedAt === "number"
                ? (doc.updatedAt < 1000000000000 ? doc.updatedAt * 1000 : doc.updatedAt)
                : new Date(doc.updatedAt).getTime();

              if (localDraftRaw) {
                try {
                  const localDraft = JSON.parse(localDraftRaw);
                  const localTime = localDraft.savedAt || 0;

                  if (localTime > cloudUpdatedAt + 5000) {
                    // 本地草稿更新 → 提示恢复
                    setConflictDialog({
                      docId: editId,
                      cloudUpdatedAt,
                      cloudContent: { id: doc.id, title: doc.title, content: doc.content || "", category: doc.category, format: doc.format, meta },
                    });
                    // 暂存云端数据供用户选择
                    setPendingInit({
                      localDraft,
                      cloudData: { id: doc.id, title: doc.title, content: doc.content || "", category: doc.category, format: doc.format, meta },
                    });
                    return; // 等待用户选择
                  } else if (cloudUpdatedAt > localTime + 5000) {
                    // 云端更新 → 询问是否覆盖本地
                    setConflictDialog({
                      docId: editId,
                      cloudUpdatedAt,
                      cloudContent: { id: doc.id, title: doc.title, content: doc.content || "", category: doc.category, format: doc.format, meta },
                    });
                    setPendingInit({
                      localDraft,
                      cloudData: { id: doc.id, title: doc.title, content: doc.content || "", category: doc.category, format: doc.format, meta },
                    });
                    return;
                  }
                } catch {}
              }

              // 无冲突/本地缓存比云端旧的忽略 → 直接加载云端
              store.initDoc({
                id: doc.id,
                title: doc.title,
                content: doc.content || "",
                category: doc.category,
                format: doc.format,
                meta: meta as any,
              });
            }
          }
        } catch {}
      })();
    }
  }, [user]);

  // ─── 从一键初稿跳转时接收生成内容 ──
  useEffect(() => {
    if (!user) return;
    const appendKey = "gw-pending-append";
    const replaceKey = "gw-pending-replace";
    const append = localStorage.getItem(appendKey);
    const replace = localStorage.getItem(replaceKey);
    const title = store.title || "未命名公文";

    const convert = (raw: string) =>
      looksLikeMarkdown(raw) ? markdownToGovDocHtml(raw, title) : raw;

    if (append) {
      localStorage.removeItem(appendKey);
      const existing = store.content || "";
      const appended = convert(append);
      const newContent = existing + (existing ? "\n" : "") + appended;
      store.initDoc({
        title,
        category: store.category,
        content: newContent,
      });
      showDialog("已追加", "一键初稿内容已追加到当前文档尾部");
    } else if (replace) {
      localStorage.removeItem(replaceKey);
      store.initDoc({
        title,
        category: store.category,
        content: convert(replace),
      });
      showDialog("已替换", "已用一键初稿内容替换全文");
    }
  }, [user]);

  // 缓存冲突弹窗回调
  const handleConflictChoice = (useLocal: boolean) => {
    if (!pendingInit || !conflictDialog) return;
    if (useLocal) {
      const { localDraft } = pendingInit;
      store.initDoc({
        id: pendingInit.cloudData.id,
        title: localDraft.title || pendingInit.cloudData.title,
        content: localDraft.content || pendingInit.cloudData.content,
        category: pendingInit.cloudData.category,
        format: pendingInit.cloudData.format,
        meta: pendingInit.cloudData.meta,
      });
      showDialog("已恢复", "已恢复本地草稿内容");
    } else {
      const { cloudData } = pendingInit;
      store.initDoc(cloudData);
      // 删除过时本地草稿
      localStorage.removeItem(`gw2-draft-${conflictDialog.docId}`);
      showDialog("已加载", "已加载线上最新版本");
    }
    setConflictDialog(null);
    setPendingInit(null);
  };

  // ─── 编辑器就绪回调 ────────────────────────────
  const handleEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
    setEditorInstance(editor);
  }, []);

  // ─── 选区变化回调 ──────────────────────────────
  const handleSelectionChange = useCallback((info: { text: string; rect: { top: number; left: number; bottom: number; right: number } | null }) => {
    store.setSelectedText(info.text);
    store.setSelectionRect(info.rect);
  }, []);

  // ─── 打开新建对话框时拉取模板列表 ──────────────
  useEffect(() => {
    if (!store.showNewDocDialog) return;
    fetch("/api/templates")
      .then((r) => r.json())
      .then((b) => {
        if (b.success) {
          const list = [...b.data.builtin, ...b.data.custom].map((t: any) => ({
            id: t.id,
            name: t.name,
            type: t.type,
            content: t.content,
            category: t.category || "通知",
          }));
          store.setTemplateList(list);
        }
      })
      .catch(() => {});
  }, [store.showNewDocDialog]);

  // 加载中或未登录
  if (isLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">加载中...</div>;
  }

  // ─── 新建文档 ──────────────────────────────────
  const handleNewDoc = async (cat: string) => {
    if (cat === "empty") {
      store.initDoc({
        title: "未命名公文",
        category: "通知",
        content: '<div data-type="doc-title">未命名公文</div><p>请在此输入公文正文...</p>',
      });
    } else {
      store.initDoc({
        title: cat,
        category: cat,
        content: `<div data-type="doc-title">${cat}</div><p>请在此输入正文...</p>`,
      });
    }
    store.setShowNewDocDialog(false);
  };

  // ─── 从模板新建（要素列 → 公文初稿） ───────────
  const handleNewDocFromTemplate = (tpl: { id: string; name: string; type: "builtin" | "custom"; content: string }) => {
    const seed = buildDocFromTemplate(tpl);
    store.initDoc({
      title: seed.title,
      category: seed.category,
      content: seed.content,
    });
    store.setShowNewDocDialog(false);
  };

  // ─── 保存文档 ──────────────────────────────────
  const handleSave = async () => {
    if (!user?.email) return;
    store.setIsSaving(true);
    try {
      const isUpdate = !!store.docId;
      // 修复：确保 meta 是对象的浅拷贝，避免 Zustand 代理对象序列化问题
      const metaObj = { ...store.meta };
      const body = {
        title: store.title,
        category: store.category,
        content: store.content,
        format: store.format,
        meta: JSON.stringify(metaObj),
      };

      const res = isUpdate
        ? await fetch(`/api/documents/${store.docId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/documents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

      if (res.ok) {
        const data = await res.json();
        if (data.data?.id) {
          store.setDocId(data.data.id);
          // 保存成功后更新浏览器 URL（不刷新页面）
          window.history.replaceState(null, "", `/documents/${data.data.id}`);
        }
        store.markSaved();
        // 保存成功后通知 HistoryModal 立刻刷新版本列表
        if (typeof (window as any).__refreshVersions__ === "function") {
          await (window as any).__refreshVersions__();
        }
      } else {
        const err = await res.json();
        const errCode = err.error?.code;
        const errMsg = err.error?.message || err.error || "未知错误";
        // 登录过期（数据库重建后 cookie 中的用户 ID 不存在）
        if (errCode === "SESSION_EXPIRED") {
          showDialog("保存失败", "登录已过期，请重新登录");
          // 清除本地缓存并跳转到登录页
          store.reset();
          window.location.href = "/login";
          return;
        }
        showDialog("保存失败", "保存失败: " + errMsg);
      }
    } catch (err) {
      showDialog("保存失败", "保存失败（网络错误）: " + (err instanceof Error ? err.message : "请检查网络"));
    } finally {
      store.setIsSaving(false);
    }
  };

  // ─── 审阅 ──────────────────────────────────────
  const handleReview = async (reviewerId: string, reviewerName: string, isApproved: boolean) => {
    if (!store.docId) {
      showDialog("提示", "请先保存文档后再提交审阅");
      return;
    }
    try {
      // 写入 reviews 表 + 更新文档审阅状态
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: store.docId,
          reviewerId,
          reviewerName,
          department: "",
          approved: isApproved,
        }),
      });
      if (res.ok) {
        setShowReviewDialog(false);
        if (isApproved) {
          showDialog("审阅结果", "审阅通过！文档已标记为已审阅");
        } else {
          showDialog("审阅结果", "已驳回，文档保持编辑状态");
        }
      } else {
        const err = await res.json();
        showDialog("审阅失败", "审阅操作失败: " + (err.error?.message || "未知错误"));
      }
    } catch {
      showDialog("审阅失败", "审阅操作失败，请检查网络");
    }
  };

  // ─── 键盘快捷键 ──────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        store.setShowNewDocDialog(true);
        setNewDocCat(null);
        setSelectedTplId("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  // ─── 导出（已迁移至 ExportMenu 组件） ─────────
  // handleExport 由 ExportMenu 组件内部实现

  // ─── 头部工具栏按钮 ───────────────────────────
  const headerTitle = store.title?.trim() || store.category;
  const headerButtons = (
    <>
      <div className="flex items-center min-w-0 max-w-[160px]">
        <input
          type="text"
          value={store.title}
          onChange={(e) => store.setTitle(e.target.value)}
          placeholder={store.category}
          className="text-xs font-medium text-gray-700 bg-transparent border-none outline-none truncate w-full px-1 py-0.5 rounded hover:bg-gray-100 focus:bg-gray-100 focus:ring-1 focus:ring-red-300"
          title={store.title}
        />
      </div>

      <span className="w-px h-4 bg-gray-200" />

      {/* 新建 */}
      <button
        onClick={() => { store.setShowNewDocDialog(true); setNewDocCat(null); setSelectedTplId(""); }}
        className={`${HEADER_BUTTON_CLASS} bg-white border border-gray-200 text-gray-600 hover:bg-gray-50`}
        title="新建文档"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>

      {/* 模式切换 */}
      <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
        {([["simple", "简易"], ["gb", "国标"], ["official", "红头"]] as const).map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => store.setFormat(mode)}
            className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
              store.format === mode
                ? "bg-white text-red-600 shadow-sm font-medium"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 模板切换 */}
      <div className="relative">
        <button
          onClick={() => setShowTemplateMenu(!showTemplateMenu)}
          className={`${HEADER_BUTTON_CLASS} bg-white border border-gray-200 text-gray-600 hover:bg-gray-50`}
        >
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: getCategoryColor(store.category) }} />
          {store.category}
          <ChevronDown className="w-3 h-3" />
        </button>
        {showTemplateMenu && (
          <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 max-h-64 overflow-auto">
            {allCats.map((cat) => (
              <button
                key={cat}
                onClick={() => { store.setCategory(cat); setShowTemplateMenu(false); }}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 flex items-center gap-2 ${
                  store.category === cat ? "text-red-600 font-medium" : "text-gray-600"
                }`}
              >
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: getCategoryColor(cat) }} />
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      <span className="w-px h-5 bg-gray-200" />

      {/* 导出（复用 ExportMenu 组件） */}
      <ExportMenu title={store.title} content={store.content} />

      {/* 历史 */}
      <button
        onClick={() => {
          if (!store.docId) {
            showDialog("提示", "请先保存文档后再查看历史");
            return;
          }
          setShowHistoryModal(true);
        }}
        className={`${HEADER_BUTTON_CLASS} bg-white border border-gray-200 text-gray-600 hover:bg-gray-50`}
      >
        <Clock className="w-3 h-3" /> 历史
      </button>

      {/* 审阅 */}
      <button
        onClick={() => {
          if (!store.docId) {
            showDialog("提示", "请先保存文档后再提交审阅");
            return;
          }
          setShowReviewDialog(true);
        }}
        className={`${HEADER_BUTTON_CLASS} bg-white border border-green-300 text-green-600 hover:bg-green-50`}
      >
        <CheckCircle className="w-3 h-3" /> 审阅
      </button>

      {/* 保存 */}
      <button
        onClick={handleSave}
        disabled={store.isSaving}
        className={`${HEADER_BUTTON_CLASS} bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-300`}
      >
        <Save className="w-3.5 h-3.5" /> {store.isSaving ? "保存中..." : "保存"}
      </button>
    </>
  );

  return (
    <DashboardLayout title="" headerSlot={headerButtons}>
      <div className="flex h-full">
        {/* 主编辑区域 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 工具栏 */}
          <div className="flex-shrink-0">
            <EditorToolbar
              editor={editorRef.current}
              onImageUpload={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = () => {
                  const file = input.files?.[0];
                  if (!file || !editorRef.current) return;
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    editorRef.current?.chain().focus().setImage({ src: e.target?.result as string }).run();
                  };
                  reader.readAsDataURL(file);
                };
                input.click();
              }}
            />
          </div>

          {/* 元信息栏 */}
          <div className="flex-shrink-0">
            <EditorMetaBar
              meta={store.meta}
              onChange={store.setMeta}
              expanded={store.metaExpanded}
              onToggle={() => store.setMetaExpanded(!store.metaExpanded)}
            />
          </div>

          {/* 编辑区（纸面） */}
          <div className="flex-1 overflow-auto bg-gray-100">
            <div className="flex items-start justify-center py-4">
              <div className="w-full max-w-full md:max-w-[210mm]">
                <DocEditor
                  content={store.content}
                  onChange={store.setContent}
                  placeholder="开始撰写公文..."
                  docMode={store.format}
                  onEditorReady={handleEditorReady}
                  meta={store.meta}
                  onSelectionChange={handleSelectionChange}
                />
              </div>
            </div>
          </div>

          {/* 底部状态栏 */}
          <div className="flex-shrink-0">
            <EditorFooterBar
              content={store.content}
              saved={!store.isDirty}
              zoom={store.zoom}
              onZoomChange={store.setZoom}
            />
          </div>
        </div>

        {/* 手机端 AI 面板切换按钮（右下角浮动） */}
        <button
          onClick={() => setMobileAiOpen(!mobileAiOpen)}
          className="fixed bottom-20 right-4 z-50 w-12 h-12 rounded-full bg-[#163f3a] text-white shadow-lg flex items-center justify-center md:hidden"
          title={mobileAiOpen ? "关闭 AI 助手" : "打开 AI 助手"}
        >
          {mobileAiOpen ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
        </button>

        {/* AI 公文助手侧栏 — 桌面端 inline，手机端全屏覆盖 */}
        <div className="hidden md:flex">
          <AiAssistant editor={editorInstance} />
        </div>

        {/* 手机端 AI 面板覆盖层 */}
        {mobileAiOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="fixed inset-0 bg-black/30"
              onClick={() => setMobileAiOpen(false)}
            />
            <div className="fixed inset-y-0 right-0 left-12 z-50 bg-white shadow-2xl flex flex-col">
              <AiAssistant editor={editorInstance} />
            </div>
            <button
              onClick={() => setMobileAiOpen(false)}
              className="fixed top-3 left-3 z-[60] w-10 h-10 rounded-full bg-white/90 shadow-md flex items-center justify-center text-gray-600 md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* 审阅对话框 */}
      <ReviewDialog
        open={showReviewDialog}
        onClose={() => setShowReviewDialog(false)}
        onReview={handleReview}
      />

      {/* 版本历史弹窗 */}
      <HistoryModal
        docId={store.docId}
        open={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
      />

      {/* 新建文档对话框（精简版：先选类型 → 再选模板） */}
      {store.showNewDocDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-xl w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-800">新建公文文档</h2>
              <button onClick={() => store.setShowNewDocDialog(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                ✕
              </button>
            </div>

            {/* 步骤1：选择公文类型 */}
            <div className="mb-4">
              <p className="text-[11px] font-medium text-gray-500 mb-2">选择公文类型</p>
              <div className="flex flex-wrap gap-2">
                {allCats.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setNewDocCat(cat);
                      // 默认选中该类型的内置模板
                      const defaultTpl = store.templateList.find(
                        (t) => t.category === cat && t.type === "builtin"
                      );
                      setSelectedTplId(defaultTpl?.id || "");
                    }}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-all flex items-center gap-1.5 ${
                      newDocCat === cat
                        ? "border-red-300 bg-red-50 text-red-700 shadow-sm"
                        : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: getCategoryColor(cat) }} />
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 步骤2：选择模板（选中类型后出现） */}
            {newDocCat && (
              <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-gray-500">选择模板</label>
                  {/* 直接用选中类型的默认模板新建 */}
                  <button
                    onClick={() => {
                      const tpl = selectedTplId
                        ? store.templateList.find((t) => t.id === selectedTplId)
                        : undefined;
                      if (tpl) {
                        handleNewDocFromTemplate(tpl);
                      } else {
                        // 无模板时创建空文档
                        store.initDoc({
                          title: newDocCat,
                          category: newDocCat,
                          content: `<div data-type="doc-title">${newDocCat}</div><p>请在此输入正文...</p>`,
                        });
                        store.setShowNewDocDialog(false);
                      }
                    }}
                    className="px-2.5 py-1 text-[11px] bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                  >
                    确认新建
                  </button>
                </div>
                <select
                  value={selectedTplId}
                  onChange={(e) => setSelectedTplId(e.target.value)}
                  className="mt-2 w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-red-300"
                >
                  {(() => {
                    const catTpls = store.templateList.filter((t) => t.category === newDocCat);
                    if (catTpls.length === 0) {
                      return <option value="">（该类型暂无模板）</option>;
                    }
                    return catTpls.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.type === "custom" ? "· 自定义" : ""}
                      </option>
                    ));
                  })()}
                </select>
                {/* 模板预览提示 */}
                <p className="text-[10px] text-gray-400 mt-1.5">
                  选择模板后将使用要素列自动生成公文初稿
                </p>
              </div>
            )}

            {/* 分隔线 */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
              <div className="relative flex justify-center"><span className="bg-white px-2 text-[10px] text-gray-400">或</span></div>
            </div>

            {/* 空文档新建（一键操作） */}
            <button
              onClick={() => { handleNewDoc("empty"); setNewDocCat(null); setSelectedTplId(""); }}
              className="w-full p-4 border-2 border-dashed border-gray-200 rounded-xl hover:border-red-300 hover:bg-red-50/30 transition-all flex items-center justify-center gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <Plus className="w-5 h-5 text-gray-400" />
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-gray-700">以空文档形式新建</div>
                <div className="text-[11px] text-gray-400">跳过模板，创建空白文档</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* 全局内部提示弹窗 */}
      <CustomDialog
        open={!!dialog}
        mode="info"
        title={dialog?.title || ""}
        message={dialog?.message}
        confirmText="确定"
        onConfirm={closeDialog}
        onCancel={closeDialog}
      />

      {/* 缓存冲突弹窗 */}
      {conflictDialog && pendingInit && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={() => setConflictDialog(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-96 max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-gray-800">版本冲突</h3>
                {pendingInit.localDraft?.savedAt > conflictDialog.cloudUpdatedAt ? (
                  <p className="text-xs text-gray-500 mt-1">你有未同步的本地草稿，是否恢复继续编辑？</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">线上存在更新版本，是否使用线上最新内容？</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {pendingInit.localDraft?.savedAt > conflictDialog.cloudUpdatedAt ? (
                <>
                  <button onClick={() => handleConflictChoice(true)}
                    className="flex-1 px-4 py-2 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700">
                    恢复本地草稿
                  </button>
                  <button onClick={() => handleConflictChoice(false)}
                    className="flex-1 px-4 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                    舍弃，使用线上版本
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => handleConflictChoice(false)}
                    className="flex-1 px-4 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    使用线上最新版本
                  </button>
                  <button onClick={() => handleConflictChoice(true)}
                    className="flex-1 px-4 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                    保留本地草稿另存
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
