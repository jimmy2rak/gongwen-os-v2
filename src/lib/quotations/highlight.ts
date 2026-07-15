"use client";

import type { Quote } from "./types";

// 在容器里清除已注入的金句高亮包裹节点（还原文本）
export function clearQuoteHighlights(root: HTMLElement) {
  root.querySelectorAll("span.gw-quote").forEach((el) => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  });
}

// 在容器内为每条金句注入头尾黄点 + hover 紫色薄纱高亮（仅 UI，不写入文档内容）
// onQuoteClick: 点击金句时的回调（用于弹出删除菜单）
export function applyQuoteHighlights(
  root: HTMLElement,
  quotes: Quote[],
  onQuoteClick?: (q: Quote, rect: DOMRect) => void,
) {
  clearQuoteHighlights(root);
  for (const q of quotes) {
    const text = (q.content || "").trim();
    if (!text) continue;
    wrapFirstOccurrence(root, text, q, onQuoteClick);
  }
}

function wrapFirstOccurrence(
  root: HTMLElement,
  text: string,
  q: Quote,
  onQuoteClick?: (q: Quote, rect: DOMRect) => void,
) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = (node.parentNode as HTMLElement | null)?.tagName;
      if (p === "SCRIPT" || p === "STYLE") return NodeFilter.FILTER_REJECT;
      if ((node.parentNode as HTMLElement | null)?.closest?.(".gw-quote")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const tn = node as Text;
    const val = tn.nodeValue || "";
    const idx = val.indexOf(text);
    if (idx !== -1) {
      wrapRange(tn, idx, idx + text.length, q, onQuoteClick);
      return; // 仅高亮首次出现
    }
  }
}

function wrapRange(
  textNode: Text,
  start: number,
  end: number,
  q: Quote,
  onQuoteClick?: (q: Quote, rect: DOMRect) => void,
) {
  try {
    const range = document.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, end);
    const span = document.createElement("span");
    span.className = "gw-quote";
    span.dataset.qid = q.id;
    range.surroundContents(span);
    markEnds(span, q, onQuoteClick);
  } catch {
    /* surroundContents 在跨元素选区时会抛错，忽略即可 */
  }
}

// 把首字包成 gw-ch-start（左上角黄点），尾字包成 gw-ch-end（右上角黄点）
function markEnds(span: HTMLSpanElement, q: Quote, onQuoteClick?: (q: Quote, rect: DOMRect) => void) {
  const first = span.firstChild;
  if (!first || first.nodeType !== Node.TEXT_NODE) return;
  const len = (first as Text).nodeValue?.length || 0;
  if (len <= 1) {
    const w = document.createElement("span");
    w.className = "gw-ch gw-ch-start";
    w.textContent = (first as Text).nodeValue || "";
    span.replaceChild(w, first);
  } else {
    const r1 = document.createRange();
    r1.setStart(first, 0);
    r1.setEnd(first, 1);
    const s1 = document.createElement("span");
    s1.className = "gw-ch gw-ch-start";
    try { r1.surroundContents(s1); } catch { /* ignore */ }
    const rest = s1.nextSibling as Text | null;
    if (rest && rest.nodeType === Node.TEXT_NODE && (rest.nodeValue?.length || 0) >= 1) {
      const r2 = document.createRange();
      r2.setStart(rest, rest.nodeValue!.length - 1);
      r2.setEnd(rest, rest.nodeValue!.length);
      const s2 = document.createElement("span");
      s2.className = "gw-ch gw-ch-end";
      try { r2.surroundContents(s2); } catch { /* ignore */ }
    }
  }
  if (onQuoteClick) {
    span.addEventListener("click", (e) => {
      e.stopPropagation();
      const rect = span.getBoundingClientRect();
      onQuoteClick(q, rect);
    });
  }
}

// 定位闪烁：把包含 locateText 的首个金句/文本滚动到可视区并闪烁
export function locateAndFlash(root: HTMLElement, locateText: string) {
  if (!locateText) return;
  const target = root.querySelector<HTMLElement>(`span.gw-quote[data-qid]`) &&
    Array.from(root.querySelectorAll<HTMLElement>("span.gw-quote")).find((s) => (s.textContent || "").includes(locateText))
    ? Array.from(root.querySelectorAll<HTMLElement>("span.gw-quote")).find((s) => (s.textContent || "").includes(locateText))!
    : Array.from(root.querySelectorAll<HTMLElement>("p, li, div")).find((s) => (s.textContent || "").includes(locateText));
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.add("gw-locate-flash");
  setTimeout(() => target.classList.remove("gw-locate-flash"), 1700);
}
