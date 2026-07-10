// ─── 首页快捷入口目录（静态）────────────────────
// 用户可在此基础上自定义「可见 + 排序」，配置按账号同步。
import { PenSquare, LayoutTemplate, FileText, Sparkles, BookOpen, TrendingUp } from "lucide-react";

export interface QuickEntryDef {
  id: string;
  label: string;
  href: string;
  icon: typeof PenSquare;
  color: string; // 图标主色
  bg: string;    // 底色（浅）
}

// 全部可选入口（顺序即「管理面板」中的默认展示顺序）
export const QUICK_ENTRY_CATALOG: QuickEntryDef[] = [
  { id: "quick-draft", label: "一键出稿", href: "/quick-draft/quick", icon: PenSquare, color: "#163f3a", bg: "#163f3a" },
  { id: "templates", label: "模板管理", href: "/templates", icon: LayoutTemplate, color: "#d97706", bg: "#f59e0b" },
  { id: "documents", label: "全部文档", href: "/documents", icon: FileText, color: "#2563eb", bg: "#3b82f6" },
  { id: "knowledge", label: "知识库", href: "/knowledge", icon: BookOpen, color: "#059669", bg: "#10b981" },
  { id: "hotspots", label: "热点推送", href: "/hotspots", icon: TrendingUp, color: "#0891b2", bg: "#06b6d4" },
  { id: "settings", label: "系统设置", href: "/settings", icon: Sparkles, color: "#7c3aed", bg: "#8b5cf6" },
];

// 默认可见入口（与旧版首页一致）
export const DEFAULT_QUICK_ENTRIES = ["quick-draft", "templates", "documents", "settings"];

// 将存储的 id 数组映射为入口定义（过滤掉已下线的 id）
export function resolveEntries(ids: string[] | null | undefined): QuickEntryDef[] {
  const list = ids && ids.length ? ids : DEFAULT_QUICK_ENTRIES;
  const map = new Map(QUICK_ENTRY_CATALOG.map((e) => [e.id, e]));
  return list
    .map((id) => map.get(id))
    .filter((e): e is QuickEntryDef => Boolean(e));
}
