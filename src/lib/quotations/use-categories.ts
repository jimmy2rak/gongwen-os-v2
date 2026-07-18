"use client";

import { useCallback, useEffect, useState } from "react";

export interface QuoteCategory {
  id: string;
  name: string;
  color: string;
  count: number;
  createdAt: number;
}

/** 金句自定义分类 hook：拉取 / 新建 / 删除（按账号隔离） */
export function useQuoteCategories() {
  const [categories, setCategories] = useState<QuoteCategory[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/quotations/categories", { cache: "no-store" });
      const b = await r.json();
      if (b.success) setCategories(b.data || []);
    } catch {
      /* 忽略网络错误 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addCategory = useCallback(async (name: string, color = "") => {
    try {
      const r = await fetch("/api/quotations/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });
      const b = await r.json();
      if (b.success) await load();
      return b;
    } catch (e) {
      return { success: false, error: { message: "网络错误" } };
    }
  }, [load]);

  const deleteCategory = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/quotations/categories?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const b = await r.json();
      if (b.success) setCategories((c) => c.filter((x) => x.id !== id));
      return b;
    } catch (e) {
      return { success: false, error: { message: "网络错误" } };
    }
  }, []);

  return { categories, loading, load, addCategory, deleteCategory };
}

// 分类小标签配色（无自定义 color 时按名称哈希取色，保证同名同色）
const TAG_PALETTE = [
  "#0e7490", "#b45309", "#7c3aed", "#be185d", "#15803d",
  "#c2410c", "#1d4ed8", "#9333ea", "#0f766e", "#a16207",
];

export function categoryColor(name: string, custom?: string): string {
  if (custom) return custom;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}
