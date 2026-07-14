// ─── 登录预加载持久缓存 ─────────────────────────
// 用户登录后，在后台把「需要联动数据库的内容」一次性拉取并写入 localStorage（按 userId:resource 隔离）。
// 各页面打开时先读缓存秒开，再静默向服务端同步；增删改后更新/失效缓存，实时反映到页面。
// 敏感或管理员相关（用户权限、爬虫设置等）不在此列，保留原有当场加载。

"use client";

const PREFIX = "gw:preload:";

export interface PreloadEntry<T = any> {
  data: T;
  fetchedAt: number;
}

function userKey(userId: string, resource: string): string {
  return `${PREFIX}${userId}:${resource}`;
}

/** 同步读取缓存条目（不触发请求），页面首屏秒开用 */
export function readPreload<T = any>(userId: string | undefined, resource: string): PreloadEntry<T> | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(userKey(userId, resource));
    return raw ? (JSON.parse(raw) as PreloadEntry<T>) : null;
  } catch {
    return null;
  }
}

/** 读取缓存中的数据（无则 null） */
export function getCachedData<T = any>(userId: string | undefined, resource: string): T | null {
  const e = readPreload<T>(userId, resource);
  return e ? e.data : null;
}

/** 写入缓存 */
export function writePreload<T = any>(userId: string | undefined, resource: string, data: T): void {
  if (!userId || typeof window === "undefined") return;
  try {
    localStorage.setItem(userKey(userId, resource), JSON.stringify({ data, fetchedAt: Date.now() }));
  } catch {
    // 忽略配额溢出
  }
}

/** 失效某个资源缓存 */
export function invalidatePreload(userId: string | undefined, resource: string): void {
  if (!userId || typeof window === "undefined") return;
  try { localStorage.removeItem(userKey(userId, resource)); } catch {}
}

/** 清空某账号的全部预加载缓存（如退出登录时） */
export function clearUserPreload(userId: string | undefined): void {
  if (!userId || typeof window === "undefined") return;
  try {
    const prefix = `${PREFIX}${userId}:`;
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

// ─── 预加载任务清单（资源名 → URL）────────────────
export interface PreloadTask {
  resource: string;
  url: string;
}

export const PRELOAD_TASKS: PreloadTask[] = [
  // 资源名必须与各页面读取的缓存键一致（默认视图：空搜索/空分类），方可「登录即预加载、打开秒开」
  { resource: "documents::", url: "/api/documents?pageSize=100" },
  { resource: "knowledge::", url: "/api/documents?reviewed=true&pageSize=100" },
  { resource: "trash::", url: "/api/documents?deleted=true&pageSize=100" },
  { resource: "hotspots", url: "/api/hot-articles" },
  { resource: "reviewers", url: "/api/reviewers" },
  { resource: "templates", url: "/api/templates" },
  { resource: "skills", url: "/api/skills" },
  { resource: "profiles", url: "/api/profiles" },
];

/** 预加载单个资源（失败静默） */
export async function preloadResource(userId: string, task: PreloadTask): Promise<void> {
  try {
    const res = await fetch(task.url, { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    writePreload(userId, task.resource, data);
  } catch {
    // 后台静默失败，下次进入页面会重新同步
  }
}

/** 登录后后台并发预加载全部资源 */
export async function preloadAll(userId: string): Promise<void> {
  if (!userId) return;
  await Promise.allSettled(PRELOAD_TASKS.map((t) => preloadResource(userId, t)));
}
