// ─── 核心公文编辑器组件 ──────────────────────────
// 基于 TipTap 的富文本编辑器，支持三种模式（simple/gb/official）
// 包含公文特殊格式：红头、发文字号、印章、版记

"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Dropcursor from "@tiptap/extension-dropcursor";
import Gapcursor from "@tiptap/extension-gapcursor";
import { RedHeader } from "./extensions/RedHeader";
import { DocNumber } from "./extensions/DocNumber";
import { Seal } from "./extensions/Seal";
import { DocTitle } from "./extensions/DocTitle";
import { useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";
import type { DocMetaInfo } from "@/types";
import { looksLikeMarkdown, markdownToGovDocHtml } from "@/lib/markdown";
import { sanitizeGovHtml } from "@/lib/sanitize-gov-html";
import { useEditorStore } from "@/stores/editor.store";
import "./editor.css";

interface DocEditorProps {
  content?: string;
  onChange?: (html: string) => void;
  editable?: boolean;
  placeholder?: string;
  docMode?: "gb" | "simple" | "official";
  onEditorReady?: (editor: Editor) => void;
  meta?: DocMetaInfo;
  onSelectionChange?: (info: { text: string; rect: { top: number; left: number; bottom: number; right: number } | null }) => void;
}

/** 将 Markdown 格式的模板文本转换为 HTML */
function templateMarkdownToHtml(md: string): string {
  return markdownToGovDocHtml(md);
}

export function DocEditor({
  content = "",
  onChange,
  editable = true,
  placeholder = "开始撰写公文...",
  docMode = "simple",
  onEditorReady,
  meta,
  onSelectionChange,
}: DocEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        // 下面这些扩展单独导入配置，从 StarterKit 中移除避免重复
        link: false,
        underline: false,
        dropcursor: false,
        gapcursor: false,
      }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-blue-600 underline" } }),
      Image.configure({ HTMLAttributes: { class: "max-w-full h-auto" } }),
      TextAlign.configure({ types: ["heading", "paragraph", "docTitle"] }),
      TextStyle,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: true, allowTableNodeSelection: true }),
      TableRow, TableCell, TableHeader,
      Placeholder.configure({ placeholder }),
      TaskList, TaskItem.configure({ nested: true }),
      Dropcursor, Gapcursor,
      RedHeader, DocNumber, Seal, DocTitle,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose max-w-none focus:outline-none min-h-[300px] px-8 py-4",
      },
      // ── 粘贴强制渲染：清除外部字体/加粗/颜色等行内样式 ──
      // 从 AI 对话、网页、Word 复制过来的文字常带 font-family/font-weight/color，
      // 直接粘贴会绕过正文 CSS（仿宋/黑体）显示为粗黑体。此处剥离所有行内样式与
      // 行内格式化标签（span/font/b/strong/i…），仅保留块级结构，让正文回归仿宋。
      transformPastedHTML: (html: string) => sanitizeGovHtml(html),
    },
  });

  // 编辑器就绪回调
  const readyCalled = useRef(false);
  useEffect(() => {
    if (editor && onEditorReady && !readyCalled.current) {
      readyCalled.current = true;
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // 内容变化时更新（外部传入 content 时统一清洗行内样式，确保回归标准公文格式）
  useEffect(() => {
    if (editor && content) {
      const currentHtml = editor.getHTML();
      const isMarkdown = looksLikeMarkdown(content);
      const html = isMarkdown ? templateMarkdownToHtml(content) : content;
      const targetHtml = sanitizeGovHtml(html);
      if (targetHtml && targetHtml !== currentHtml) {
        editor.commands.setContent(targetHtml);
      }
    }
  }, [content, editor]);

  // 选区变化监听（同时回传选区视口坐标，供 AI 浮条定位）
  useEffect(() => {
    if (!editor || !onSelectionChange) return;
    // 失焦保护：焦点移到 Chatbox 时编辑器选区会被浏览器折叠并触发 selectionUpdate，
    // 此时不应清空已选文本，以便用户能在右侧手动输入指令作用于选中内容。
    const blurringRef = { current: false };
    const onBlur = () => {
      blurringRef.current = true;
      // 当前事件循环结束后再解除（涵盖 blur 引起的折叠 selectionUpdate）
      setTimeout(() => { blurringRef.current = false; }, 0);
    };
    const handleSelection = () => {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        let rect: { top: number; left: number; bottom: number; right: number } | null = null;
        try {
          const c = editor.view.coordsAtPos(to);
          rect = { top: c.top, left: c.left, bottom: c.bottom, right: c.right };
        } catch {}
        onSelectionChange({ text: editor.state.doc.textBetween(from, to, " "), rect });
      } else if (!blurringRef.current) {
        // 仅在编辑器内主动折叠选区（非失焦）时清空
        onSelectionChange({ text: "", rect: null });
      }
    };
    editor.on("selectionUpdate", handleSelection);
    editor.on("blur", onBlur);
    return () => {
      editor.off("selectionUpdate", handleSelection);
      editor.off("blur", onBlur);
    };
  }, [editor, onSelectionChange]);

  // 编辑器卸载（切换文档 / 离开页面）时清空全局选区状态，
  // 避免旧文档的选中文字残留到全局 store，被后续「无选区」指令误当成选中内容抓取。
  useEffect(() => {
    return () => {
      const st = useEditorStore.getState();
      if (st.selectedText || st.selectionRect) {
        st.setSelectedText("");
        st.setSelectionRect(null);
      }
    };
  }, []);

  if (!editor) {
    return (
      <div className="text-center text-gray-400 text-sm py-8">
        编辑器加载中...
      </div>
    );
  }

  // 判断是否显示版记
  const hasBanji = meta?.issuingAuthority || meta?.recipient || meta?.printDate || meta?.docNumber;

  return (
    <div className={`doc-mode-${docMode}`}>
      <div className="document-editor">
        <div className="document-page">
          <EditorContent editor={editor} />

          {/* 版记自动渲染 */}
          {hasBanji && (
            <div className="de-banji-preview">
              <div className="de-banji-line"></div>
              <div className="de-banji-row">
                <span className="de-banji-left">{meta?.issuingAuthority || ""}</span>
                <span className="de-banji-right">{meta?.printDate || ""}</span>
              </div>
              <div className="de-banji-line"></div>
              <div className="de-banji-row">
                <span className="de-banji-left">{meta?.recipient || ""}</span>
                <span className="de-banji-right"></span>
              </div>
              <div className="de-banji-line"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
