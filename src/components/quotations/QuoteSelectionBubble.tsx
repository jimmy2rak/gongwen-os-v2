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
    // 读取当前选区并决定是否显示气泡（桌面/移动端通用）
    const evaluate = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) { hide(); return; }
      const text = sel.toString().trim();
      if (!text || text.length < 2) { hide(); return; }
      // anchorNode 可能是文本节点，取其父元素定位所属文章容器
      const anchorNode = sel.anchorNode;
      const anchorEl = (anchorNode?.nodeType === 1 ? anchorNode : anchorNode?.parentElement) as HTMLElement | null;
      if (!anchorEl) { hide(); return; }
      const article = anchorEl.closest("[data-gw-article]") as HTMLElement | null;
      if (!article) { hide(); return; }
      if (anchorEl.closest('[contenteditable="true"]')) { hide(); return; }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) { hide(); return; }
      const vh = typeof window !== "undefined" ? window.innerHeight : 800;
      const vw = typeof window !== "undefined" ? window.innerWidth : 800;
      const top = Math.min(rect.top - 44, vh - 44);
      const state: BubbleState = {
        text,
        top: top < 8 ? rect.bottom + 8 : top,
        left: Math.min(Math.max(rect.left + rect.width / 2 - 50, 8), vw - 120),
        sourceType: article.dataset.gwSourceType || "manual",
        sourceId: article.dataset.gwSourceId || "",
        sourceTitle: article.dataset.gwSourceTitle || "",
      };
      bubbleRef.current = state;
      setBubble(state);
    };

    // 防抖：移动端拖动选区手柄会连续触发 selectionchange，等稳定后再读取
    let debTimer: number | undefined;
    const onSelectionChange = () => {
      if (debTimer) window.clearTimeout(debTimer);
      debTimer = window.setTimeout(evaluate, 300);
    };
    // 指针抬起后立即再确认一次（桌面鼠标 / 移动端点按）
    const onPointerUp = () => { window.setTimeout(evaluate, 20); };

    // selectionchange 是移动端最可靠的主检测；mouseup/touchend 作为即时补充
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("mouseup", onPointerUp);
    document.addEventListener("touchend", onPointerUp);
    // 滚动时隐藏（移动端选区手柄拖动会伴随滚动，但 selectionchange 会重新评估）
    window.addEventListener("scroll", hide, true);
    return () => {
      if (debTimer) window.clearTimeout(debTimer);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("mouseup", onPointerUp);
      document.removeEventListener("touchend", onPointerUp);
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
