// 金句数据模型（与 /api/quotations 返回一致）
export interface Quote {
  id: string;
  content: string;
  sourceType: string; // document | knowledge | hotspot | editor | manual
  sourceId: string;
  sourceTitle: string;
  category: string;
  createdAt: number;
  updatedAt: number;
}

export type QuoteSourceType = "document" | "knowledge" | "hotspot" | "editor" | "manual";
