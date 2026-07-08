// ─── 公文模板 → 编辑器初稿 HTML ─────────────────
// 解析模板 content（GovDocTemplateContent JSON），
// 生成符合 TipTap 编辑器格式的初稿 HTML（题 + 章节占位）。

import type { BuiltinTemplate, GovDocTemplateContent } from "@/lib/builtin-templates";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface TemplateSeed {
  id: string;
  name: string;
  category?: string;
  type: "builtin" | "custom";
  content: string; // JSON string of GovDocTemplateContent
}

export interface NewDocSeed {
  title: string;
  category: string;
  content: string;
}

/**
 * 把公文模板转换为编辑器初稿 HTML。
 * - titlePattern 中 {topic} 替换为模板名或用户提供的主题
 * - sections 生成 <h2> 占位段落
 * - structureHint 作为灰色提示文本
 */
export function buildDocFromTemplate(tpl: TemplateSeed, topic?: string): NewDocSeed {
  let parsed: GovDocTemplateContent | null = null;
  try {
    const raw = JSON.parse(tpl.content);
    if (raw && typeof raw === "object" && Array.isArray(raw.sections)) {
      parsed = raw as GovDocTemplateContent;
    }
  } catch { /* fall through */ }

  // 无效/旧格式：降级为空白初稿
  if (!parsed) {
    return {
      title: tpl.name || "新建公文",
      category: tpl.category || "通知",
      content:
        `<div data-type="doc-title">${esc(tpl.name || "新建公文")}</div>` +
        `<p>请在此输入正文内容...</p>`,
    };
  }

  // 标题：替换 {topic}
  const displayTopic = topic?.trim() || tpl.name || "";
  const title = parsed.titlePattern.replace(/\{topic\}/g, displayTopic);

  // 构建正文 HTML
  const parts: string[] = [];

  // 题头
  parts.push(`<div data-type="doc-title">${esc(title)}</div>`);

  // 章节占位
  for (let i = 0; i < parsed.sections.length; i++) {
    const section = parsed.sections[i];
    // 跳过「标题」章节（已用 doc-title 渲染）
    if (section === "标题") continue;

    // 该章节的默认示例内容
    const sample = parsed.sectionSamples?.[i]?.trim() || "";
    const hasSample = sample.length > 0;

    // 常见章节名映射为语义化标签
    if (/发文机关|署名/.test(section)) {
      parts.push(hasSample
        ? `<p class="doc-signature">${esc(sample)}</p>`
        : `<p class="doc-signature"><br></p>`
      );
    } else if (/(成文日期|日期)/.test(section)) {
      parts.push(hasSample
        ? `<p class="doc-date">${esc(sample)}</p>`
        : `<p class="doc-date"><br></p>`
      );
    } else if (/主送机关|称谓|称呼/.test(section)) {
      parts.push(hasSample
        ? `<p>${esc(sample)}</p>`
        : `<p><br></p>`
      );
    } else if (/结语|结尾|结束语/.test(section)) {
      parts.push(hasSample
        ? `<p>${esc(sample)}</p>`
        : `<p><br></p>`
      );
    } else {
      // 一般章节 → h2 + 段落（有示例内容则填入）
      if (hasSample) {
        // 示例内容里的换行转为 <br>，保留段落结构
        const paragraphs = sample.split(/\n{2,}/).filter(Boolean);
        const bodyHtml = paragraphs
          .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
          .join("\n");
        parts.push(
          `<h2>${esc(section)}</h2>\n` +
          bodyHtml
        );
      } else {
        parts.push(
          `<h2>${esc(section)}</h2>\n` +
          `<p><br></p>`
        );
      }
    }
  }


  return {
    title,
    category: tpl.category || "通知",
    content: parts.join("\n"),
  };
}
