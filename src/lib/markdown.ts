// ─── 公文 Markdown 转 HTML 工具 ─────────────────
// 将 AI 输出的 Markdown 解析为 TipTap 可识别的 HTML
// 标题映射：# → doc-title, ## → h1, ### → h2, #### → h3

import { marked } from "marked";

/** 判断一段文本是否像 Markdown（含 # 标题、**加粗、列表等） */
export function looksLikeMarkdown(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const patterns = [
    /^#{1,6}\s+/m,      // 标题
    /\*\*[\s\S]+?\*\*/,  // 加粗
    /^\s*[-*+]\s+/m,    // 无序列表
    /^\s*\d+\.\s+/m,    // 有序列表
    /^\s*>\s+/m,        // 引用
    /!\[.*?\]\(.*?\)/, // 图片
    /\[.*?\]\(.*?\)/,   // 链接
    /^\s*```/m,         // 代码块
  ];
  return patterns.some((p) => p.test(text));
}

/** 将 Markdown 转换为公文 HTML（TipTap 格式） */
export function markdownToGovDocHtml(md: string, title?: string): string {
  if (!md) return "";

  // 使用 marked 解析为 HTML
  let html = marked.parse(md, {
    gfm: true,
    breaks: false,
  }) as string;

  // 清理外层包裹
  html = html.trim();

  // 标题映射：TipTap 里 h1/h2/h3 已可用，但公文主标题用 doc-title
  // 策略：优先把第一个 <h1> 转 doc-title；如果没有 <h1>，把遇到的第一个 <h2>/<h3>/<h4> 转 doc-title
  let titleConverted = false;
  html = html.replace(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi, (_, level, content) => {
    const text = content.replace(/<[^>]+>/g, "").trim();
    if (!titleConverted && text) {
      titleConverted = true;
      return `<div data-type="doc-title">${content}</div>`;
    }
    return `<h${level}>${content}</h${level}>`;
  });

  // 如果用户传了 title 且第一个标题被转换了，但内容里没有标题，则补一个 doc-title
  if (title && !titleConverted && !html.includes('data-type="doc-title"')) {
    html = `<div data-type="doc-title">${title}</div>\n${html}`;
  }

  // 去掉空的 <p></p> 和多余的换行
  html = html.replace(/<p>\s*<\/p>/g, "");

  return html;
}

/** 安全地把任意文本转换为公文 HTML（优先识别 Markdown） */
export function safeTextToGovDocHtml(text: string, title?: string): string {
  if (!text) return "";
  if (looksLikeMarkdown(text)) {
    return markdownToGovDocHtml(text, title);
  }
  // 纯文本：按段落拆分
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${p.trim().replace(/\n/g, "<br/>")}</p>`)
    .filter((p) => p.length > 7)
    .join("\n");
}
