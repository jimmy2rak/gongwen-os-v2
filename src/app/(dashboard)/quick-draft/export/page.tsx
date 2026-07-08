// ─── 一键初稿 · 导出 ────────────────────────────
// 复用既有导出能力（ExportMenu：DOCX / Markdown / PDF）+ 导出历史

"use client";

import { useEffect, useState } from "react";
import { FileText, Download, History, Trash2, Clock, X } from "lucide-react";
import { ExportMenu } from "@/components/editor/ExportMenu";
import { getCategoryColor } from "@/types";
import { getExportHistory, clearExportHistory, deleteExportRecord, type ExportRecord } from "@/lib/export-history-store";
import { CustomDialog } from "@/components/ui/CustomDialog";

interface DocItem {
  id: string;
  title: string;
  category: string;
  content: string;
}

export default function ExportPage() {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"export" | "history">("export");
  const [history, setHistory] = useState<ExportRecord[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    fetch("/api/documents?pageSize=50")
      .then((r) => r.json())
      .then((b) => {
        if (b.success) setDocs(b.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    setHistory(getExportHistory());
  }, []);

  const refreshHistory = () => setHistory(getExportHistory());

  const fmtTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const formatLabel = (f: string) => ({ docx: "Word", md: "Markdown", pdf: "PDF" }[f] || f);

  return (
    <div>
      {/* 导航 Tab */}
      <div className="flex items-center gap-4 mb-5 border-b border-gray-200">
        <button onClick={() => setTab("export")}
          className={`pb-2 text-sm font-medium transition-colors border-b-2 ${tab === "export" ? "text-[#163f3a] border-[#163f3a]" : "text-gray-400 border-transparent hover:text-gray-600"}`}>
          <FileText className="w-3.5 h-3.5 inline mr-1" /> 导出文稿
        </button>
        <button onClick={() => setTab("history")}
          className={`pb-2 text-sm font-medium transition-colors border-b-2 ${tab === "history" ? "text-[#163f3a] border-[#163f3a]" : "text-gray-400 border-transparent hover:text-gray-600"}`}>
          <History className="w-3.5 h-3.5 inline mr-1" /> 导出历史（{history.length}）
        </button>
      </div>

      {/* 导出文稿 */}
      {tab === "export" && (
        <>
          <p className="text-xs text-gray-400 mb-5">选择文档，导出为 Word / Markdown / PDF</p>

          {loading ? (
            <p className="text-xs text-gray-400">加载中…</p>
          ) : docs.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <p className="text-xs text-gray-400">暂无文档可导出</p>
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white">
                  <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-gray-800 truncate">{d.title}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: getCategoryColor(d.category) }} />
                      {d.category}
                    </div>
                  </div>
                  <ExportMenu title={d.title} content={d.content || ""} onResult={() => setTimeout(refreshHistory, 500)} />
                </div>
              ))}
            </div>
          )}

          {!loading && docs.length > 0 && (
            <p className="text-[11px] text-gray-400 mt-4 flex items-center gap-1">
              <Download className="w-3 h-3" /> 导出格式遵循 GB/T 9704 公文规范
            </p>
          )}
        </>
      )}

      {/* 导出历史 */}
      {tab === "history" && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-400">共 {history.length} 条导出记录</p>
            {history.length > 0 && (
              <button onClick={() => setConfirmClear(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-red-600 bg-red-50 rounded-lg hover:bg-red-100">
                <Trash2 className="w-3 h-3" /> 清空历史
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <History className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400">暂无导出记录</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {history.map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-colors">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    r.format === "docx" ? "bg-blue-50" : r.format === "md" ? "bg-amber-50" : "bg-red-50"
                  }`}>
                    <FileText className={`w-3.5 h-3.5 ${
                      r.format === "docx" ? "text-blue-500" : r.format === "md" ? "text-amber-500" : "text-red-500"
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-700 truncate">{r.title}</div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                      <span className="px-1 py-0.5 rounded bg-gray-100">{formatLabel(r.format)}</span>
                      <Clock className="w-2.5 h-2.5" />
                      {fmtTime(r.exportedAt)}
                    </div>
                  </div>
                  <button onClick={() => { deleteExportRecord(r.id); refreshHistory(); }}
                    className="p-1 text-gray-300 hover:text-red-500 rounded hover:bg-red-50">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 清空确认弹窗 */}
      <CustomDialog
        open={confirmClear}
        mode="confirm"
        title="清空导出历史"
        message="确定清空所有导出记录？此操作不可恢复。"
        confirmText="确定清空"
        cancelText="取消"
        onConfirm={() => { clearExportHistory(); refreshHistory(); setConfirmClear(false); }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
