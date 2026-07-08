// ─── 公文相关类型定义 ──────────────────────────

/** 公文元信息 */
export interface DocMetaInfo {
  docMode: "gb" | "simple" | "official";
  submitUnit: string;     // 发文机关
  submitDate: string;     // 成文日期
  docNumber: string;      // 发文字号
  drawer: string;         // 抄送
  level: string;          // 紧急程度
  secrecy: string;        // 密级
  redHeader: string;      // 红头名称
  issuingAuthority: string; // 版记第一行（印发机关）
  recipient: string;      // 版记第二行（主送机关）
  printDate: string;      // 印发日期
}

/** 公文分类（11 类） */
export const DOCUMENT_CATEGORIES = [
  "通知",
  "报告",
  "请示",
  "函",
  "纪要",
  "决定",
  "通报",
  "批复",
  "方案",
  "讲话稿",
  "新闻",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** 每个公文类别的颜色标识 */
export const CATEGORY_COLORS: Record<string, string> = {
  "通知": "#2563eb",
  "报告": "#059669",
  "请示": "#d97706",
  "函":   "#7c3aed",
  "纪要": "#0891b2",
  "决定": "#dc2626",
  "通报": "#ca8a04",
  "批复": "#db2777",
  "方案": "#ea580c",
  "讲话稿": "#4f46e5",
  "新闻": "#ef4444",
};

export function getCategoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] || "#6b7280";
}

/**
 * 获取完整公文类型列表（内置 11 类 + 用户自定义类型）。
 * 仅在浏览器端可用（读取 localStorage "gw-custom-categories"）。
 * 服务端调用时只返回内置 11 类。
 */
export function getAllCategories(): string[] {
  if (typeof window === "undefined") return [...DOCUMENT_CATEGORIES];
  try {
    const raw = localStorage.getItem("gw-custom-categories");
    if (!raw) return [...DOCUMENT_CATEGORIES];
    const custom = JSON.parse(raw);
    if (Array.isArray(custom) && custom.length > 0) {
      return [...DOCUMENT_CATEGORIES, ...custom.map((c: any) => c.name || c)];
    }
    return [...DOCUMENT_CATEGORIES];
  } catch {
    return [...DOCUMENT_CATEGORIES];
  }
}
