// ─── 生成结果操作条（保存为文档 / 追加到编辑器 / 替换全文 / 复制） ──

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, ExternalLink, Copy, Check, Loader2, FileEdit, Replace } from "lucide-react";
import { createDocFromText } from "@/lib/doc-create";
import { addTask, type TaskKind } from "@/lib/task-store";

const APPEND_KEY = "gw-pending-append";
const REPLACE_KEY = "gw-pending-replace";

export function GenActions({
  text,
  title,
  category,
  kind,
}: {
  text: string;
  title: string;
  category: string;
  kind: TaskKind;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canUse = text.trim().length > 0;

  const handleSave = async () => {
    if (!canUse || saving) return;
    setSaving(true);
    setErr(null);
    try {
      const r = await createDocFromText(title, category, text);
      if (!r) {
        setErr("保存失败，请确认已登录或重试");
        return;
      }
      addTask({ title, category, kind, docId: r.id });
      setSaved(true);
      // 跳转到编辑器打开该文档
      router.push(`/documents/${r.id}`);
    } catch {
      setErr("保存失败（网络错误）");
    } finally {
      setSaving(false);
    }
  };

  const handleAppend = () => {
    if (!canUse) return;
    try { localStorage.setItem(APPEND_KEY, text); } catch {}
    router.push("/");
  };

  const handleReplace = () => {
    if (!canUse) return;
    try { localStorage.setItem(REPLACE_KEY, text); } catch {}
    router.push("/");
  };

  const handleCopy = async () => {
    if (!canUse) return;
    await navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-2 mt-3 flex-wrap">
      <button
        onClick={handleSave}
        disabled={!canUse || saving}
        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        {saving ? "保存中..." : "保存为文档"}
      </button>
      <button
        onClick={handleAppend}
        disabled={!canUse}
        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#163f3a] text-white rounded-lg hover:bg-[#163f3a]/90 disabled:opacity-40"
        title="将生成内容追加到当前编辑器文档尾部"
      >
        <FileEdit className="w-3.5 h-3.5" />追加到编辑器
      </button>
      <button
        onClick={handleReplace}
        disabled={!canUse}
        className="flex items-center gap-1 px-3 py-1.5 text-xs border border-[#163f3a]/30 text-[#163f3a] rounded-lg hover:bg-[#163f3a]/5 disabled:opacity-40"
        title="用生成内容替换编辑器全文"
      >
        <Replace className="w-3.5 h-3.5" />替换全文
      </button>
      <button
        onClick={handleCopy}
        disabled={!canUse}
        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-40"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "已复制" : "复制"}
      </button>
      {saved && (
        <span className="flex items-center gap-1 text-xs text-green-600">
          <ExternalLink className="w-3.5 h-3.5" /> 已保存，跳转编辑中…
        </span>
      )}
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
