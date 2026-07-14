// ─── 用户画像存储 ───────────────────────────────
// 现在画像以「按账号隔离的数据库记录」为真相来源（见 /api/profiles）。
// 本模块负责：
//   1) getProfiles() —— 供 AI 等同步场景读取「当前账号」的画像（优先读预加载缓存，回退旧 localStorage）。
//   2) 一次性迁移 —— 把旧版全局 localStorage(gw-profiles) 推送到服务端（按账号入库），随后清除旧键。
// 写操作（增删改）统一走 /api/profiles（见 ProfilePanel），不再写 localStorage。

"use client";

import { readPreload } from "@/lib/preload-cache";
import { useAuthStore } from "@/stores/auth.store";

export interface Profile {
  id: string;
  name: string;
  unit: string;
  level: string; // 省级/市级/区级/乡镇级
  type: string; // 机关/事业单位/国企/民企/学校/医院/银行/律所/基层单位/其他
  isDefault?: boolean;
}

const LEGACY_KEY = "gw-profiles";

function currentUserId(): string | undefined {
  try { return useAuthStore.getState().user?.id; } catch { return undefined; }
}

/** 读取当前账号的画像列表（供 AI 同步使用） */
export function getProfiles(): Profile[] {
  const userId = currentUserId();
  // 优先：预加载缓存中的服务端数据（按账号隔离）
  const entry = readPreload<{ success: boolean; data?: any[] }>(userId, "profiles");
  if (entry?.data?.data && Array.isArray(entry.data.data)) {
    return entry.data.data.map((p: any) => ({
      id: String(p.id),
      name: String(p.name || ""),
      unit: String(p.unit || ""),
      level: String(p.level || ""),
      type: String(p.type || ""),
      isDefault: !!p.isDefault,
    }));
  }
  // 回退：旧版全局 localStorage
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
  }
  return [];
}

export function getDefaultProfile(): Profile | null {
  const list = getProfiles();
  return list.find((p) => p.isDefault) || list[0] || null;
}

/**
 * 一次性迁移：把旧版全局 localStorage 画像推送到服务端（按当前账号入库）。
 * 仅当旧键存在且服务端该账号尚无画像时执行；成功后清除旧键。幂等。
 */
export async function migrateLocalProfilesToServer(): Promise<void> {
  if (typeof window === "undefined") return;
  let legacy: Profile[] = [];
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) { localStorage.removeItem(LEGACY_KEY); return; }
    legacy = arr;
  } catch { return; }

  const userId = currentUserId();
  if (!userId) return;

  try {
    // 若服务端已有画像，则直接清除旧键，避免重复
    const check = await fetch("/api/profiles", { credentials: "include" });
    const body = await check.json();
    if (body.success && Array.isArray(body.data) && body.data.length > 0) {
      localStorage.removeItem(LEGACY_KEY);
      return;
    }
    // 逐条推送
    for (const p of legacy) {
      await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: p.name, unit: p.unit, level: p.level, type: p.type, isDefault: !!p.isDefault }),
      });
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // 迁移失败不影响使用，下次登录重试
  }
}
