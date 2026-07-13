// ─── AI 记忆设置面板 ─────────────────────────────
// 管理当前账号的 AI 写作记忆（按账号持久化，刷新/重登不丢失）：
//  - 个人信息 / 语言用词习惯 / 公文写作强化要点：用户手动维护
//  - 系统自动学习笔记：由 AI 对话自动提取（只读）
// 该记忆会注入到所有 AI 生成（公文助手对话、一键初稿、一键大纲）。

"use client";

import { useEffect, useState } from "react";
import { Save, RotateCcw, Brain, RefreshCw } from "lucide-react";
import { CustomDialog } from "@/components/ui/CustomDialog";

type Memory = {
  personalInfo: string;
  languageHabits: string;
  writingEnhancements: string;
  autoNotes: string;
};

const EMPTY: Memory = {
  personalInfo: "",
  languageHabits: "",
  writingEnhancements: "",
  autoNotes: "",
};

export default function AiMemoryPanel() {
  const [memory, setMemory] = useState<Memory>(EMPTY);
  const [draft, setDraft] = useState<Memory>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedTip, setSavedTip] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [extractTip, setExtractTip] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/user/memory")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.memory) {
          setMemory(d.memory);
          setDraft(d.memory);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const dirty =
    draft.personalInfo !== memory.personalInfo ||
    draft.languageHabits !== memory.languageHabits ||
    draft.writingEnhancements !== memory.writingEnhancements ||
    draft.autoNotes !== memory.autoNotes;

  const save = async () => {
    setSaving(true);
    setSavedTip(false);
    try {
      const r = await fetch("/api/user/memory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personalInfo: draft.personalInfo,
          languageHabits: draft.languageHabits,
          writingEnhancements: draft.writingEnhancements,
          autoNotes: draft.autoNotes,
        }),
      });
      const d = await r.json();
      if (d.success) {
        setMemory(d.memory);
        setDraft(d.memory);
        setSavedTip(true);
        setTimeout(() => setSavedTip(false), 2000);
      }
    } catch {}
    setSaving(false);
  };

  const reset = async () => {
    setConfirmReset(false);
    setSaving(true);
    try {
      const r = await fetch("/api/user/memory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalInfo: "", languageHabits: "", writingEnhancements: "" }),
      });
      const d = await r.json();
      if (d.success) {
        // 保留自动笔记，仅清空手动三段
        const merged = { ...d.memory, autoNotes: memory.autoNotes };
        setMemory(merged);
        setDraft(merged);
      }
    } catch {}
    setSaving(false);
  };

  // 手动更新：强制抓取全部公文/初稿/大纲/知识库/聊天历史，生成记忆草稿
  const refresh = async () => {
    setRefreshing(true);
    setExtractTip(null);
    try {
      const r = await fetch("/api/user/memory/refresh", { method: "POST" });
      const d = await r.json();
      if (d.success && d.extracted) {
        const e = d.extracted;
        setDraft((prev) => ({
          personalInfo: e.personalInfo || prev.personalInfo,
          languageHabits: e.languageHabits || prev.languageHabits,
          writingEnhancements: e.writingEnhancements || prev.writingEnhancements,
          autoNotes: e.notes || prev.autoNotes,
        }));
        setExtractTip("已根据全部公文/初稿/大纲/知识库/聊天历史生成记忆草稿，请检查后点「保存」");
      } else {
        setExtractTip(d.error?.message || "生成失败");
      }
    } catch {
      setExtractTip("网络错误，请重试");
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return <div className="text-xs text-gray-400 py-10 text-center">加载中…</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
            <Brain className="w-4 h-4 text-[#163f3a]" /> AI 记忆
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            这些记忆会注入到所有 AI 生成（公文助手对话、一键初稿、一键大纲），下次生成自动结合你的习惯
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedTip && <span className="text-[11px] text-green-600">已保存</span>}
          {extractTip && <span className="text-[11px] text-[#163f3a] max-w-[200px] truncate" title={extractTip}>{extractTip}</span>}
          <button
            onClick={refresh}
            disabled={refreshing || saving}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-[#163f3a] bg-white border border-[#163f3a]/30 rounded-lg hover:bg-[#163f3a]/5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> {refreshing ? "生成中…" : "手动更新"}
          </button>
          <button
            onClick={reset}
            disabled={saving || refreshing}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" /> 清空手动记忆
          </button>
          <button
            onClick={save}
            disabled={saving || refreshing || !dirty}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300"
          >
            <Save className="w-3.5 h-3.5" /> {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <Field
          label="个人信息"
          hint="单位 / 部门 / 职务 / 常用落款署名等，AI 会自动套用"
          value={draft.personalInfo}
          onChange={(v) => setDraft({ ...draft, personalInfo: v })}
          rows={3}
        />
        <Field
          label="语言用词习惯"
          hint="偏好用词、口头禅、禁用词、语气倾向（如：多用「扎实」「推进」，避免口语化）"
          value={draft.languageHabits}
          onChange={(v) => setDraft({ ...draft, languageHabits: v })}
          rows={4}
        />
        <Field
          label="公文写作强化要点"
          hint="偏好的结构、格式、规范、重点（如：开头先点明背景，结尾落具体举措）"
          value={draft.writingEnhancements}
          onChange={(v) => setDraft({ ...draft, writingEnhancements: v })}
          rows={4}
        />

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-500">系统自动学习笔记（可编辑）</span>
            <span className="text-[10px] text-gray-300">由 AI 对话自动提取 / 点「手动更新」生成，可修改</span>
          </div>
          <textarea
            value={draft.autoNotes}
            onChange={(e) => setDraft({ ...draft, autoNotes: e.target.value })}
            rows={5}
            placeholder="暂无自动笔记。与公文助手对话、生成初稿/大纲时系统会自动学习；或点右上角「手动更新」从全部公文/初稿/大纲/知识库/聊天历史生成。"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 leading-relaxed focus:outline-none focus:ring-1 focus:ring-red-300 resize-y bg-gray-50"
          />
        </div>
      </div>

      <CustomDialog
        open={confirmReset}
        mode="confirm"
        title="清空手动记忆"
        message="将清空你手动填写的「个人信息 / 语言用词习惯 / 公文写作强化要点」，系统自动学习笔记会保留。确定继续？"
        confirmText="确定清空"
        cancelText="取消"
        onConfirm={reset}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  rows,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
}) {
  return (
    <div>
      <div className="mb-1.5">
        <span className="text-xs text-gray-500">{label}</span>
        <p className="text-[10px] text-gray-300 mt-0.5">{hint}</p>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={`请输入${label}…`}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 leading-relaxed focus:outline-none focus:ring-1 focus:ring-red-300 resize-y"
      />
    </div>
  );
}
