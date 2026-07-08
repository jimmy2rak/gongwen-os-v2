// ─── AI 模型选择器 Hook ──────────────────────────
// 读取「系统设置 → API 配置」中已启用的模型，记忆上次选择。

"use client";

import { useEffect, useState } from "react";

export interface ModelOption {
  provider: string;
  providerLabel: string;
  model: string;
  value: string; // `${provider}::${model}`
}

const STORAGE_KEY = "gw2-ai-model";

export function useAiModel() {
  const [options, setOptions] = useState<ModelOption[]>([]);
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/api-keys")
      .then((r) => r.json())
      .then((b) => {
        if (!b.success) return;
        const opts: ModelOption[] = [];
        for (const k of b.data) {
          if (!k.isActive) continue;
          for (const m of k.models || []) {
            opts.push({ provider: k.provider, providerLabel: k.label, model: m, value: `${k.provider}::${m}` });
          }
        }
        if (cancelled) return;
        setOptions(opts);
        if (opts.length === 0) {
          setLoading(false);
          return;
        }
        const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        const savedOpt = opts.find((o) => o.value === saved);
        if (savedOpt) {
          setModel(savedOpt.value);
        } else {
          const def = opts.find((o) => (b.data.find((k: any) => k.provider === o.provider)?.defaultModel) === o.model);
          setModel(def ? def.value : opts[0].value);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectModel = (value: string) => {
    setModel(value);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, value);
  };

  return { options, model, setModel: selectModel, loading };
}
