// ─── API 客户端 — 全局 fetch 封装 ──────────────
// 自动处理 401 无感刷新 Token，避免直接跳登录页

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
      return res.ok;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

/** 全局 fetch 封装，自动 401 刷新 + 重试 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    credentials: "include",
  });

  if (res.status !== 401) return res;

  // 尝试刷新 Token
  const refreshed = await tryRefreshToken();
  if (!refreshed) {
    window.dispatchEvent(new CustomEvent("auth:session-expired"));
    return res;
  }

  // 刷新成功 → 重试原请求
  return fetch(url, { ...options, credentials: "include" });
}
