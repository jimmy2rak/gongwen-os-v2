"use client";

import { useCallback, useEffect, useState } from "react";
import type { Quote } from "./types";

export interface AddQuotePayload {
  content: string;
  sourceType: string;
  sourceId?: string;
  sourceTitle?: string;
  category?: string | string[];
}

/** 把可能存在的单字符串/逗号分隔/数组统一成字符串数组 */
function normalizeCategories(category?: string | string[] | null): string[] {
  if (!category) return [];
  if (Array.isArray(category)) return category.map((c) => c.trim()).filter(Boolean);
  return category.split(/[,，]/).map((c) => c.trim()).filter(Boolean);
}

/** 金句 hook：按 sourceId 拉取（不传则拉全部），支持新增 / 删除 */
export function useQuotations(sourceId?: string) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sourceId) params.set("sourceId", sourceId);
      const r = await fetch(`/api/quotations?${params.toString()}`, { cache: "no-store" });
      const b = await r.json();
      if (b.success) setQuotes(b.data || []);
    } catch {
      /* 忽略网络错误 */
    } finally {
      setLoading(false);
    }
  }, [sourceId]);

  useEffect(() => {
    load();
  }, [load]);

  const addQuote = useCallback(async (payload: AddQuotePayload) => {
    try {
      const r = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const b = await r.json();
      if (b.success) {
        await load();
        return b;
      }
      return b;
    } catch (e) {
      return { success: false, error: { message: "网络错误" } };
    }
  }, [load]);

  const deleteQuote = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/quotations?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const b = await r.json();
      if (b.success) setQuotes((q) => q.filter((x) => x.id !== id));
      return b;
    } catch (e) {
      return { success: false, error: { message: "网络错误" } };
    }
  }, []);

  /** 单条改分类（乐观更新本地状态） */
  const setQuoteCategory = useCallback(async (id: string, categories: string[]) => {
    setQuotes((q) => q.map((x) => (x.id === id ? { ...x, category: categories } : x)));
    try {
      const r = await fetch("/api/quotations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, categories }),
      });
      return await r.json();
    } catch (e) {
      return { success: false, error: { message: "网络错误" } };
    }
  }, []);

  /** 批量保存分类建议（AI 一键分类）：items=[{id, categories: string[]}] */
  const applyCategories = useCallback(async (items: { id: string; categories: string[] }[]) => {
    try {
      const r = await fetch("/api/quotations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items.map((it) => ({ id: it.id, categories: it.categories })) }),
      });
      const b = await r.json();
      if (b.success) {
        const map = new Map(items.map((it) => [it.id, it.categories]));
        setQuotes((q) => q.map((x) => (map.has(x.id) ? { ...x, category: map.get(x.id)! } : x)));
      }
      return b;
    } catch (e) {
      return { success: false, error: { message: "网络错误" } };
    }
  }, []);

  return { quotes, loading, load, addQuote, deleteQuote, setQuoteCategory, applyCategories };
}
