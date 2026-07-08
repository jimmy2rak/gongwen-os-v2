// ─── POST /api/export — 文档导出 ─────────────────
// 接受 TipTap HTML 内容，返回 docx 文件
// 行距规则（固定磅值，EXACT）：
//   除红头(.red-header-text)外，所有元素（题/docTitle、h1~h4、正文）统一 28pt 固定行距，段前段后 0
//   红头保持编辑器原行距（不参与本规则，按原样导出）
// 标题字体映射：
//   div[data-type="doc-title"] → 方正小标宋简体 22pt 居中（题）
//   h1 → 黑体 16pt 一级标题
//   h2 → 楷体 16pt 二级标题
//   h3 → 仿宋_GB2312 16pt 粗体 三级标题
//   h4 → 仿宋_GB2312 16pt 四级标题
// 页边距（GB/T 9704-2012）：上 3.7cm、下 3.5cm、左 2.8cm、右 2.6cm

import { NextRequest, NextResponse } from "next/server";
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  LineRuleType,
} from "docx";

// ─── 工具 ──────────────────────────────────────
/** 磅 → twip：1 磅 = 1/72 英寸 = 20 twip */
const ptToTwip = (pt: number) => Math.round(pt * 20);

/** 统一固定行距：除红头外所有元素（主标题 h1、各级标题、正文）均为 28pt，段前段后 0 */
const bodyLineSpacing = {
  lineRule: LineRuleType.EXACT,
  line: ptToTwip(28),
  spaceBefore: 0,
  spaceAfter: 0,
};

/** 小标宋标题（题 / doc-title / 主标题参数）专属固定行距：32pt（用户验收后要求小标宋标题恢复 32pt；红头保持原样不参与） */
const docTitleLineSpacing = {
  lineRule: LineRuleType.EXACT,
  line: ptToTwip(32),
  spaceBefore: 0,
  spaceAfter: 0,
};

/** 正文首行缩进 2 字符：OOXML firstLineChars 单位（1/100 字符）→ Word 显示"2字符"，绝不用 twips（否则显示成厘米） */
const firstLineChars2 = { firstLineChars: 200 };

/** 列表项左缩进 2 字符（编辑器 ul/ol padding-left:2em；列表不用首行缩进） */
const listLeftIndent = { left: ptToTwip(32) }; // 2em@16pt = 32pt = 640twip

/** 引用块左缩进 3em（编辑器 margin-left:2em + padding-left:1em @16pt = 48pt = 960twip） */
const quoteLeftIndent = { left: ptToTwip(48) };

/** 从行内 HTML 片段提取 TextRun 列表（解析 <mark>、<span> 高亮背景色） */
function parseInlineToTextRuns(html: string): TextRun[] {
  const runs: TextRun[] = [];

  // 预处理：将 <br> 转为换行符，方便后续分段
  const normalized = html.replace(/<br\s*\/?>/gi, "\n");

  // 按高亮标签 + 普通文本分段
  const pattern = /<(?:mark|span)\s+([^>]*)>([^<]+)<\/(?:mark|span)>|([^<]+)/g;
  let match;

  while ((match = pattern.exec(normalized)) !== null) {
    if (match[1] !== undefined && match[2] !== undefined) {
      // 有高亮背景的标记
      const attrs = match[1];
      const spanText = match[2].trim();
      if (!spanText) continue;

      let bgColor = "";
      const styleMatch = attrs.match(/style="[^"]*background-color:\s*(#[0-9a-fA-F]+|rgb\([^)]+\))/);
      if (styleMatch) bgColor = styleMatch[1];
      if (!bgColor) {
        const dataMatch = attrs.match(/data-color="([^"]+)"/);
        if (dataMatch) bgColor = dataMatch[1];
      }

      let hexColor = "";
      if (bgColor) {
        const rgbMatch = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
          hexColor = "#" + [1,2,3].map(i => parseInt(rgbMatch[i]).toString(16).padStart(2, "0")).join("");
        } else if (bgColor.startsWith("#")) {
          hexColor = bgColor;
        }
      }

      const cleanText = spanText.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');

      const runOpts: any = { text: cleanText, font: "仿宋_GB2312", size: 32 };
      if (hexColor) {
        runOpts.shading = { type: "clear", fill: hexColor.replace("#", "") };
      }
      runs.push(new TextRun(runOpts));
    } else if (match[3] !== undefined) {
      // 纯文本（可能夹杂 <strong>、<br> 等其他标签，剥离标签提取纯文本）
      const txt = match[3]
        .replace(/<[^>]+>/g, "")   // 剥掉所有 HTML 标签
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .trim();
      if (!txt) continue;
      runs.push(new TextRun({ text: txt, font: "仿宋_GB2312", size: 32 }));
    }
  }

  return runs;
}

// ─── HTML → docx 段落解析 ──────────────────────
// 使用完整标签匹配（<h1>...</h1>、<p>...</p>），避免拆分标签时截断内部属性值
function htmlToDocxParagraphs(rawHtml: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  if (!rawHtml) return paragraphs;

  // 预处理：压缩连续空白/换行，消除换行打断正则分组捕获的问题
  const html = rawHtml
    .replace(/\r\n/g, "\n")
    .replace(/\n\s*/g, " ")
    .replace(/>\s+</g, "><")
    .trim();

  // 匹配完整块级元素：<tag ...>content</tag>
  const blockPattern = /<(p|h[1-4]|div|li|blockquote)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let blockMatch;
  let matchCount = 0;

  while ((blockMatch = blockPattern.exec(html)) !== null) {
    const tagName = blockMatch[1].toLowerCase();
    const innerHtml = blockMatch[3].trim();
    matchCount++;
    console.log(`[Export] 块${matchCount}: <${tagName}> 内容="${innerHtml.replace(/<[^>]+>/g, "").slice(0, 50)}"`);

    if (!innerHtml) { console.log(`[Export] 跳过空内容: <${tagName}>`); continue; }

    // 提取纯文本 + 高亮 run
    const runs = parseInlineToTextRuns(innerHtml);
    if (runs.length === 0) { console.log(`[Export] 无文本run: <${tagName}>`); continue; }

    // ── 公文标题（题）── div[data-type="doc-title"] 或含 data-type="doc-title" 属性 ──
    const isDocTitle = tagName === "div" && blockMatch[2]?.includes("doc-title");
    if (isDocTitle) {
      const plainText = innerHtml.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
      console.log(`[Export] → 题(doc-title): 文本="${plainText.slice(0, 40)}"`);
      if (plainText) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: plainText, bold: true, font: "方正小标宋简体", size: 44 })],
          alignment: AlignmentType.CENTER,
          spacing: docTitleLineSpacing,
        }));
      }
    } else if (tagName === "h1") {
      const plainText = innerHtml.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
      console.log(`[Export] → H1(黑体): 文本="${plainText.slice(0, 40)}"`);
      if (plainText) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: plainText, bold: true, font: "黑体", size: 32 })],
          spacing: bodyLineSpacing,
          indent: firstLineChars2,
        }));
      }
    } else if (tagName === "h2") {
      const plainText = innerHtml.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
      console.log(`[Export] → H2(楷体): 文本="${plainText.slice(0, 40)}"`);
      if (plainText) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: plainText, bold: true, font: "楷体", size: 32 })],
          spacing: bodyLineSpacing,
          indent: firstLineChars2,
        }));
      }
    } else if (tagName === "h3") {
      const plainText = innerHtml.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
      console.log(`[Export] → H3(仿宋): 文本="${plainText.slice(0, 40)}"`);
      if (plainText) {
        paragraphs.push(new Paragraph({
          children: [new TextRun({ text: plainText, bold: true, font: "仿宋_GB2312", size: 32 })],
          spacing: bodyLineSpacing,
          indent: firstLineChars2,
        }));
      }
    } else if (tagName === "h4") {
      console.log(`[Export] → H4(仿宋): 四级标题样式`);
      paragraphs.push(new Paragraph({
        children: runs,
        spacing: bodyLineSpacing,
        indent: firstLineChars2,
      }));
    } else if (tagName === "blockquote") {
      console.log(`[Export] → blockquote: 左缩进，不首行缩进`);
      paragraphs.push(new Paragraph({
        children: runs,
        spacing: bodyLineSpacing,
        indent: quoteLeftIndent,
      }));
    } else if (tagName === "li") {
      console.log(`[Export] → li: 列表左缩进，不首行缩进`);
      paragraphs.push(new Paragraph({
        children: runs,
        spacing: bodyLineSpacing,
        indent: listLeftIndent,
      }));
    } else {
      // p / div — 正文：首行缩进 2 字符，两端对齐
      paragraphs.push(new Paragraph({
        children: runs,
        spacing: bodyLineSpacing,
        indent: firstLineChars2,
        alignment: AlignmentType.JUSTIFIED,
      }));
    }
  }

  console.log(`[Export] 总计块级匹配: ${matchCount}, 生成段落: ${paragraphs.length}`);
  return paragraphs;
}

// ─── POST ──────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, content, format } = body;

    if (!content && !title) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_PARAMS", message: "缺少文档内容" } },
        { status: 400 }
      );
    }

    if (format !== "docx") {
      return NextResponse.json(
        { success: false, error: { code: "UNSUPPORTED_FORMAT", message: `不支持的导出格式: ${format}` } },
        { status: 400 }
      );
    }

    const children: Paragraph[] = [];

    // 文档主标题（32pt 固定行距、段前段后 0）
    if (title) {
      children.push(new Paragraph({
        children: [new TextRun({ text: title, bold: true, font: "方正小标宋简体", size: 44 })],
        alignment: AlignmentType.CENTER,
        spacing: docTitleLineSpacing,
      }));
    }

    // 正文段落
    const bodyParagraphs = htmlToDocxParagraphs(content || "");
    children.push(...bodyParagraphs);

    const doc = new Document({
      title: title || "公文",
      sections: [{
        properties: {
          page: {
            margin: {
              top: 2098, bottom: 1985, left: 1588, right: 1474,
            },
          },
        },
        children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const uint8 = new Uint8Array(buffer);

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(title || "公文")}.docx"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    console.error("[Export] Error:", error);
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: "导出失败" } },
      { status: 500 }
    );
  }
}
