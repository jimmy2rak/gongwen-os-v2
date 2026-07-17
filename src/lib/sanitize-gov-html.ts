// ─── 公文 HTML 清洗工具 ──────────────────────────
// 用于把外部/AI 生成的 HTML 还原为「纯结构」，让 editor.css 的公文格式生效。
// 清除行内样式、拆除行内格式化标签，保留块级结构与 TipTap 识别的 data-type。

const INLINE_TAGS = [
  "SPAN", "FONT", "B", "STRONG", "I", "EM", "U", "S", "STRIKE",
  "SUB", "SUP", "MARK", "SMALL", "LABEL", "CENTER",
];

const ATTRS_TO_REMOVE = [
  "style", "class", "align", "width", "height", "bgcolor", "color", "face", "size",
];

/**
 * 清洗 HTML，移除所有行内样式与行内标签，仅保留块级结构。
 * 保留 data-type="doc-title" 等 TipTap 自定义节点标记。
 */
export function sanitizeGovHtml(html: string): string {
  if (typeof window === "undefined" || !html) return html;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");

    // 1. 移除所有元素的行内样式与不需要的属性
    doc.querySelectorAll("*").forEach((el) => {
      ATTRS_TO_REMOVE.forEach((attr) => el.removeAttribute(attr));
    });

    // 2. 拆除行内格式化标签，仅保留其子节点文本
    INLINE_TAGS.forEach((tag) => {
      doc.querySelectorAll(tag).forEach((el) => {
        const parent = el.parentNode;
        if (!parent) return;
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
      });
    });

    return doc.body.innerHTML;
  } catch {
    return html;
  }
}
