// ─── 全局写作 Skill 本地存储（localStorage JSON） ─
// 与现有 skills 表(DocSkill) 并存：两套独立，互不引用。
// 生成/对话时与 DocSkill 合并注入 prompt（见 ai/context.ts）。

"use client";

export interface GlobalSkill {
  id: string;
  name: string;
  category: string; // 通用 / 通知 / 报告 ... 或自定义
  content: string; // 作为 AI system prompt 的规范文本
}

const KEY = "gw-global-skills";

function read(): GlobalSkill[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(list: GlobalSkill[]): GlobalSkill[] {
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(list));
  }
  return list;
}

export function getGlobalSkills(): GlobalSkill[] {
  return read();
}

/** 新增或更新 Skill（按 id 幂等） */
export function saveGlobalSkill(s: GlobalSkill): GlobalSkill[] {
  const list = read();
  const idx = list.findIndex((x) => x.id === s.id);
  if (idx >= 0) list[idx] = { ...s };
  else list.push({ ...s });
  return write(list);
}

export function deleteGlobalSkill(id: string): GlobalSkill[] {
  return write(read().filter((x) => x.id !== id));
}
