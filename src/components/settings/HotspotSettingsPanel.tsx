// ─── 热点推送设置面板 ───────────────────────────
// 管理数据源（内置+自定义），一键复制 Python 命令 / 导出脚本

"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, X, Check, Globe, Terminal, FileCode, RefreshCw, Code2, Copy, Download } from "lucide-react";
import { CustomDialog } from "@/components/ui/CustomDialog";
import { generateCrawlerScript, RMRB_PRESET, type CrawlerConfig } from "@/lib/crawler-generator";

interface HotspotSource {
  id: string;
  name: string;
  url: string;
  category: string;
  selectorTitle: string | null;
  selectorSummary: string | null;
  selectorLink: string | null;
  selectorContent: string | null;
  isBuiltin: boolean;
  sortOrder: number;
}

const SAMPLE_SELECTORS = `{
  "list": ".news-list li",
  "title": "h2 a",
  "summary": ".summary",
  "link": "h2 a@href",
  "content": ".article-content"
}`;

export default function HotspotSettingsPanel() {
  const [list, setList] = useState<HotspotSource[]>([]);
  const [editing, setEditing] = useState<HotspotSource | null>(null);
  const [form, setForm] = useState({
    name: "", url: "", category: "综合",
    selectorTitle: "", selectorSummary: "", selectorLink: "", selectorContent: "",
  });
  const [showForm, setShowForm] = useState(false);
  const [confirmDel, setConfirmDel] = useState<{ id: string; name: string } | null>(null);
  const [copyOk, setCopyOk] = useState(false);

  // ── 爬虫代码生成器 ──
  const [genForm, setGenForm] = useState<CrawlerConfig>({
    siteName: "", layoutUrl: "", sectionKeywords: [],
    pageItemsSel: "#pageList .right_title-name", pageTitleSel: "a",
    articleListSel: "#titleList ul li", articleLinkContains: "content",
    contentSel: "#ozoom", titleSels: "h1, h2, h3",
    defaultCategory: "时政", apiUrl: "http://localhost:3000/api/hotspots",
  });
  const [genKeywords, setGenKeywords] = useState("");
  const [genCode, setGenCode] = useState("");
  const [genCopyOk, setGenCopyOk] = useState(false);

  const loadData = () => {
    fetch("/api/hotspot-sources")
      .then((r) => r.json())
      .then((b) => { if (b.success) setList(b.data || []); })
      .catch(() => {});
  };

  useEffect(() => { loadData(); }, []);

  const refresh = () => loadData();

  const openNew = () => {
    setForm({ name: "", url: "", category: "综合", selectorTitle: "", selectorSummary: "", selectorLink: "", selectorContent: "" });
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (s: HotspotSource) => {
    setForm({
      name: s.name, url: s.url, category: s.category || "综合",
      selectorTitle: s.selectorTitle || "", selectorSummary: s.selectorSummary || "",
      selectorLink: s.selectorLink || "", selectorContent: s.selectorContent || "",
    });
    setEditing(s);
    setShowForm(true);
  };

  const submit = async () => {
    if (!form.name.trim() || !form.url.trim()) return;
    const body = {
      ...(editing ? { id: editing.id } : {}),
      name: form.name.trim(), url: form.url.trim(), category: form.category,
      selectorTitle: form.selectorTitle || null,
      selectorSummary: form.selectorSummary || null,
      selectorLink: form.selectorLink || null,
      selectorContent: form.selectorContent || null,
    };

    const res = await fetch(`/api/hotspot-sources`, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const b = await res.json();
    if (b.success) { refresh(); setShowForm(false); }
  };

  const remove = async () => {
    if (!confirmDel) return;
    await fetch("/api/hotspot-sources", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: confirmDel.id }),
    });
    refresh();
    setConfirmDel(null);
  };

  // ── 生成 Python 命令 ──
  const buildPythonCmd = (source: HotspotSource): string => {
    const selectors = [
      source.selectorTitle ? `--selector-title "${source.selectorTitle}"` : "",
      source.selectorSummary ? `--selector-summary "${source.selectorSummary}"` : "",
      source.selectorLink ? `--selector-link "${source.selectorLink}"` : "",
      source.selectorContent ? `--selector-content "${source.selectorContent}"` : "",
    ].filter(Boolean).join(" \\\n  ");
    return `python3 crawl_hotspot.py \\\n  --name "${source.name}" \\\n  --url "${source.url}" \\\n  --category "${source.category}" \\\n  ${selectors}`;
  };

  const buildAllCmd = (): string => {
    return list.map((s) => buildPythonCmd(s)).join("\n\n");
  };

  const copyPythonCmd = () => {
    const cmd = buildAllCmd();
    navigator.clipboard.writeText(cmd).then(() => {
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 2000);
    });
  };

  // ── 爬虫生成器逻辑 ──
  const loadPreset = () => {
    setGenForm({ ...RMRB_PRESET });
    setGenKeywords(RMRB_PRESET.sectionKeywords.join("，"));
    setGenCode("");
  };

  const handleGenerate = () => {
    if (!genForm.siteName.trim() || !genForm.layoutUrl.trim()) return;
    const keywords = genKeywords.split(/[，,\s]+/).map((s) => s.trim()).filter(Boolean);
    const code = generateCrawlerScript({ ...genForm, sectionKeywords: keywords });
    setGenCode(code);
  };

  const copyGenCode = () => {
    if (!genCode) return;
    navigator.clipboard.writeText(genCode).then(() => {
      setGenCopyOk(true);
      setTimeout(() => setGenCopyOk(false), 2000);
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-800">热点推送 · 数据源管理</h3>
          <p className="text-xs text-gray-400 mt-0.5">配置爬虫来源，每日自动抓取热点资讯</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">
          <Plus className="w-3.5 h-3.5" /> 新增源
        </button>
      </div>

      {/* 数据源列表 */}
      <div className="space-y-2 mb-4">
        {list.map((s) => (
          <div key={s.id} className="p-3 bg-white rounded-lg border border-gray-200">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-800">{s.name}</span>
                  {s.isBuiltin && (
                    <span className="text-[9px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">内置</span>
                  )}
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{s.category}</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5 truncate">{s.url}</p>
                {s.selectorTitle && (
                  <p className="text-[10px] text-gray-300 mt-0.5">选择器已配置（{s.selectorTitle}）</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => openEdit(s)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {!s.isBuiltin && (
                  <button onClick={() => setConfirmDel({ id: s.id, name: s.name })}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2">
        <button onClick={copyPythonCmd}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[#163f3a] text-white rounded-lg hover:bg-[#163f3a]/80">
          {copyOk ? <Check className="w-3 h-3" /> : <Terminal className="w-3 h-3" />}
          {copyOk ? "已复制" : "一键复制 Python 命令"}
        </button>
        <button onClick={() => {
          const blob = new Blob([buildAllCmd()], { type: "text/plain;charset=utf-8" });
          const a = document.createElement("a");
          const url = URL.createObjectURL(blob);
          a.href = url;
          a.download = "crawl_commands.sh";
          a.click();
          URL.revokeObjectURL(url);
        }}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
          <FileCode className="w-3 h-3" /> 导出脚本
        </button>
      </div>

      {/* ── 爬虫代码生成器 ── */}
      <div className="mt-6 border border-dashed border-[#163f3a]/30 rounded-xl p-5 bg-[#f6f4ef]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-[#163f3a]" />
            <h4 className="text-sm font-medium text-gray-800">生成专属爬虫脚本</h4>
            <span className="text-[10px] text-gray-400">输入网站即可一键生成可运行 Python</span>
          </div>
          <button onClick={loadPreset}
            className="px-2.5 py-1 text-[11px] bg-white border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50">
            载入人民日报模板
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] text-gray-500">站点名称 *</span>
            <input value={genForm.siteName} onChange={(e) => setGenForm({ ...genForm, siteName: e.target.value })}
              placeholder="如：人民日报" className="mt-0.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-300" />
          </label>
          <label className="block">
            <span className="text-[11px] text-gray-500">版面导航页 URL 模板 *（含 {'{YYYY}{MM}{DD}'}）</span>
            <input value={genForm.layoutUrl} onChange={(e) => setGenForm({ ...genForm, layoutUrl: e.target.value })}
              placeholder="http://.../layout/{YYYY}{MM}/{DD}/node_01.html"
              className="mt-0.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-300" />
          </label>
          <label className="block">
            <span className="text-[11px] text-gray-500">版面筛选关键词（逗号分隔）</span>
            <input value={genKeywords} onChange={(e) => setGenKeywords(e.target.value)}
              placeholder="如：理论，评论" className="mt-0.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-300" />
          </label>
          <label className="block">
            <span className="text-[11px] text-gray-500">默认分类标签</span>
            <input value={genForm.defaultCategory} onChange={(e) => setGenForm({ ...genForm, defaultCategory: e.target.value })}
              placeholder="时政" className="mt-0.5 w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-300" />
          </label>
          <label className="block">
            <span className="text-[11px] text-gray-500">版面条目选择器</span>
            <input value={genForm.pageItemsSel} onChange={(e) => setGenForm({ ...genForm, pageItemsSel: e.target.value })}
              placeholder="#pageList .right_title-name" className="mt-0.5 w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-red-300" />
          </label>
          <label className="block">
            <span className="text-[11px] text-gray-500">版面标题元素</span>
            <input value={genForm.pageTitleSel} onChange={(e) => setGenForm({ ...genForm, pageTitleSel: e.target.value })}
              placeholder="a" className="mt-0.5 w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-red-300" />
          </label>
          <label className="block">
            <span className="text-[11px] text-gray-500">文章列表选择器</span>
            <input value={genForm.articleListSel} onChange={(e) => setGenForm({ ...genForm, articleListSel: e.target.value })}
              placeholder="#titleList ul li" className="mt-0.5 w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-red-300" />
          </label>
          <label className="block">
            <span className="text-[11px] text-gray-500">文章链接包含</span>
            <input value={genForm.articleLinkContains} onChange={(e) => setGenForm({ ...genForm, articleLinkContains: e.target.value })}
              placeholder="content" className="mt-0.5 w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-red-300" />
          </label>
          <label className="block">
            <span className="text-[11px] text-gray-500">正文容器选择器</span>
            <input value={genForm.contentSel} onChange={(e) => setGenForm({ ...genForm, contentSel: e.target.value })}
              placeholder="#ozoom" className="mt-0.5 w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-red-300" />
          </label>
          <label className="block">
            <span className="text-[11px] text-gray-500">标题选择器</span>
            <input value={genForm.titleSels} onChange={(e) => setGenForm({ ...genForm, titleSels: e.target.value })}
              placeholder="h1, h2, h3" className="mt-0.5 w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-red-300" />
          </label>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <button onClick={handleGenerate} disabled={!genForm.siteName.trim() || !genForm.layoutUrl.trim()}
            className="px-4 py-1.5 text-xs bg-[#163f3a] text-white rounded-lg hover:bg-[#163f3a]/80 disabled:bg-gray-300">
            生成脚本
          </button>
          {genCode && (
            <>
              <button onClick={copyGenCode}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
                {genCopyOk ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {genCopyOk ? "已复制" : "复制代码"}
              </button>
              <button onClick={() => {
                const safe = (genForm.siteName || "site").replace(/[^\w\u4e00-\u9fa5]/g, "_");
                const blob = new Blob([genCode], { type: "text/plain;charset=utf-8" });
                const a = document.createElement("a");
                const url = URL.createObjectURL(blob);
                a.href = url;
                a.download = `crawl_${safe}.py`;
                a.click();
                URL.revokeObjectURL(url);
              }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
                <Download className="w-3 h-3" /> 下载 .py
              </button>
            </>
          )}
        </div>

        {genCode && (
          <pre className="mt-3 max-h-80 overflow-auto bg-[#1e1e1e] text-gray-100 text-[11px] leading-relaxed rounded-lg p-3 whitespace-pre"><code>{genCode}</code></pre>
        )}
        <p className="text-[10px] text-gray-400 mt-2">
          运行：<code className="bg-gray-100 px-1 rounded">python3 crawl_xxx.py --start 20260701 --end 20260708 --db ./data.db</code>
          ，或加 <code className="bg-gray-100 px-1 rounded">--push --token xxx</code> 推送到系统。
        </p>
      </div>

      {list.length === 0 && !showForm && (
        <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200 mt-4">
          <p className="text-xs text-gray-400">暂无数据源，点击右上角新增</p>
        </div>
      )}

      {/* 表单 */}
      {showForm && (
        <div className="mt-4 border border-gray-200 rounded-xl p-5 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-700">{editing ? "编辑数据源" : "新增数据源"}</h4>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs text-gray-500">名称 *</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="如：中国政府网"
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-300" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">URL *</span>
              <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://..."
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-300" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">默认分类</span>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="综合"
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-300" />
            </label>
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-400 mb-2">CSS 选择器配置（爬取规则，非必填）</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] text-gray-400">标题选择器</span>
                  <input value={form.selectorTitle} onChange={(e) => setForm({ ...form, selectorTitle: e.target.value })}
                    placeholder="如: h2.news-title a"
                    className="mt-0.5 w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-300" />
                </label>
                <label className="block">
                  <span className="text-[10px] text-gray-400">摘要选择器</span>
                  <input value={form.selectorSummary} onChange={(e) => setForm({ ...form, selectorSummary: e.target.value })}
                    placeholder="如: .summary"
                    className="mt-0.5 w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-300" />
                </label>
                <label className="block">
                  <span className="text-[10px] text-gray-400">链接选择器</span>
                  <input value={form.selectorLink} onChange={(e) => setForm({ ...form, selectorLink: e.target.value })}
                    placeholder="如: a@href"
                    className="mt-0.5 w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-300" />
                </label>
                <label className="block">
                  <span className="text-[10px] text-gray-400">正文 HTML 选择器</span>
                  <input value={form.selectorContent} onChange={(e) => setForm({ ...form, selectorContent: e.target.value })}
                    placeholder="如: .article-content"
                    className="mt-0.5 w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-300" />
                </label>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setShowForm(false)}
              className="px-4 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">取消</button>
            <button onClick={submit} disabled={!form.name.trim() || !form.url.trim()}
              className="px-4 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300">保存</button>
          </div>
        </div>
      )}

      {/* 删除确认 */}
      <CustomDialog
        open={!!confirmDel}
        mode="confirm"
        title="删除数据源"
        message={confirmDel ? `确定删除「${confirmDel.name}」？删除后该源的热点数据不受影响，但爬虫将不再更新。` : ""}
        confirmText="确定删除"
        cancelText="取消"
        onConfirm={remove}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}
