// ─── 一键初稿 · 出稿（立即成稿） ─────────────────

"use client";

import { useState } from "react";
import { Wand2, Loader2, X, Settings } from "lucide-react";
import { getAllCategories } from "@/types";
import { useGenerate } from "@/lib/ai/use-generate";
import { GenActions } from "@/components/quick-draft/GenActions";
import { SkillSelector } from "@/components/quick-draft/SkillSelector";
import { markdownToGovDocHtml } from "@/lib/markdown";

export default function QuickPage() {
  const allCats = getAllCategories();
  const [category, setCategory] = useState<string>(allCats[0]);
  const [title, setTitle] = useState("");
  const [demand, setDemand] = useState("");
  const [words, setWords] = useState(1500);
  const [skillContext, setSkillContext] = useState("");

  const { options, model, setModel, loading, streaming, text, error, run, cancel } = useGenerate();

  const effectiveTitle = title.trim() || category;
  const canGenerate = !streaming && !!model && demand.trim().length > 0;

  const handleGenerate = () => {
    const prompt = `请起草一篇《${category}》公文初稿。
要求：
- 标题建议：${effectiveTitle}
- 篇幅：约 ${words} 字
- 需求要点：${demand.trim()}
输出格式要求：请使用 Markdown 格式输出，主标题用 # 开头，各级小标题依次用 ##、###、#### 开头，正文段落之间空一行，列表用 1. 2. 3. 或 - 表示。
请直接输出公文正文（含合适的小标题与层级结构），严格遵循《党政机关公文格式》(GB/T 9704-2012) 规范，语言庄重、精练、书面化。`;
    run(prompt, category, skillContext);
  };

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-800 mb-1">出稿 · 立即成稿</h2>
      <p className="text-xs text-gray-400 mb-5">选择公文类型并描述需求，AI 一键生成初稿（自动带入默认画像与全局 Skill）</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左：配置 */}
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs text-gray-500">公文类型</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-red-300"
            >
              {allCats.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-gray-500">标题（留空则用类型名）</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={category}
              className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-300"
            />
          </label>

          <label className="block">
            <span className="text-xs text-gray-500">需求描述 *</span>
            <textarea
              value={demand}
              onChange={(e) => setDemand(e.target.value)}
              rows={6}
              placeholder="如：关于组织开展2026年度安全生产大检查的通知，面向各区县局，强调隐患排查与责任落实。"
              className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-red-300"
            />
          </label>

          <label className="block">
            <span className="text-xs text-gray-500">目标字数</span>
            <input
              type="number"
              value={words}
              min={100}
              max={10000}
              onChange={(e) => setWords(Number(e.target.value) || 1500)}
              className="mt-1 w-32 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-300"
            />
          </label>

          {/* 模型选择 */}
          <div className="flex items-center gap-2">
            {loading ? (
              <span className="text-xs text-gray-400">加载模型…</span>
            ) : options.length === 0 ? (
              <a href="/settings" className="flex items-center gap-1 text-xs text-red-600 hover:underline">
                <Settings className="w-3 h-3" /> 请先在「系统设置 → API 配置」添加并启用密钥
              </a>
            ) : (
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-red-300"
              >
                {options.map((o) => (
                  <option key={o.value} value={o.value}>{o.providerLabel} · {o.model}</option>
                ))}
              </select>
            )}
          </div>

          {/* Skill 选择器 */}
          <SkillSelector
            category={category}
            onContextChange={(ctx) => setSkillContext(ctx)}
          />

          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300"
          >
            {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {streaming ? "生成中…" : "生成初稿"}
          </button>
          {streaming && (
            <button onClick={cancel} className="ml-2 px-3 py-2 text-sm bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300">
              <X className="w-4 h-4" /> 停止
            </button>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        {/* 右：结果 */}
        <div>
          <div className="text-xs text-gray-500 mb-2">生成结果</div>
          <div className="border border-gray-200 rounded-xl bg-white p-4 min-h-[320px] max-h-[520px] overflow-auto">
            {text ? (
              <div
                className="text-sm text-gray-800 leading-relaxed gov-doc-preview"
                dangerouslySetInnerHTML={{ __html: markdownToGovDocHtml(text, effectiveTitle) }}
              />
            ) : (
              <p className="text-xs text-gray-300">生成内容将显示在这里</p>
            )}
          </div>
          {text && <GenActions text={text} title={effectiveTitle} category={category} kind="quick" />}
        </div>
      </div>
    </div>
  );
}
