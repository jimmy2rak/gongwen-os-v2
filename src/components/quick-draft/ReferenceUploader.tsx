// ─── 双资料上传区（虚线框） ───────────────────────
// 一键初稿 / 大纲页复用：独立虚线卡片、多文件、拖拽+点击、已上传列表+删除、解析状态。
// 解析在客户端完成（pdf/docx/doc/txt/md/jpg/png），解析结果经 onChange 上报给父组件，
// 由父组件组装进生成请求的 systemExtra。

"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileText, X, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  isAllowedFile,
  parseReferenceFile,
  type ParsedRef,
} from "@/lib/ai/parse-reference";

interface Entry {
  id: string;
  name: string;
  status: "parsing" | "done" | "error";
  progress?: number;
  result?: ParsedRef;
}

export interface ReferenceUploaderProps {
  /** 分区标题 */
  title: string;
  /** 分区说明文案 */
  hint: string;
  /** 解析结果变化时上报（仅含已解析条目，含 error 的也上报以便父组件感知） */
  onChange: (items: ParsedRef[]) => void;
}

const ACCEPT = ".pdf,.docx,.doc,.txt,.md,.jpg,.jpeg,.png";

export function ReferenceUploader({ title, hint, onChange }: ReferenceUploaderProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const emit = (list: Entry[]) => {
    const items: ParsedRef[] = list
      .map((e) => e.result)
      .filter((r): r is ParsedRef => !!r);
    onChange(items);
  };

  const addFiles = async (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    const existing = new Set(entries.map((e) => e.name));
    const toAdd = incoming.filter((f) => {
      if (existing.has(f.name)) return false;
      existing.add(f.name);
      return true;
    });
    if (toAdd.length === 0) return;

    const newEntries: Entry[] = toAdd.map((f) => ({
      id: Math.random().toString(36).slice(2),
      name: f.name,
      status: "parsing",
      progress: 0,
    }));
    setEntries((prev) => [...prev, ...newEntries]);

    for (const f of toAdd) {
      const id = newEntries.find((e) => e.name === f.name)!.id;
      const result = await parseReferenceFile(f, (p) => {
        setEntries((prev) => {
          return prev.map((e) => (e.id === id ? { ...e, progress: Math.round(p * 100) } : e));
        });
      });
      setEntries((prev) => {
        return prev.map((e) => {
          if (e.id !== id) return e;
          return {
            ...e,
            status: result.error ? "error" : "done",
            result,
            progress: result.error ? undefined : 100,
          };
        });
      });
    }
    setEntries((prev) => {
      emit(prev);
      return prev;
    });
  };

  const removeAt = (id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      emit(next);
      return next;
    });
  };

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        className="cursor-pointer rounded-xl p-4 transition-colors bg-white hover:bg-gray-50"
        style={{
          border: "2px dashed #ccc",
          borderColor: dragging ? "#ef4444" : "#ccc",
        }}
      >
        <div className="flex items-start gap-3">
          <UploadCloud className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-gray-700">{title}</div>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">{hint}</p>
            <p className="text-[11px] text-gray-300 mt-1">
              支持 pdf / docx / doc / txt / md / jpg / png · 可多选 · 拖拽或点击上传
            </p>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {entries.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-2 text-xs rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-1.5"
            >
              {e.status === "parsing" && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin shrink-0" />}
              {e.status === "done" && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />}
              {e.status === "error" && <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
              <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="truncate text-gray-700 flex-1" title={e.name}>
                {e.name}
                {e.status === "parsing" && e.progress != null ? ` · 解析中 ${e.progress}%` : ""}
                {e.status === "done" && e.result?.truncated ? " · 已截断" : ""}
                {e.status === "error" && e.result?.error ? ` · ${e.result.error}` : ""}
              </span>
              <button
                onClick={() => removeAt(e.id)}
                className="text-gray-400 hover:text-red-500 shrink-0"
                title="删除"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
