// ─── 一键初稿 · 大纲（大纲成稿） ─────────────────

"use client";

import { useState } from "react";
import { Wand2, Loader2, X, ListTree, FileText, Settings } from "lucide-react";
import { getAllCategories } from "@/types";
import { useGenerate } from "@/lib/ai/use-generate";
import { GenActions } from "@/components/quick-draft/GenActions";
import { SkillSelector } from "@/components/quick-draft/SkillSelector";
import { markdownToGovDocHtml } from "@/lib/markdown";

export default function OutlinePage() {
  const allCats = getAllCategories();
  const [category, setCategory] = useState<string>(allCats[0]);
  const [theme, setTheme] = useState("");
  const [words, setWords] = useState(2000);
  const [skillContext, setSkillContext] = useState("");

  const { options, model, setModel, loading, streaming, text, error, run, cancel } = useGenerate();

  const canGenerate = !streaming && !!model && theme.trim().length > 0;
  const hasOutline = text.trim().length > 0 && !streaming;

  const handleOutline = () => {
    const prompt = `请为一篇《${category}》公文拟定写作大纲。
主题/背景：${theme.trim()}
要求：
- 列出一级、二级标题结构（使用"一、""（一）"层级）
- 概括每段核心内容，无需展开成段
- 总篇幅目标约 ${words} 字
输出格式要求：请使用 Markdown 格式输出，主标题用 # 开头，各级小标题依次用 ##、###、#### 开头，正文段落之间空一行，列表用 1. 2. 3. 或 - 表示。
仅输出大纲，简洁清晰。`;
    run(prompt, category, skillContext);
  };

  const handleExpand = () => {
    const prompt = `以下是某《${category}》公文的大纲，请据此扩写成完整初稿正文。
【大纲】
${text.trim()}
要求：
- 严格按大纲层级展开，语言庄重书面，遵循 GB/T 9704-2012 规范
- 篇幅约 ${words} 字
输出格式要求：请使用 Markdown 格式输出，主标题用 # 开头，各级小标题依次用 ##、###、#### 开头，正文段落之间空一行，列表用 1. 2. 3. 或 - 表示。
直接输出公文正文。`;
    run(prompt, category, skillContext);
  };

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-800 mb-1">大纲 · 大纲成稿</h2>
      <p className="text-xs text-gray-400 mb-5">先生成大纲，确认结构后再一键扩写为正文</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            <span className="text-xs text-gray-500">主题 / 背景 *</span>
            <textarea
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              rows={5}
              placeholder="如：围绕乡村振兴主题，部署下半年帮扶工作，明确产业、就业、教育三项重点任务。"
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
              onChange={(e) => setWords(Number(e.target.value) || 2000)}
              className="mt-1 w-32 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-300"
            />
          </label>

          <div className="flex items-center gap-2">
            {loading ? (
              <span className="text-xs text-gray-400">加载模型…</span>
            ) : options.length === 0 ? (
              <a href="/settings" className="flex items-center gap-1 text-xs text-red-600 hover:underline">
                <Settings className="w-3 h-3" /> 请先配置并启用密钥
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

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleOutline}
              disabled={!canGenerate}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300"
            >
              {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListTree className="w-4 h-4" />}
              {streaming ? "生成中…" : "生成大纲"}
            </button>
            {hasOutline && (
              <button
                onClick={handleExpand}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <FileText className="w-4 h-4" /> 扩写为正文
              </button>
            )}
            {streaming && (
              <button onClick={cancel} className="px-3 py-2 text-sm bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300">
                <X className="w-4 h-4" /> 停止
              </button>
            )}
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div>
          <div className="text-xs text-gray-500 mb-2">结果</div>
          <div className="border border-gray-200 rounded-xl bg-white p-4 min-h-[320px] max-h-[520px] overflow-auto">
            {text ? (
              <div
                className="text-sm text-gray-800 leading-relaxed gov-doc-preview"
                dangerouslySetInnerHTML={{ __html: markdownToGovDocHtml(text, category) }}
              />
            ) : (
              <p className="text-xs text-gray-300">大纲 / 正文将显示在这里</p>
            )}
          </div>
          {text && <GenActions text={text} title={category} category={category} kind="outline" />}
        </div>
      </div>
    </div>
  );
}
