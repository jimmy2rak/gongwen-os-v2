// ─── 轻量级缓存 Hook（stale-while-revalidate 模式）──
// 依赖 sessionStorage，页面刷新后缓存失效，避免陈旧数据累积。
// 适合首页仪表盘、热点列表等读多写少、对实时性要求不高的场景。
//
// 用法：
//   const { data, loading } = useCachedFetch<Type>("/api/xxx", { staleTime: 60_000 });
//   data 始终有值（首次加载后），loading 仅首次为 true，后续静默刷新。

"use client";

import { useState, useEffect, useRef } from "react";

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const store = new Map<string, CacheEntry<any>>();

interface UseCachedFetchOptions {
  /** 缓存有效期（毫秒），默认 60 秒 */
  staleTime?: number;
  /** 是否禁用缓存（调试用），默认 false */
  noCache?: boolean;
}

interface UseCachedFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** 手动刷新（跳过缓存） */
  refresh: () => void;
}

export function useCachedFetch<T = any>(
  url: string,
  options: UseCachedFetchOptions = {},
): UseCachedFetchResult<T> {
  const { staleTime = 60_000, noCache = false } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef(0);

  const doFetch = async (skipCache: boolean) => {
    const now = Date.now();
    const cached = store.get(url);

    // 缓存命中且未过期 → 直接使用，不触发 loading
    if (!skipCache && cached && now - cached.fetchedAt < staleTime) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    // 如果有陈旧缓存 → 先展示它，后台静默刷新
    if (!skipCache && cached) {
      setData(cached.data);
      // 不设置 loading=true，保持 UI 不闪烁
    } else {
      setLoading(true);
    }

    const tag = ++ref.current;
    try {
      const res = await fetch(url);
      if (tag !== ref.current) return; // 竞态丢弃
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      const body = await res.json();
      if (tag !== ref.current) return;
      store.set(url, { data: body, fetchedAt: Date.now() });
      setData(body);
      setError(null);
    } catch (e: any) {
      if (tag !== ref.current) return;
      setError(e?.message || "网络错误");
    } finally {
      if (tag === ref.current) setLoading(false);
    }
  };

  useEffect(() => {
    doFetch(noCache);
  }, [url, staleTime, noCache]);

  const refresh = () => doFetch(true);

  return { data, loading, error, refresh };
}
