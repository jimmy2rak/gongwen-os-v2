// ─── 把生成的纯文本保存为公文文档 ─────────────────
// 转成编辑器可解析的 HTML（doc-title + 段落），POST /api/documents。

"use client";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

import { markdownToGovDocHtml, looksLikeMarkdown } from "./markdown";

export async function createDocFromText(
  title: string,
  category: string,
  text: string
): Promise<{ id: string } | null> {
  const content = looksLikeMarkdown(text)
    ? markdownToGovDocHtml(text, title)
    : `<div data-type="doc-title">${escapeHtml(title)}</div>${text
        .split(/\n{2,}/)
        .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
        .join("") || "<p></p>"}`;

  const res = await fetch("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, category, content, format: "gb" }),
  });
  if (!res.ok) return null;
  const j = await res.json();
  return j.data?.id ? { id: j.data.id } : null;
}
