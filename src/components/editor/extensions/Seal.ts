// ─── 印章扩展（简化版） ─────────────────────────
// 行内节点，插入圆形红色印章效果

import { Node, mergeAttributes } from "@tiptap/core";

export const Seal = Node.create({
  name: "seal",

  group: "inline",
  inline: true,
  selectable: true,
  atom: true,

  addAttributes() {
    return {
      text: {
        default: "泰兴产业学院",
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-type='seal']" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "seal",
        class: "official-seal",
      }),
      HTMLAttributes.text || "泰兴产业学院",
    ];
  },
});
