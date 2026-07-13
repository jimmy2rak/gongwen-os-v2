// ─── AI 用户记忆（按账号持久化）────────────────────
// 读取用户记忆、格式化为系统提示词片段、以及生成后自动从对话中
// 提取写作偏好并回写到 user_memory.auto_notes（系统自动学习笔记）。
import { client } from "@/server/db";
import { nanoid } from "nanoid";

export type UserMemory = {
  personalInfo: string;
  languageHabits: string;
  writingEnhancements: string;
  autoNotes: string;
};

const EMPTY: UserMemory = {
  personalInfo: "",
  languageHabits: "",
  writingEnhancements: "",
  autoNotes: "",
};

// 读取用户记忆（按 user_id）
export async function getUserMemory(userId: string): Promise<UserMemory> {
  const rows = await client.execute({
    sql: `SELECT personal_info, language_habits, writing_enhancements, auto_notes
          FROM user_memory WHERE user_id = ?`,
    args: [userId],
  });
  const row = rows.rows[0];
  if (!row) return { ...EMPTY };
  return {
    personalInfo: (row.personal_info as string) ?? "",
    languageHabits: (row.language_habits as string) ?? "",
    writingEnhancements: (row.writing_enhancements as string) ?? "",
    autoNotes: (row.auto_notes as string) ?? "",
  };
}

// 将记忆格式化为系统提示词片段（空则空串）
export function buildUserMemoryPrompt(memory: UserMemory): string {
  const parts: string[] = [];
  if (memory.personalInfo.trim()) {
    parts.push(`【用户个人信息】\n${memory.personalInfo.trim()}`);
  }
  if (memory.languageHabits.trim()) {
    parts.push(`【用户语言用词习惯】\n${memory.languageHabits.trim()}`);
  }
  if (memory.writingEnhancements.trim()) {
    parts.push(`【用户公文写作强化要点】\n${memory.writingEnhancements.trim()}`);
  }
  if (memory.autoNotes.trim()) {
    parts.push(`【系统自动学习到的用户偏好（来自历史写作）】\n${memory.autoNotes.trim()}`);
  }
  if (parts.length === 0) return "";
  return (
    "\n\n────────── 用户记忆（请结合以下信息写作，保持用户一贯的语言风格与习惯） ──────────\n" +
    parts.join("\n\n")
  );
}

// 从本轮对话提取用户写作偏好（不阻塞主响应，后台异步执行）
// 仅更新 auto_notes 字段，不覆盖用户手动维护的三段记忆。
export async function captureUserMemory(params: {
  userId: string;
  messages: { role: string; content: string }[];
  apiKey: string;
  baseUrl: string;
  model: string;
}): Promise<void> {
  const { userId, messages, apiKey, baseUrl, model } = params;
  // 跳过过短的最后一条用户消息，减少无意义调用
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser || lastUser.content.trim().length < 5) return;

  const extractSystem =
    "你是一个公文写作偏好提取器。阅读用户与 AI 的公文写作对话，提取用户的「稳定、可复用」的写作偏好，" +
    "只关注：1) 个人信息（单位/部门/职务/常用落款署名）；2) 语言用词习惯（偏好用词、口头禅、禁用词、语气）；" +
    "3) 公文写作强化要点（偏好的结构、格式、规范、重点）。\n" +
    "只输出确凿从本轮对话中体现出的偏好；不要臆测。\n" +
    '请以 JSON 返回：{"notes": "合并成一段中文要点，简洁可复用；没有可提取的偏好则输出空字符串"}';

  const upstreamUrl = `${baseUrl}/chat/completions`;
  let raw = "";
  try {
    const resp = await fetch(upstreamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: extractSystem },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        stream: false,
        temperature: 0.2,
      }),
    });
    if (!resp.ok) return;
    const data = await resp.json();
    raw = data?.choices?.[0]?.message?.content ?? "";
  } catch {
    return;
  }

  // 解析 JSON（容忍 ```json 围栏）
  let notes = "";
  try {
    let s = raw.trim();
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) s = fence[1].trim();
    const obj = JSON.parse(s);
    notes = typeof obj?.notes === "string" ? obj.notes.trim() : "";
  } catch {
    notes = raw.trim();
  }
  if (!notes) return;

  // 合并到已有 auto_notes（追加，去重前缀，控制长度）
  const existing = await getUserMemory(userId);
  let combined = existing.autoNotes.trim();
  if (combined) {
    if (!combined.includes(notes)) combined = `${combined}\n${notes}`;
  } else {
    combined = notes;
  }
  if (combined.length > 2000) combined = combined.slice(combined.length - 2000);

  const now = Math.floor(Date.now() / 1000);
  try {
    await client.execute({
      sql: `INSERT INTO user_memory (id, user_id, personal_info, language_habits, writing_enhancements, auto_notes, updated_at)
            VALUES (?, ?, '', '', '', ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET auto_notes = excluded.auto_notes, updated_at = excluded.updated_at`,
      args: [`um${nanoid(12)}`, userId, combined, now],
    });
  } catch (e) {
    console.error("[captureUserMemory] upsert error:", e);
  }
}
