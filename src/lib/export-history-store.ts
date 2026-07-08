// ─── 导出历史 store ──────────────────────────────
// localStorage 记录每次导出的时间/文档/格式
// key: "gw-export-history"

"use client";

export interface ExportRecord {
  id: string;
  docId: string | null;
  title: string;
  format: "docx" | "md" | "pdf";
  exportedAt: number; // timestamp
}

const STORAGE_KEY = "gw-export-history";
const MAX_RECORDS = 100;

function uid() { return "ex" + Math.random().toString(36).slice(2, 10); }

function load(): ExportRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function save(records: ExportRecord[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS))); } catch {}
}

/** 获取导出历史（按时间倒序） */
export function getExportHistory(): ExportRecord[] {
  return load().sort((a, b) => b.exportedAt - a.exportedAt);
}

/** 记录一次导出 */
export function addExportRecord(record: Omit<ExportRecord, "id" | "exportedAt">): ExportRecord {
  const r: ExportRecord = { ...record, id: uid(), exportedAt: Date.now() };
  const records = load();
  records.unshift(r);
  save(records);
  return r;
}

/** 清空导出历史 */
export function clearExportHistory() {
  save([]);
}

/** 删除单条记录 */
export function deleteExportRecord(id: string) {
  save(load().filter((r) => r.id !== id));
}
