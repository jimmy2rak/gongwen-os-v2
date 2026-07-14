// ─── DOCX 导入弹窗（编辑器 / 文档管理 / 知识库 复用）──
// 选择 .docx → mammoth 解析为 HTML → 用户确认标题与公文类型 → onConfirm 回传。
// forceReview=true 时（知识库）提示「导入后自动标记为已审阅」。

"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Upload, X, Loader2, AlertCircle, CheckCircle2, FileCheck2 } from "lucide-react";
import { DOCUMENT_CATEGORIES, getCategoryColor } from "@/types";
import { parseDocxFile } from "@/lib/docx";

export interface DocxImportData {
  html: string;
  title: string;
  category: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: DocxImportData) => void;
  forceReview?: boolean;
  submitLabel?: string;
}

function stripHtml(html: string): string {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
}

export function ImportDocxModal({ open, onClose, onConfirm, forceReview, submitLabel = "导入" }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(DOCUMENT_CATEGORIES[0] || "通知");
  const [preview, setPreview] = useState("");

  // 每次打开重置状态
  useEffect(() => {
    if (open) {
      setParsing(false);
      setError(null);
      setHtml("");
      setPreview("");
      setTitle("");
      setCategory(DOCUMENT_CATEGORIES[0] || "通知");
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [open]);

  if (!open) return null;

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setParsing(true);
    try {
      const res = await parseDocxFile(file);
      setHtml(res.html);
      setTitle(res.title);
      setPreview(stripHtml(res.html).slice(0, 400));
    } catch (err: any) {
      setError(err?.message || "解析失败，请确认是 .docx 文件");
      setHtml("");
      setPreview("");
    } finally {
      setParsing(false);
    }
  };

  const canSubmit = !!html && !!title.trim();

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl p-6 w-[520px] max-w-[92vw] max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-[#163f3a]" /> 导入 Word 文档（.docx）
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 选择文件 */}
        <label className="flex items-center gap-3 p-4 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-[#163f3a]/40 transition-colors">
          <input ref={fileRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={onFile} />
          <div className="w-10 h-10 rounded-full bg-[#163f3a]/10 flex items-center justify-center flex-shrink-0">
            {parsing ? <Loader2 className="w-5 h-5 text-[#163f3a] animate-spin" /> : <Upload className="w-5 h-5 text-[#163f3a]" />}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-700">选择 .docx 文件</div>
            <div className="text-[11px] text-gray-400">自动识别正文、标题、表格并转为可编辑公文</div>
          </div>
        </label>

        {error && (
          <div className="mt-3 px-3 py-2 bg-red-50 text-red-600 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5" /> {error}
          </div>
        )}

        {html && (
          <div className="mt-4 space-y-3 overflow-auto flex-1">
            {/* 标题 */}
            <label className="block">
              <span className="text-xs text-gray-500">文档标题</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-300" />
            </label>
            {/* 公文类型 */}
            <label className="block">
              <span className="text-xs text-gray-500">公文类型</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-red-300 appearance-none"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", paddingRight: "28px" }}>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            {/* 预览 */}
            <div>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                <FileCheck2 className="w-3.5 h-3.5 text-green-600" /> 识别预览
              </div>
              <div className="text-[11px] text-gray-500 leading-relaxed bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-32 overflow-auto">
                {preview || "（空文档）"}
              </div>
            </div>
          </div>
        )}

        {/* 强制审阅提示 */}
        {forceReview && (
          <div className="mt-3 flex items-center gap-2 text-xs text-[#163f3a] bg-[#163f3a]/8 px-3 py-2 rounded-lg">
            <CheckCircle2 className="w-3.5 h-3.5" />
            知识库仅收纳已审阅公文，导入后将自动标记为「已审阅」并进入知识库
          </div>
        )}

        <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">取消</button>
          <button
            onClick={() => canSubmit && onConfirm({ html, title: title.trim(), category })}
            disabled={!canSubmit}
            className="px-4 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
