// ─── 公文 HTML 清洗工具 ──────────────────────────
// 用于把外部/AI 生成的 HTML 还原为「纯结构」，让 editor.css 的公文格式生效。
// 清除行内样式、拆除行内格式化标签，保留块级结构与 TipTap 公文语义节点的 class。

const INLINE_TAGS = [
  "SPAN", "FONT", "B", "STRONG", "I", "EM", "U", "S", "STRIKE",
  "SUB", "SUP", "MARK", "SMALL", "LABEL", "CENTER",
];

// 行内属性：全部剥离（这些会覆盖公文 CSS）
const ATTRS_TO_REMOVE = [
  "style", "align", "width", "height", "bgcolor", "color", "face", "size",
];

// 公文语义节点的 class 必须保留，否则强制渲染后标题/文号/红头/印章会退化成普通正文
const GOV_CLASS_WHITELIST = new Set([
  "doc-title", "doc-number", "official-seal", "red-header",
  "red-header-text", "red-header-separator", "doc-banji",
  "official-footer", "signature-block", "de-banji-left",
  "de-banji-right", "de-banji-line",
]);

function isGovClass(cls: string): boolean {
  if (GOV_CLASS_WHITELIST.has(cls)) return true;
  return /^(doc-|de-|official|red-|seal|signature|gov-)/.test(cls);
}

/**
 * 清洗 HTML：
 * 1. 移除行内样式与排版属性
 * 2. 保留公文语义节点的 class（doc-title 等），只剥掉 Word/网页粘贴带来的垃圾类
 * 3. 拆除行内格式化标签（span/font/b/strong…），保留块级结构
 */
export function sanitizeGovHtml(html: string): string {
  if (typeof window === "undefined" || !html) return html;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");

    // 1. 处理属性：行内样式全删；class 仅保留公文语义类，其余剥离
    doc.querySelectorAll("*").forEach((el) => {
      ATTRS_TO_REMOVE.forEach((attr) => el.removeAttribute(attr));

      const cls = el.getAttribute("class");
      if (cls) {
        const kept = cls
          .split(/\s+/)
          .filter((c) => c && isGovClass(c));
        if (kept.length > 0) {
          el.setAttribute("class", kept.join(" "));
        } else {
          el.removeAttribute("class");
        }
      }
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
