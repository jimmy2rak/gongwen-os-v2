// ─── 全局 AI 上下文（画像 + 全局 Skill + 分类 Skill） ─
// 客户端组合：默认画像 + 全局写作 Skill + 公文分类 Skill，供所有 AI 调用注入 system prompt。
// 注意：仅在浏览器(localStorage + fetch)可用，服务端不调用本文件。

"use client";

import { getDefaultProfile } from "@/lib/profile-store";
import { getGlobalSkills } from "@/lib/global-skill-store";

/**
 * 生成拼接到 system prompt 的全局上下文文本。
 * 无画像/无 Skill 时返回空串（调用方据此决定是否传递）。
 */
export function buildGlobalContext(): string {
  const parts: string[] = [];

  const profile = getDefaultProfile();
  if (profile) {
    const lines = [
      `姓名：${profile.name || "（未填）"}`,
      `单位：${profile.unit || "（未填）"}`,
      `级别：${profile.level || "（未填）"}`,
      `类型：${profile.type || "（未填）"}`,
    ];
    parts.push(`【当前用户画像（用于贴合发文机关身份与口吻）】\n${lines.join("\n")}`);
  }

  const skills = getGlobalSkills();
  if (skills.length > 0) {
    const list = skills
      .map((s) => `- ${s.name}${s.category ? `（${s.category}）` : ""}：${s.content}`)
      .join("\n");
    parts.push(`【全局写作规范(Skill)，请一并遵循】\n${list}`);
  }

  return parts.join("\n\n");
}

/**
 * 获取指定公文分类的 DB Skill 列表（异步 fetch /api/skills）。
 * 返回格式化的 prompt 文本段，可直接追加到 systemExtra。
 */
export async function buildCategoryContext(category: string): Promise<string> {
  try {
    const res = await fetch(`/api/skills?category=${encodeURIComponent(category)}`);
    if (!res.ok) return "";
    const body = await res.json();
    if (!body.success || !Array.isArray(body.data)) return "";

    const skills: Array<{ name: string; content: string; isBuiltin: boolean }> = body.data;
    if (skills.length === 0) return "";

    const lines = skills.map((s) => `- ${s.name}（${s.isBuiltin ? "内置规范" : "自定义"}）：${s.content}`).join("\n");
    return `【${category}类公文写作规范(Skill)，请严格遵循】\n${lines}`;
  } catch {
    return "";
  }
}

/**
 * 合并全局上下文与分类上下文（便捷方法）。
 */
export async function buildFullContext(category?: string): Promise<string> {
  const global = buildGlobalContext();
  const catCtx = category ? await buildCategoryContext(category) : "";
  return [global, catCtx].filter(Boolean).join("\n\n");
}
