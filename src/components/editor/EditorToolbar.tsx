// ─── 编辑工具栏 ──────────────────────────────────
// 放置在编辑器上方，提供文字格式、标题、对齐、表格、图片、公文特殊格式等操作按钮

"use client";

import type { Editor } from "@tiptap/react";
import {
  Bold, Italic, Underline, Strikethrough,
  Heading1, Heading2, Heading3, Heading4,
  List, ListOrdered, Quote, Code,
  Table as TableIcon, Image as ImageIcon, Link,
  AlignLeft, AlignCenter, AlignRight,
  Minus, Undo, Redo, Pilcrow,
  FileText, Hash, Stamp, Type,
  Highlighter, Heading,
} from "lucide-react";
import { useState } from "react";
import { CustomDialog } from "@/components/ui/CustomDialog";
import { sanitizeGovHtml } from "@/lib/sanitize-gov-html";

interface EditorToolbarProps {
  editor: Editor | null;
  onImageUpload: () => void;
}

const HIGHLIGHT_COLORS = [
  { name: "黄色", color: "#fef08a" },
  { name: "绿色", color: "#bbf7d0" },
  { name: "蓝色", color: "#bfdbfe" },
  { name: "粉色", color: "#fbcfe8" },
  { name: "橙色", color: "#fed7aa" },
  { name: "红色", color: "#fecaca" },
  { name: "紫色", color: "#e9d5ff" },
  { name: "青色", color: "#a5f3fc" },
];

// 自定义命令的辅助函数（绕过 TipTap 类型限制）
const cmd = (editor: Editor) => ({
  setRedHeader: () => editor.chain().focus().insertContent({ type: "redHeader" }).run(),
  setDocNumber: () => editor.chain().focus().insertContent({ type: "docNumber" }).run(),
  setSeal: (text: string) => editor.chain().focus().insertContent({ type: "seal", attrs: { text } }).run(),
  setDocTitle: () => {
    // 切换 docTitle 节点（题）
    if (editor.isActive("docTitle")) {
      editor.chain().focus().clearNodes().run();
    } else {
      editor.chain().focus().setNode("docTitle").run();
    }
  },
});

export function EditorToolbar({ editor, onImageUpload }: EditorToolbarProps) {
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);

  // 自定义弹窗状态
  const [dialog, setDialog] = useState<{
    mode: "prompt"; title: string; placeholder?: string;
    onConfirm?: (input?: string) => void;
  } | null>(null);
  const closeDialog = () => setDialog(null);

  const promptLink = () => {
    setDialog({
      mode: "prompt", title: "插入超链接", placeholder: "输入链接地址，例如 https://example.com",
      onConfirm: (url) => { if (url) editor?.chain().focus().setLink({ href: url }).run(); },
    });
  };
  const promptSeal = () => {
    setDialog({
      mode: "prompt", title: "输入印章文字", placeholder: "例如：××市人民政府",
      onConfirm: (text) => { if (text) cmd(editor!).setSeal(text); },
    });
  };

  if (!editor) return null;

  // 工具栏按钮分组
  const groups = [
    {
      items: [
        { icon: <Undo className="w-4 h-4" />, label: "撤销", action: () => editor.chain().focus().undo().run() },
        { icon: <Redo className="w-4 h-4" />, label: "重做", action: () => editor.chain().focus().redo().run() },
      ],
    },
    {
      items: [
        { icon: <Bold className="w-4 h-4" />, label: "加粗", action: () => editor.chain().focus().toggleBold().run(), isActive: editor.isActive("bold") },
        { icon: <Italic className="w-4 h-4" />, label: "斜体", action: () => editor.chain().focus().toggleItalic().run(), isActive: editor.isActive("italic") },
        { icon: <Underline className="w-4 h-4" />, label: "下划线", action: () => editor.chain().focus().toggleUnderline().run(), isActive: editor.isActive("underline") },
        { icon: <Strikethrough className="w-4 h-4" />, label: "删除线", action: () => editor.chain().focus().toggleStrike().run(), isActive: editor.isActive("strike") },
      ],
    },
    {
      items: [
        {
          icon: <Highlighter className="w-4 h-4" />,
          label: "高亮",
          action: () => setShowHighlightPicker(!showHighlightPicker),
          isActive: editor.isActive("highlight"),
        },
      ],
    },
    {
      items: [
        { icon: <Heading className="w-4 h-4" />, label: "公文标题（题）", action: () => cmd(editor).setDocTitle(), isActive: editor.isActive("docTitle") },
        { icon: <Type className="w-4 h-4" />, label: "正文（仿宋）", action: () => editor.chain().focus().clearNodes().run(), isActive: editor.isActive("paragraph") && !editor.isActive("heading") && !editor.isActive("docTitle") },
        { icon: <Heading1 className="w-4 h-4" />, label: "一级标题 (一、黑体)", action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), isActive: editor.isActive("heading", { level: 1 }) },
        { icon: <Heading2 className="w-4 h-4" />, label: "二级标题 (（一）楷体)", action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), isActive: editor.isActive("heading", { level: 2 }) },
        { icon: <Heading3 className="w-4 h-4" />, label: "三级标题 (1. 仿宋)", action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), isActive: editor.isActive("heading", { level: 3 }) },
        { icon: <Heading4 className="w-4 h-4" />, label: "四级标题 ((1) 仿宋)", action: () => editor.chain().focus().toggleHeading({ level: 4 }).run(), isActive: editor.isActive("heading", { level: 4 }) },
      ],
    },
    {
      items: [
        { icon: <AlignLeft className="w-4 h-4" />, label: "左对齐", action: () => editor.chain().focus().setTextAlign("left").run(), isActive: editor.isActive({ textAlign: "left" }) },
        { icon: <AlignCenter className="w-4 h-4" />, label: "居中对齐", action: () => editor.chain().focus().setTextAlign("center").run(), isActive: editor.isActive({ textAlign: "center" }) },
        { icon: <AlignRight className="w-4 h-4" />, label: "右对齐", action: () => editor.chain().focus().setTextAlign("right").run(), isActive: editor.isActive({ textAlign: "right" }) },
      ],
    },
    {
      items: [
        { icon: <List className="w-4 h-4" />, label: "无序列表", action: () => editor.chain().focus().toggleBulletList().run(), isActive: editor.isActive("bulletList") },
        { icon: <ListOrdered className="w-4 h-4" />, label: "有序列表", action: () => editor.chain().focus().toggleOrderedList().run(), isActive: editor.isActive("orderedList") },
        { icon: <Quote className="w-4 h-4" />, label: "引用", action: () => editor.chain().focus().toggleBlockquote().run(), isActive: editor.isActive("blockquote") },
        { icon: <Code className="w-4 h-4" />, label: "代码块", action: () => editor.chain().focus().toggleCodeBlock().run(), isActive: editor.isActive("codeBlock") },
      ],
    },
    {
      items: [
        { icon: <TableIcon className="w-4 h-4" />, label: "插入表格", action: () => editor.chain().focus().insertTable({ rows: 3, cols: 4, withHeaderRow: true }).run() },
        { icon: <ImageIcon className="w-4 h-4" />, label: "插入图片", action: onImageUpload },
        { icon: <Link className="w-4 h-4" />, label: "插入链接", action: promptLink },
        { icon: <Minus className="w-4 h-4" />, label: "分割线", action: () => editor.chain().focus().setHorizontalRule().run() },
      ],
    },
    {
      items: [
        { icon: <FileText className="w-4 h-4" />, label: "红头文件", action: () => cmd(editor).setRedHeader(), isActive: editor.isActive("redHeader") },
        { icon: <Hash className="w-4 h-4" />, label: "发文字号", action: () => cmd(editor).setDocNumber(), isActive: editor.isActive("docNumber") },
        { icon: <Stamp className="w-4 h-4" />, label: "印章", action: promptSeal, isActive: editor.isActive("seal") },
      ],
    },
    {
      items: [
        {
          icon: <Pilcrow className="w-4 h-4" />,
          label: "强制渲染",
          action: () => {
            if (!editor) return;
            // 全选 → 清洗所有行内样式/行内标签 → 重新 setContent，让 CSS 标准格式生效
            const html = editor.getHTML();
            const clean = sanitizeGovHtml(html);
            editor.commands.setContent(clean, { emitUpdate: false });
          },
          isActive: false,
        },
      ],
    },
  ];

  return (
    <>
    <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-1 flex-wrap">
      {groups.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5 relative">
          {gi > 0 && <span className="w-px h-5 bg-gray-200 mx-1" />}
          {group.items.map((item, ii) => (
            <button
              key={ii}
              onClick={item.action}
              title={item.label}
              className={`p-1.5 rounded-md transition-colors ${
                (item as any).isActive
                  ? "bg-red-50 text-red-600"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              }`}
            >
              {item.icon}
            </button>
          ))}
          {/* 高亮颜色选择器 */}
          {(group.items[0] as any)?.label === "高亮" && showHighlightPicker && (
            <div
              className="absolute top-full left-0 mt-1 p-3 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[160px]"
              onMouseLeave={() => setShowHighlightPicker(false)}
            >
              {/* 第一行：黄、绿、浅蓝、浅粉 */}
              <div className="grid grid-cols-4 gap-2">
                {HIGHLIGHT_COLORS.slice(0, 4).map((c) => (
                  <button
                    key={c.color}
                    onClick={() => {
                      editor.chain().focus().toggleHighlight({ color: c.color }).run();
                      setShowHighlightPicker(false);
                    }}
                    className="w-7 h-7 rounded-lg border border-gray-200 hover:scale-110 transition-transform"
                    style={{ backgroundColor: c.color }}
                    title={c.name}
                  />
                ))}
              </div>
              {/* 第二行：浅橙、浅红、浅紫、浅青 */}
              <div className="grid grid-cols-4 gap-2 mt-2">
                {HIGHLIGHT_COLORS.slice(4, 8).map((c) => (
                  <button
                    key={c.color}
                    onClick={() => {
                      editor.chain().focus().toggleHighlight({ color: c.color }).run();
                      setShowHighlightPicker(false);
                    }}
                    className="w-7 h-7 rounded-lg border border-gray-200 hover:scale-110 transition-transform"
                    style={{ backgroundColor: c.color }}
                    title={c.name}
                  />
                ))}
              </div>
              {/* 清除高亮按钮 */}
              <div className="mt-3 pt-2 border-t border-gray-100">
                <button
                  onClick={() => {
                    editor.chain().focus().unsetHighlight().run();
                    setShowHighlightPicker(false);
                  }}
                  className="text-[11px] text-gray-500 hover:text-red-500 w-full text-center py-1 rounded-md hover:bg-gray-50 transition-colors"
                >
                  清除高亮
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>

    <CustomDialog
      open={!!dialog}
      mode="prompt"
      title={dialog?.title || ""}
      placeholder={dialog?.placeholder}
      confirmText="确认"
      cancelText="取消"
      onConfirm={dialog?.onConfirm}
      onCancel={closeDialog}
    />
    </>
  );
}
