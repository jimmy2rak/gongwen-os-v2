// ─── 金句库定位状态（从金句库点击金句 → 跳转到原文档/热点并定位）──
import { create } from "zustand";

interface PendingLocate {
  sourceId: string; // 原文档/文章 id
  content: string; // 金句内容（用于滚动定位）
}

interface QuotationStore {
  pendingLocate: PendingLocate | null;
  setPendingLocate: (p: PendingLocate | null) => void;
  clearPendingLocate: () => void;
}

export const useQuotationStore = create<QuotationStore>((set) => ({
  pendingLocate: null,
  setPendingLocate: (p) => set({ pendingLocate: p }),
  clearPendingLocate: () => set({ pendingLocate: null }),
}));
