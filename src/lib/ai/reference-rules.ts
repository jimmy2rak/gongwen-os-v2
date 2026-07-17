// ─── 双资料强制分析逻辑（系统级 · 永久生效） ───────
// 用户给定的「终极完整 Prompt」直接写死在此文件，供一键初稿 / 大纲生成时
// 作为 systemExtra 的一部分强制注入。任何人都无法在界面上关闭该逻辑。
//
// buildReferenceContext() 将【固定规则】+【事件参考资料真实内容】+
// 【语言结构文风参考资料真实内容】+（可选）【知识库】组装成一段文本，
// 注入到生成请求的 systemExtra，确保 AI 真实解析、复用两份资料。

"use client";

import type { ParsedRef } from "@/lib/ai/parse-reference";

/** 系统固化、永久生效的强制分析规则（用户原话直录，请勿随意删改） */
export const REFERENCE_ANALYSIS_RULES = `【系统固定强制规则：永久生效】
你是专业公文写作AI，本次生成公文初稿、公文大纲必须严格遵循双参考资料分析逻辑。

本次页面包含两个独立虚线框上传区域，分别为：
1. 事件参考资料（事实素材区）
2. 语言结构文风参考资料（范文风格区）

=====第一部分：事件参考资料 强制分析逻辑=====
1. 完整读取所有上传文件内容，提取：事件背景、工作事实、时间节点、工作内容、数据成果、问题、上级要求、通知要点、关键信息。
2. 公文写作内容必须完全基于上传资料真实信息，禁止虚构、编造、脑补、通用套话。
3. 多文件合并解析，自动去重、自动筛选有效公文信息，过滤页眉页脚、冗余内容、无效文字。
4. 所有正文事实、工作描述、数据表述，必须溯源上传资料。

=====第二部分：语言结构文风参考资料 强制分析逻辑=====
1. 深度解析所有上传范文的：公文整体结构、段落排布、标题格式、开头句式、结尾话术、官方措辞、排比方式、层级逻辑、行文语气。
2. 严格复刻用户单位专属公文文风、句式习惯、篇章模板。
3. 抛弃AI默认通用文风，完全对齐参考范文风格。
4. 自动统一全文句式、段落长度、官方严谨度、公文格式。

=====第三部分：最终生成强制融合规则=====
1. 公文内容事实 = 完全取自【事件参考资料】
2. 公文结构风格 = 完全取自【文风参考资料】
3. 生成大纲、初稿时必须真实分析、真实复用、真实融合双资料内容。
4. 禁止忽略上传文件、禁止无效读取、禁止模板化空写。
5. 输出内容必须明显体现：参考资料独有内容 + 范文独有结构风格。`;

/** 各区块注入提示词的最大字符数（防止撑爆上下文） */
const MAX_EVENT_CHARS = 9000;
const MAX_STYLE_CHARS = 9000;
const MAX_KNOWLEDGE_CHARS = 4000;

function cap(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "\n…（参考内容过长已截断）" : text;
}

function block(title: string, items: ParsedRef[]): string {
  const valid = items.filter((it) => it.text && !it.error);
  if (valid.length === 0) return "";
  const body = valid.map((it) => `## ${it.name}\n${it.text}`).join("\n\n");
  return `【${title}】\n${body}`;
}

export interface ReferenceContextOptions {
  /** 事件参考资料（事实素材区）解析结果 */
  eventItems: ParsedRef[];
  /** 语言结构文风参考资料（范文风格区）解析结果 */
  styleItems: ParsedRef[];
  /** 可选：用户知识库（已审阅文档）摘要文本 */
  knowledgeText?: string;
}

/**
 * 拉取用户知识库（已审阅文档）摘要文本，作为语料/规范参考注入。
 * 每条文档截断到 700 字、最多 8 条；失败静默返回空串。
 */
export async function fetchKnowledgeContext(): Promise<string> {
  try {
    const res = await fetch("/api/documents?reviewed=true&pageSize=100");
    if (!res.ok) return "";
    const body = await res.json();
    const docs: Array<{ title?: string; content?: string }> = Array.isArray(body.data) ? body.data : [];
    const parts = docs
      .filter((d) => d.content)
      .slice(0, 8)
      .map((d) => `## ${d.title || "未命名"}\n${(d.content || "").slice(0, 700)}`);
    return parts.join("\n\n");
  } catch {
    return "";
  }
}

/**
 * 组装双资料参考上下文。
 * 仅当存在有效参考内容时才返回（含固定规则），否则返回空串（正常生成）。
 */
export function buildReferenceContext(opts: ReferenceContextOptions): string {
  const eventBlock = block("事件参考资料（事实素材区）真实内容", opts.eventItems);
  const styleBlock = block("语言结构文风参考资料（范文风格区）真实内容", opts.styleItems);

  const knowledgeBlock = opts.knowledgeText
    ? `【知识库（用户已审阅文档，供语料与规范参考）】\n${cap(opts.knowledgeText, MAX_KNOWLEDGE_CHARS)}`
    : "";

  const contentParts = [eventBlock, styleBlock, knowledgeBlock].filter(Boolean);
  if (contentParts.length === 0) return "";

  const eventCapped = eventBlock ? cap(eventBlock, MAX_EVENT_CHARS) : "";
  const styleCapped = styleBlock ? cap(styleBlock, MAX_STYLE_CHARS) : "";
  const reassembled = [eventCapped, styleCapped, knowledgeBlock].filter(Boolean).join("\n\n");

  return `${REFERENCE_ANALYSIS_RULES}\n\n${reassembled}`;
}
