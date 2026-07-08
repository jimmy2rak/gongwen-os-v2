// ─── 红头扩展（简化版） ─────────────────────────
// 直接在光标位置插入红头文字 + 红色分隔线
// 不包含子内容节点，就是一个完整渲染的块

import { Node, mergeAttributes } from "@tiptap/core";

export const RedHeader = Node.create({
  name: "redHeader",

  group: "block",
  content: "",              // 空内容：不包含子节点，自身就是一个独立块

  atom: true,                // 原子节点：被视为一个整体，不可编辑内部

  addAttributes() {
    return {
      text: {
        default: "×××人民政府文件",
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-type='red-header']" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "red-header",
        class: "red-header",
      }),
      ["div", { class: "red-header-text" }, HTMLAttributes.text || "×××人民政府文件"],
      ["div", { class: "red-header-separator" }],
    ];
  },
});
