// ─── 文档收藏/星标 store ─────────────────────────
// localStorage 存储收藏的文档 ID
// key: "gw-favorites"

"use client";

const STORAGE_KEY = "gw-favorites";

function loadIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveIds(ids: string[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch {}
}

/** 获取所有收藏的文档 ID */
export function getFavoriteIds(): string[] {
  return loadIds();
}

/** 判断某文档是否已收藏 */
export function isFavorite(id: string): boolean {
  return loadIds().includes(id);
}

/** 切换收藏状态：返回新的收藏状态 */
export function toggleFavorite(id: string): boolean {
  const ids = loadIds();
  const idx = ids.indexOf(id);
  if (idx >= 0) {
    ids.splice(idx, 1);
    saveIds(ids);
    return false;
  } else {
    ids.unshift(id); // 新收藏的放最前面
    saveIds(ids);
    return true;
  }
}

/** 批量设置收藏（用于初始化） */
export function setFavorites(ids: string[]) {
  saveIds([...new Set(ids)]);
}
