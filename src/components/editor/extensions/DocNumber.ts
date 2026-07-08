// ─── 发文字号扩展（简化版） ─────────────────────
// 行内节点，插入发文字号如 "泰兴产业学院〔2026〕1号"

import { Node, mergeAttributes } from "@tiptap/core";

export const DocNumber = Node.create({
  name: "docNumber",

  group: "inline",
  inline: true,
  selectable: true,
  atom: true,                // 原子节点，不可编辑内部

  addAttributes() {
    return {
      text: {
        default: "泰兴产业学院〔2026〕1号",
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-type='doc-number']" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "doc-number",
        class: "doc-number",
      }),
      HTMLAttributes.text || "泰兴产业学院〔2026〕1号",
    ];
  },
});
