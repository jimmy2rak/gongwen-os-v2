// ─── 预加载数据 Hook（缓存优先 + 后台同步）─────────
// 页面打开时先同步读取本地缓存（秒开），再静默向服务端请求，
// 拿到新数据后更新缓存与状态；增删改后用 save() 写回缓存，页面即时反映。

"use client";

import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { readPreload, writePreload, PreloadEntry } from "@/lib/preload-cache";

export function usePreloadData<T = any>(
  resource: string,
  fetcher: () => Promise<T>,
  options: { enabled?: boolean } = {},
) {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;

  const cached = readPreload<T>(userId, resource);
  const [data, setData] = useState<T | null>(cached ? cached.data : null);
  const [loading, setLoading] = useState<boolean>(!cached);
  const [fromCache, setFromCache] = useState<boolean>(!!cached);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef(0);

  const sync = async (skipCache = false) => {
    if (options.enabled === false) return;
    const tag = ++ref.current;
    try {
      const d = await fetcher();
      if (tag !== ref.current) return;
      writePreload(userId, resource, d);
      setData(d);
      setFromCache(false);
      setError(null);
    } catch (e: any) {
      if (tag !== ref.current) return;
      setError(e?.message || "网络错误");
    } finally {
      if (tag === ref.current) setLoading(false);
    }
  };

  useEffect(() => {
    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, userId, options.enabled]);

  const refresh = () => sync(true);
  const save = (d: T) => {
    writePreload(userId, resource, d);
    setData(d);
    setFromCache(false);
  };

  return { data, loading, fromCache, error, refresh, save };
}
