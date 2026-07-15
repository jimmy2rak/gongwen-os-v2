// ─── 公文预览弹窗 ──────────────────────────────
// 查看完整公文排版效果，支持导出、打印、跳转编辑
// 样式复用 editor.css 中的公文排版规则
// 金句：预览时注入头尾黄点 + hover 紫薄纱高亮；选中文字可添加金句；点击金句可删除

"use client";

import { useState, useEffect, useRef } from "react";
import { X, Printer, ExternalLink, AlertTriangle, Trash2, Quote as QuoteIcon } from "lucide-react";
import { ExportMenu } from "./ExportMenu";
import "@/components/editor/editor.css";
import { useQuotations } from "@/lib/quotations/use-quotations";
import { applyQuoteHighlights, locateAndFlash } from "@/lib/quotations/highlight";
import { QuoteSelectionBubble } from "@/components/quotations/QuoteSelectionBubble";
import type { Quote } from "@/lib/quotations/types";

interface PreviewModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  content: string;
  /** 预览模式（影响排版样式） */
  docMode?: "simple" | "gb" | "official";
  docId: string | null;
  /** 金句来源类型（默认 document） */
  sourceType?: string;
  /** 从金句库点击定位时，滚动并闪烁到该句 */
  locateText?: string;
  onFullEdit?: () => void;
  /** 是否有未保存的修改 */
  hasUnsavedChanges?: boolean;
  /** 保存当前文档的回调 */
  onSaveCurrent?: () => Promise<boolean>;
}

export function PreviewModal({
  open, onClose, title, content, docMode = "simple", docId,
  sourceType = "document", locateText,
  onFullEdit, hasUnsavedChanges, onSaveCurrent,
}: PreviewModalProps) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [activeQuote, setActiveQuote] = useState<{ q: Quote; rect: DOMRect } | null>(null);
  const { quotes, deleteQuote } = useQuotations(docId ?? undefined);

  // 关闭弹窗时重置保存对话框状态
  useEffect(() => { if (!open) setShowSaveDialog(false); }, [open]);

  // 注入金句高亮 / 定位闪烁
  useEffect(() => {
    if (!open || !contentRef.current) return;
    applyQuoteHighlights(contentRef.current, quotes, (q, rect) => setActiveQuote({ q, rect }));
    if (locateText) {
      requestAnimationFrame(() => locateAndFlash(contentRef.current!, locateText));
    }
  }, [open, quotes, content, locateText]);

  if (!open) return null;

  // 全屏编辑点击处理
  const handleFullEdit = () => {
    if (!onFullEdit) return;
    if (hasUnsavedChanges) {
      setShowSaveDialog(true);
    } else {
      onFullEdit();
    }
  };

  // 保存后再跳转
  const handleSaveThenEdit = async () => {
    if (onSaveCurrent) {
      const ok = await onSaveCurrent();
      if (ok) {
        setShowSaveDialog(false);
        onFullEdit?.();
      }
    } else {
      onFullEdit?.();
    }
  };

  // 放弃修改直接跳转
  const handleDiscardThenEdit = () => {
    setShowSaveDialog(false);
    onFullEdit?.();
  };

  const doDeleteQuote = async (q: Quote) => {
    await deleteQuote(q.id);
    setActiveQuote(null);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
        <div
          className="bg-white rounded-2xl shadow-2xl w-[90vw] max-w-[900px] h-[85vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 顶栏 */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
            <h2 className="text-sm font-medium text-gray-800 truncate max-w-[400px]">{title}</h2>
            <div className="flex items-center gap-1">
              {/* 导出按钮（复用 ExportMenu） */}
              <ExportMenu title={title} content={content} size="md" />

              {/* 打印 */}
              <button onClick={() => window.print()} className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="打印">
                <Printer className="w-4 h-4" />
              </button>

              {/* 全屏编辑 */}
              {onFullEdit && (
                <button
                  onClick={handleFullEdit}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="全屏编辑"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              )}

              <span className="w-px h-5 bg-gray-200 mx-1" />
              <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors" title="关闭">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 内容区 — 复用编辑器样式 */}
          <div className="flex-1 overflow-auto p-8 bg-gray-100">
            <div className={`doc-mode-${docMode}`}>
              <div className="document-editor">
                <div className="document-page">
                  <div
                    ref={contentRef}
                    className="ProseMirror"
                    data-gw-article
                    data-gw-source-type={sourceType}
                    data-gw-source-id={docId || ""}
                    data-gw-source-title={title}
                    dangerouslySetInnerHTML={{ __html: content }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 选中文字 → 添加金句 气泡（仅文章容器内） */}
      <QuoteSelectionBubble />

      {/* 点击金句 → 删除气泡 */}
      {activeQuote && (
        <div
          className="fixed z-[115] flex items-center gap-1 bg-gray-900 text-white rounded-lg shadow-lg px-1 py-1"
          style={{
            top: Math.max(activeQuote.rect.top - 44, 8),
            left: Math.min(activeQuote.rect.left, (typeof window !== "undefined" ? window.innerWidth : 800) - 160),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 text-[11px] max-w-[180px] truncate" title={activeQuote.q.content}>
            “{activeQuote.q.content.slice(0, 12)}…”
          </div>
          <button
            onClick={() => doDeleteQuote(activeQuote.q)}
            className="flex items-center gap-0.5 px-2 py-1 text-xs bg-red-500 hover:bg-red-600 rounded"
            title="删除金句"
          >
            <Trash2 className="w-3.5 h-3.5" /> 删除
          </button>
          <button onClick={() => setActiveQuote(null)} className="p-1.5 text-gray-300 hover:text-white rounded" title="取消">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 未保存修改确认弹窗 */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setShowSaveDialog(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-800">存在未保存的修改</h3>
                <p className="text-xs text-gray-500 mt-1">当前文档有未保存的修改，是否需要处理？</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveThenEdit}
                className="flex-1 px-4 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                保存修改，再打开目标文档
              </button>
              <button
                onClick={handleDiscardThenEdit}
                className="flex-1 px-4 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
              >
                放弃修改，直接打开
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
