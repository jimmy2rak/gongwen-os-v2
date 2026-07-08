// ─── 编辑器状态管理 ──────────────────────────────
// 管理编辑器的所有状态：文档内容、元信息、界面状态
// 使用 Zustand + persist 自动缓存到 localStorage

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DocMetaInfo } from "@/types";

const DEFAULT_META: DocMetaInfo = {
  docMode: "simple",
  submitUnit: "",
  submitDate: "",
  docNumber: "",
  drawer: "",
  level: "",
  secrecy: "",
  redHeader: "",
  issuingAuthority: "",
  recipient: "",
  printDate: "",
};

interface EditorStore {
  // 文档数据
  docId: string | null;
  title: string;
  content: string;
  category: string;
  format: "gb" | "simple" | "official";
  meta: DocMetaInfo;

  // 编辑状态
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: number | null;
  docInitialized: boolean;

  // 选中文本
  selectedText: string;
  selectionRect: { top: number; left: number; bottom: number; right: number } | null;

  // 模板列表（新建公文用）
  templateList: { id: string; name: string; type: "builtin" | "custom"; content: string; category: string }[];

  // 界面状态
  showAi: boolean;
  metaExpanded: boolean;
  zoom: number;
  showNewDocDialog: boolean;

  // Actions
  setDocId: (id: string | null) => void;
  setTitle: (title: string) => void;
  setContent: (html: string) => void;
  setCategory: (cat: string) => void;
  setFormat: (fmt: "gb" | "simple" | "official") => void;
  setMeta: (meta: DocMetaInfo) => void;
  setSelectedText: (text: string) => void;
  setSelectionRect: (rect: { top: number; left: number; bottom: number; right: number } | null) => void;
  setShowAi: (show: boolean) => void;
  setTemplateList: (list: { id: string; name: string; type: "builtin" | "custom"; content: string; category: string }[]) => void;
  setMetaExpanded: (expanded: boolean) => void;
  setZoom: (zoom: number) => void;
  setShowNewDocDialog: (show: boolean) => void;
  setIsSaving: (saving: boolean) => void;
  markSaved: () => void;
  reset: () => void;
  initDoc: (data?: { id?: string; title?: string; content?: string; category?: string; format?: string; meta?: DocMetaInfo }) => void;
}

export const useEditorStore = create<EditorStore>()(
  persist(
    (set) => ({
      // 初始值
      docId: null,
      title: "未命名公文",
      content: "",
      category: "通知",
      format: "simple",
      meta: DEFAULT_META,
      isDirty: false,
      isSaving: false,
      lastSavedAt: null,
      docInitialized: false,
      selectedText: "",
      selectionRect: null,
      showAi: true,
      metaExpanded: true,
      zoom: 100,
      showNewDocDialog: false,
      templateList: [] as { id: string; name: string; type: "builtin" | "custom"; content: string; category: string }[],

      // Actions
      setDocId: (docId) => set({ docId }),

      setTitle: (title) => set({ title, isDirty: true }),

      setContent: (content) => set({ content, isDirty: true }),

      setCategory: (category) => set({ category, isDirty: true }),

      setFormat: (format) => set({ format, meta: { ...DEFAULT_META, docMode: format } }),

      setMeta: (meta) => set({ meta, isDirty: true }),

      setSelectedText: (selectedText) => set({ selectedText }),

      setSelectionRect: (selectionRect) => set({ selectionRect }),

      setShowAi: (showAi) => set({ showAi }),

      setTemplateList: (templateList) => set({ templateList }),

      setMetaExpanded: (metaExpanded) => set({ metaExpanded }),

      setZoom: (zoom) => set({ zoom }),

      setShowNewDocDialog: (showNewDocDialog) => set({ showNewDocDialog }),

      setIsSaving: (isSaving) => set({ isSaving }),

      markSaved: () => set({ isDirty: false, lastSavedAt: Date.now() }),

      reset: () => set({
        docId: null,
        title: "未命名公文",
        content: "",
        category: "通知",
        format: "simple",
        meta: DEFAULT_META,
        isDirty: false,
        isSaving: false,
        lastSavedAt: null,
        docInitialized: false,
        selectedText: "",
        zoom: 100,
      }),

      initDoc: (data) => set({
        docId: data?.id || null,
        title: data?.title || "未命名公文",
        content: data?.content || "",
        category: data?.category || "通知",
        format: (data?.format as "gb" | "simple" | "official") || "simple",
        meta: data?.meta || DEFAULT_META,
        docInitialized: true,
        isDirty: !data?.id, // 有 id 表示从数据库加载，不算脏
      }),
    }),
    {
      name: "gw2-editor-storage",
      // 只持久化内容相关字段，不持久化界面状态
      partialize: (state) => ({
        title: state.title,
        content: state.content,
        category: state.category,
        format: state.format,
        meta: state.meta,
        docId: state.docId,
        zoom: state.zoom,
        metaExpanded: state.metaExpanded,
        showAi: state.showAi,
      }),
    }
  )
);

export { DEFAULT_META };
