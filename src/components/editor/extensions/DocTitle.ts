// ─── 公文标题（题）扩展 ──────────────────────────
// 可编辑块级节点：方正小标宋简体、居中、28pt 行距
// 用于公文主标题（如"关于××的报告"），替代原来的 h1

import { Node, mergeAttributes } from "@tiptap/core";

export const DocTitle = Node.create({
  name: "docTitle",

  group: "block",
  content: "inline*",         // 可编辑内容：文本 + 行内标记
  defining: true,             // 节点自身定义其类型（用于 toolbar isActive 判定）

  addAttributes() {
    return {};
  },

  parseHTML() {
    return [
      { tag: "div[data-type='doc-title']" },
      { tag: "h1[data-type='doc-title']" },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "doc-title",
        class: "doc-title",
      }),
      0,
    ];
  },
});
