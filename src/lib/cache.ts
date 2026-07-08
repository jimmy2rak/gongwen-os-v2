// ─── 客户端内存缓存工具 ──────────────────────────
// 供仪表盘、文档、知识库、回收站、模板等读多写少页面使用。
// 默认 staleTime 30 秒，后台静默刷新，不闪烁。

const _cache = new Map<string, { data: any; fetchedAt: number }>();
const DEFAULT_STALE_MS = 30_000;

export function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  staleMs = DEFAULT_STALE_MS,
): Promise<T> {
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < staleMs) {
    return Promise.resolve(hit.data);
  }
  return fetcher().then((d) => {
    _cache.set(key, { data: d, fetchedAt: Date.now() });
    return d;
  });
}

export function invalidateCache(keyOrPrefix: string) {
  for (const key of _cache.keys()) {
    if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
      _cache.delete(key);
    }
  }
}

export function clearCache() {
  _cache.clear();
}
