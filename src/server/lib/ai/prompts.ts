// ─── 公文 AI 系统提示词 ──────────────────────────
// 约束大模型按 GB/T 9704-2012 公文规范写作，避免编造公文要素。

export const GOV_DOC_SYSTEM_PROMPT = `你是一名资深的中文党政机关公文写作助理，严格遵循《党政机关公文格式》(GB/T 9704-2012) 与《公文写作规范》。

写作与润色要求：
1. 语言规范、庄重、精练，使用书面语，避免口语化、网络用语与主观抒情。
2. 结构严谨，层次分明：使用"一、""（一）""1.""（1）"层级递进；一级标题用黑体，二级标题用楷体，三级及以下用仿宋。
3. 不得编造公文要素：严禁虚构文号、发文机关标志（红头）、签发人、成文日期、秘密等级、紧急程度、印章文字等具体信息；如确需占位，使用"××"代替并说明。
4. 如用户要求续写/扩写，须承接上文语气与主题，保持连贯；如要求缩写/润色，不得改变原意与关键事实。
5. 默认输出纯正文内容，不加多余解释与 Markdown 代码块包裹（除非用户要求分析）。
6. 涉及法律、政策引用时，尽量准确；不确定时提示用户核实，不臆造条款。

你仅输出公文正文或用户明确要求的处理结果，不输出与公文无关的闲聊。`;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** 构造完整消息列表：在用户消息前注入系统提示词 */
export function buildMessages(userMessages: ChatMessage[]): ChatMessage[] {
  return [{ role: "system", content: GOV_DOC_SYSTEM_PROMPT }, ...userMessages];
}

/** 构造系统提示词：可在公文规范基础上追加全局上下文（画像 + 全局 Skill） */
export function buildSystemPrompt(extra?: string): string {
  const tail = extra && extra.trim() ? `\n\n${extra.trim()}` : "";
  return `${GOV_DOC_SYSTEM_PROMPT}${tail}`;
}

/** 选中文字快捷指令模板（返回一段自然语言指令，拼上选中文本） */
export function buildSelectionInstruction(
  action: "continue" | "polish" | "shorten" | "expand" | "explain" | "translate" | "custom",
  selectedText: string,
  customPrompt?: string
): string {
  const text = selectedText.trim();
  const wrapped = `"""\n${text}\n"""`;
  switch (action) {
    case "continue":
      return `请基于以下公文片段继续续写，承接其语气与主题，输出续写的正文内容：\n${wrapped}`;
    case "polish":
      return `请对以下公文片段进行润色，提升语言规范性与公文体感，保持原意与关键事实不变，只输出润色后的内容：\n${wrapped}`;
    case "shorten":
      return `请将以下公文片段缩写，删减冗余、保留核心信息与原意，只输出缩写后的内容：\n${wrapped}`;
    case "expand":
      return `请将以下公文片段扩写，补充必要细节与论述，保持公文语体与主题一致，只输出扩写后的内容：\n${wrapped}`;
    case "explain":
      return `请解释以下公文片段的要点、背景与写作意图，用简洁的中文说明：\n${wrapped}`;
    case "translate":
      return `请将以下公文片段翻译成英文，保持公文正式语体：\n${wrapped}`;
    case "custom":
      return `${customPrompt || "请处理以下公文片段"}：\n${wrapped}`;
    default:
      return wrapped;
  }
}

/** 未选中任何文字时，默认对「整篇公文」提要求：把全文作为上下文交给模型 */
export function buildDocumentInstruction(userPrompt: string, docText: string): string {
  const text = (docText || "").trim();
  if (!text) {
    return userPrompt || "请帮我处理这篇公文。";
  }
  return `请基于下面这篇完整的公文进行处理，你的操作（续写 / 润色 / 修改 / 分析等）应作用于整篇全文：\n用户要求：${userPrompt || "请帮我处理这篇公文"}\n\n────── 全文内容 ──────\n"""\n${text}\n"""`;
}
