// ─── 记忆抽取（手动更新）─────────────────────────
// 给定聚合后的用户写作材料（公文/初稿/大纲/知识库/聊天历史），
// 调用 LLM 抽取结构化写作偏好记忆，返回：
//   { personalInfo, languageHabits, writingEnhancements, notes }
// 由调用方决定是否落库（这里只负责「抽」）。

export interface ExtractedMemory {
  personalInfo: string;
  languageHabits: string;
  writingEnhancements: string;
  notes: string;
}

const EXTRACT_SYSTEM = `你是一个公文写作偏好提取器。阅读用户的多篇公文写作材料（公文正文、初稿/大纲、知识库文章、与 AI 的对话历史、金句库佳句），提取该用户的「稳定、可复用」的写作偏好，只关注：
1) 个人信息（单位/部门/职务/常用落款署名/发文机关）；
2) 语言用词习惯（偏好用词、口头禅、禁用词、语气倾向）；
3) 公文写作强化要点（偏好的结构、格式、规范、重点；金句库中的佳句可反映其偏好的表达风格、修辞与论证方式，应据此归纳）；
4) 其他值得记住的写作偏好要点。
只输出确凿从材料中体现出的偏好，不要臆测、不要编造单位或职务。
请以 JSON 返回：
{
  "personalInfo": "单位/部门/职务/署名等；没有则空字符串",
  "languageHabits": "用词习惯、禁用词、语气；没有则空字符串",
  "writingEnhancements": "结构/格式/规范/重点偏好；没有则空字符串",
  "notes": "其他可复用写作偏好要点，合并成一段中文；没有则空字符串"
}`;

export async function extractMemory(params: {
  sourceText: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}): Promise<ExtractedMemory> {
  const { sourceText, apiKey, baseUrl, model } = params;
  const empty: ExtractedMemory = { personalInfo: "", languageHabits: "", writingEnhancements: "", notes: "" };
  if (!sourceText.trim()) return empty;

  const upstreamUrl = `${baseUrl}/chat/completions`;
  let raw = "";
  try {
    const resp = await fetch(upstreamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: EXTRACT_SYSTEM },
          {
            role: "user",
            content:
              "以下是该用户的公文写作材料，请从中提取写作偏好：\n\n" +
              "────── 材料开始 ──────\n" +
              sourceText +
              "\n────── 材料结束 ──────",
          },
        ],
        stream: false,
        temperature: 0.2,
      }),
    });
    if (!resp.ok) return empty;
    const data = await resp.json();
    raw = data?.choices?.[0]?.message?.content ?? "";
  } catch {
    return empty;
  }

  // 解析 JSON（容忍 ```json 围栏）
  let parsed: Partial<ExtractedMemory> = {};
  try {
    let s = raw.trim();
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) s = fence[1].trim();
    parsed = JSON.parse(s);
  } catch {
    // 解析失败则用原文兜底为 notes
    parsed = { notes: raw.trim() };
  }
  return {
    personalInfo: typeof parsed.personalInfo === "string" ? parsed.personalInfo.trim() : "",
    languageHabits: typeof parsed.languageHabits === "string" ? parsed.languageHabits.trim() : "",
    writingEnhancements: typeof parsed.writingEnhancements === "string" ? parsed.writingEnhancements.trim() : "",
    notes: typeof parsed.notes === "string" ? parsed.notes.trim() : "",
  };
}
