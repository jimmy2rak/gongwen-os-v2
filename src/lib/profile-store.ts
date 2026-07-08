// ─── 用户画像本地存储（localStorage JSON） ─────────
// 后期上 Supabase 时可直接以 JSON 文本入库，无需改调用方。
// 与现有 skills 表(DocSkill) 互不干扰，画像独立存储。

"use client";

export interface Profile {
  id: string;
  name: string;
  unit: string;
  level: string; // 省级/市级/区级/乡镇级
  type: string; // 机关/事业单位/国企/民企/学校/医院/银行/律所/基层单位/其他
  isDefault?: boolean;
}

const KEY = "gw-profiles";

function read(): Profile[] {
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

function write(list: Profile[]): Profile[] {
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(list));
  }
  return list;
}

export function getProfiles(): Profile[] {
  return read();
}

export function getDefaultProfile(): Profile | null {
  const list = read();
  return list.find((p) => p.isDefault) || list[0] || null;
}

/** 新增或更新画像（按 id 幂等）；保存时保证仅一个默认 */
export function saveProfile(p: Profile): Profile[] {
  const list = read();
  const idx = list.findIndex((x) => x.id === p.id);
  const next: Profile = { ...p };
  if (next.isDefault) {
    list.forEach((x) => (x.isDefault = false));
    next.isDefault = true;
  }
  if (idx >= 0) {
    list[idx] = next;
  } else {
    list.push(next);
    // 第一条自动设为默认
    if (list.length === 1 && next.isDefault === undefined) next.isDefault = true;
  }
  return write(list);
}

export function deleteProfile(id: string): Profile[] {
  let list = read().filter((x) => x.id !== id);
  // 若删掉的是默认且无其他默认，把第一条设为默认
  if (!list.some((x) => x.isDefault) && list.length > 0) list[0].isDefault = true;
  return write(list);
}

export function setDefaultProfile(id: string): Profile[] {
  const list = read().map((x) => ({ ...x, isDefault: x.id === id }));
  return write(list);
}
