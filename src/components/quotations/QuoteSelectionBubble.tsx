"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Quote as QuoteIcon } from "lucide-react";
import { AddQuoteDialog } from "./AddQuoteDialog";

interface BubbleState {
  text: string;
  top: number;
  left: number;
  sourceType: string;
  sourceId: string;
  sourceTitle: string;
}

// 全局选区气泡：在带 data-gw-article 的文章容器内选中文字时，浮出“添加金句”按钮。
// 编辑器（contenteditable=true）由其自身的气泡菜单处理，这里自动跳过。
export function QuoteSelectionBubble() {
  const [bubble, setBubble] = useState<BubbleState | null>(null);
  const [dialog, setDialog] = useState<{ text: string; sourceType: string; sourceId: string; sourceTitle: string } | null>(null);
  const bubbleRef = useRef<BubbleState | null>(null);

  const hide = useCallback(() => { setBubble(null); bubbleRef.current = null; }, []);

  useEffect(() => {
    const handler = () => {
      // 延迟到 selection 稳定后再读取
      window.setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) { hide(); return; }
        const text = sel.toString().trim();
        if (!text || text.length < 2) { hide(); return; }
        const anchorEl = (sel.anchorNode as HTMLElement | null)?.parentElement
          || (sel.anchorNode as any)?.parentElement;
        if (!anchorEl) { hide(); return; }
        const article = anchorEl.closest("[data-gw-article]") as HTMLElement | null;
        if (!article) { hide(); return; }
        if (anchorEl.closest('[contenteditable="true"]')) { hide(); return; }
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) { hide(); return; }
        const top = Math.min(rect.top - 44, (typeof window !== "undefined" ? window.innerHeight : 800) - 44);
        const state: BubbleState = {
          text,
          top: top < 8 ? rect.bottom + 8 : top,
          left: Math.min(Math.max(rect.left + rect.width / 2 - 50, 8), (typeof window !== "undefined" ? window.innerWidth : 800) - 120),
          sourceType: article.dataset.gwSourceType || "manual",
          sourceId: article.dataset.gwSourceId || "",
          sourceTitle: article.dataset.gwSourceTitle || "",
        };
        bubbleRef.current = state;
        setBubble(state);
      }, 10);
    };
    document.addEventListener("mouseup", handler);
    document.addEventListener("touchend", handler);
    // 滚动/重新选择时隐藏
    window.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("mouseup", handler);
      document.removeEventListener("touchend", handler);
      window.removeEventListener("scroll", hide, true);
    };
  }, [hide]);

  return (
    <>
      {bubble && (
        <button
          className="fixed z-[110] flex items-center gap-1 px-2.5 py-1.5 text-xs text-white bg-amber-500 rounded-lg shadow-lg hover:bg-amber-600"
          style={{ top: bubble.top, left: bubble.left }}
          onMouseDown={(e) => e.preventDefault()} // 防止按钮点击清空选区
          onClick={() => {
            setDialog({
              text: bubble.text,
              sourceType: bubble.sourceType,
              sourceId: bubble.sourceId,
              sourceTitle: bubble.sourceTitle,
            });
            hide();
          }}
        >
          <QuoteIcon className="w-3.5 h-3.5" /> 添加金句
        </button>
      )}

      {dialog && (
        <AddQuoteDialog
          open
          onClose={() => setDialog(null)}
          defaultText={dialog.text}
          sourceType={dialog.sourceType}
          sourceId={dialog.sourceId}
          sourceTitle={dialog.sourceTitle}
        />
      )}
    </>
  );
}
