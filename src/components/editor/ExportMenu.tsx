// ─── 公文导出菜单 ──────────────────────────────
// 可复用的导出下拉菜单，统一所有下载/导出入口
// 支持三种格式：Word(.docx)、Markdown(.md)、PDF
// 加载状态和结果提示通过回调返回

"use client";

import { useState, useRef, useEffect } from "react";
import { Download, ChevronDown, FileText, FileCode, File, Loader2, CheckCircle, XCircle } from "lucide-react";
import { addExportRecord } from "@/lib/export-history-store";

export type ExportFormat = "docx" | "md" | "pdf";

interface ExportMenuProps {
  title: string;
  content: string;
  /** 按钮样式类名 */
  className?: string;
  /** 按钮大小：sm | md */
  size?: "sm" | "md";
  /** 成功/失败回调 */
  onResult?: (success: boolean, format: ExportFormat, message?: string) => void;
}

export function ExportMenu({ title, content, className = "", size = "md", onResult }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [includeReviews, setIncludeReviews] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const exportFile = async (format: ExportFormat) => {
    setOpen(false);
    setExporting(format);

    // 提取文档 ID（用于导出历史记录）
    const pathMatch = window.location.pathname.match(/\/documents\/([^/]+)/);
    const docId = pathMatch?.[1] || null;

    // 如果勾选了包含审阅痕迹，则获取文档审阅记录
    let reviewSuffix = "";
    if (includeReviews) {
      try {
        // 尝试从 URL 路径获取当前文档 ID
        if (docId) {
          // 从 reviews API 获取审阅记录
          const revRes = await fetch(`/api/reviews?documentId=${docId}`);
          if (revRes.ok) {
            const revBody = await revRes.json();
            if (revBody.success && Array.isArray(revBody.data) && revBody.data.length > 0) {
              const reviewLines = revBody.data.map((r: any) =>
                `[${r.status === "approved" ? "已通过" : "需修改"}] ${r.reviewer_name || "审阅人"}：${r.comment || "（无意见）"}`
              );
              reviewSuffix = `\n\n---\n【审阅痕迹】\n${reviewLines.join("\n")}`;
            } else {
              reviewSuffix = "\n\n---\n【审阅痕迹】\n（无审阅记录）";
            }
          } else {
            reviewSuffix = "\n\n---\n【审阅痕迹】\n（无法获取审阅记录）";
          }
        }
      } catch {
        reviewSuffix = "\n\n---\n【审阅痕迹】\n（获取失败）";
      }
    }

    try {
      if (format === "md") {
        const md = `# ${title}\n\n${content.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ")}${reviewSuffix}`;
        const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
        downloadBlob(blob, `${title}.md`);
        showToast("success", "Markdown 导出成功");
        addExportRecord({ docId, title, format });
        onResult?.(true, format);
      } else if (format === "pdf") {
        const printWin = window.open("", "_blank");
        if (!printWin) throw new Error("无法打开打印窗口");
        printWin.document.write(`
          <html><head><meta charset="utf-8"><title>${title}</title>
          <style>
            @page { size: A4; margin: 3.4cm 2.5cm 3.5cm 2.6cm; }
            body { font-family:'仿宋_GB2312','仿宋','FangSong',serif;font-size:16pt;line-height:28pt; }
            .doc-title { font-family:'方正小标宋简体',serif;font-size:22pt;text-align:center;font-weight:bold; }
            h1 { font-family:'黑体',serif;font-size:16pt;font-weight:bold; }
            h2 { font-family:'楷体',serif;font-size:16pt; }
            h3 { font-family:'仿宋_GB2312','仿宋','FangSong',serif;font-size:16pt; }
            p { text-indent:2em;margin:0; }
            .review-section { margin-top:20px; padding-top:10px; border-top:1px solid #ccc; font-size:12pt; color:#666; }
          </style></head><body>${content}${reviewSuffix ? `<div class="review-section">${reviewSuffix.replace(/\n/g, "<br>")}</div>` : ""}</body></html>
        `);
        printWin.document.close();
        setTimeout(() => { printWin.print(); }, 500);
        showToast("success", "PDF 打印窗口已打开");
        addExportRecord({ docId, title, format });
        onResult?.(true, format);
      } else {
        // DOCX — 调用统一导出 API
        const res = await fetch("/api/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content, format: "docx" }),
        });
        if (!res.ok) throw new Error("导出接口返回错误");
        const blob = await res.blob();
        downloadBlob(blob, `${title}.docx`);
        showToast("success", "Word 导出成功");
        addExportRecord({ docId, title, format });
        onResult?.(true, format);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "导出失败";
      showToast("error", msg);
      onResult?.(false, format, msg);
    } finally {
      setExporting(null);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const isSm = size === "sm";

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={!!exporting}
        className={`flex items-center gap-1 rounded-lg transition-colors ${
          isSm
            ? "p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50"
            : "px-3 py-1.5 text-xs bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
        } ${className}`}
        title="导出"
      >
        {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className={isSm ? "w-3.5 h-3.5" : "w-3.5 h-3.5"} />}
        {!isSm && " 导出 "}
        {!isSm && <ChevronDown className="w-3 h-3" />}
      </button>

      {open && (
        <div className={`absolute ${isSm ? "left-0" : "right-0"} top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50`}>
          <button onClick={() => exportFile("docx")} className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" /> Word (.docx)
          </button>
          <button onClick={() => exportFile("md")} className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2">
            <FileCode className="w-4 h-4 text-amber-500" /> Markdown (.md)
          </button>
          <button onClick={() => exportFile("pdf")} className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2">
            <File className="w-4 h-4 text-red-500" /> PDF
          </button>
          <div className="border-t border-gray-100 mt-1 pt-1 px-3">
            <label className="flex items-center gap-2 py-1.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={includeReviews}
                onChange={(e) => setIncludeReviews(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-[#163f3a] focus:ring-[#163f3a]/30"
              />
              <span className="text-[11px] text-gray-500 group-hover:text-gray-700">包含审阅痕迹</span>
            </label>
          </div>
        </div>
      )}

      {/* Toast 提示 */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm transition-all ${
            toast.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {toast.type === "success" ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
