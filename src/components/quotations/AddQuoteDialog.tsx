"use client";

import { useEffect, useState } from "react";
import { Quote, X, Check } from "lucide-react";
import { useQuotations } from "@/lib/quotations/use-quotations";

interface AddQuoteDialogProps {
  open: boolean;
  onClose: () => void;
  defaultText: string;
  sourceType: string;
  sourceId?: string;
  sourceTitle?: string;
  onAdded?: () => void;
}

export function AddQuoteDialog({
  open,
  onClose,
  defaultText,
  sourceType,
  sourceId = "",
  sourceTitle = "",
  onAdded,
}: AddQuoteDialogProps) {
  const [text, setText] = useState(defaultText);
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { addQuote } = useQuotations();

  useEffect(() => {
    if (open) {
      setText(defaultText);
      setCategory("");
      setErr(null);
      setSaving(false);
    }
  }, [open, defaultText]);

  if (!open) return null;

  const submit = async () => {
    const c = text.trim();
    if (!c) { setErr("金句内容不能为空"); return; }
    setSaving(true);
    setErr(null);
    const categories = category.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    const r = await addQuote({ content: c, sourceType, sourceId, sourceTitle, category: categories.length ? categories : "" });
    setSaving(false);
    if (r.success) {
      onAdded?.();
      onClose();
    } else {
      setErr(r.error?.message || "保存失败");
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-[92vw] max-w-[460px] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
            <Quote className="w-4 h-4 text-amber-500" /> 添加金句
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="block text-[11px] text-gray-500 mb-1">金句内容</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          autoFocus
          className="w-full text-sm text-gray-800 border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-amber-300 resize-none"
          placeholder="选中的文字将自动填入，可手动调整"
        />

        <label className="block text-[11px] text-gray-500 mb-1 mt-3">分类（可选，多个用逗号分隔）</label>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full text-sm text-gray-800 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-amber-300"
          placeholder="如：乡村振兴，工作作风"
        />

        {sourceTitle && (
          <div className="mt-3 text-[11px] text-gray-400 truncate">
            来源：{sourceTitle || "（手动录入）"}
          </div>
        )}

        {err && <div className="mt-2 text-xs text-red-500">{err}</div>}

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose}
            className="px-4 py-2 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">取消</button>
          <button onClick={submit} disabled={saving}
            className="flex items-center gap-1 px-4 py-2 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-60">
            <Check className="w-3.5 h-3.5" /> {saving ? "保存中..." : "保存金句"}
          </button>
        </div>
      </div>
    </div>
  );
}
