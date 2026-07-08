// ─── 爬虫热点推送配置面板（仅超级管理员可见）──────
// 区域1：新增数据源表单（名称 / 抓取根URL / 栏目下拉 / 标签）
// 区域2：数据源列表（编辑 / 删除 / 生成一键爬虫脚本）
// 区域3：生成脚本弹窗（大文本框展示完整 .py + 复制 + 下载 crawler_task_{id}.py）

"use client";

import { useEffect, useState } from "react";
import {
  Plus, Trash2, Pencil, X, Check, Globe, Copy, Download, Code2, Terminal,
} from "lucide-react";
import { CustomDialog } from "@/components/ui/CustomDialog";
import { getAllCategories } from "@/types";

interface CrawlerSource {
  id: string;
  sourceName: string;
  baseUrl: string;
  targetColumnId: string | null;
  categoryTag: string;
  enable: number | boolean;
  createBy: string | null;
}

const inputCls =
  "mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-300";

export default function CrawlerAdminPanel() {
  const [list, setList] = useState<CrawlerSource[]>([]);
  const [loading, setLoading] = useState(true);

  // 表单
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CrawlerSource | null>(null);
  const [form, setForm] = useState({
    sourceName: "", baseUrl: "", targetColumnId: "", categoryTag: "综合", enable: true,
  });

  // 删除确认
  const [confirmDel, setConfirmDel] = useState<CrawlerSource | null>(null);

  // 生成脚本
  const [genSource, setGenSource] = useState<CrawlerSource | null>(null);
  const [genCode, setGenCode] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [genCopyOk, setGenCopyOk] = useState(false);

  const allCats = getAllCategories();

  // ── 拉取数据源（超管接口，普通用户会被 403 拒绝）──
  const loadData = () => {
    setLoading(true);
    fetch("/api/admin/crawler/list")
      .then((r) => r.json())
      .then((b) => { if (b.success) setList((b.data as CrawlerSource[]) || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { loadData(); }, []);

  const openNew = () => {
    setForm({ sourceName: "", baseUrl: "", targetColumnId: allCats[0] || "", categoryTag: "综合", enable: true });
    setEditing(null);
    setShowForm(true);
  };
  const openEdit = (s: CrawlerSource) => {
    setForm({
      sourceName: s.sourceName, baseUrl: s.baseUrl,
      targetColumnId: s.targetColumnId || "", categoryTag: s.categoryTag || "综合", enable: !!s.enable,
    });
    setEditing(s);
    setShowForm(true);
  };

  const submit = async () => {
    if (!form.sourceName.trim() || !form.baseUrl.trim()) return;
    const body = {
      ...(editing ? { id: editing.id } : {}),
      sourceName: form.sourceName.trim(),
      baseUrl: form.baseUrl.trim(),
      targetColumnId: form.targetColumnId || null,
      categoryTag: form.categoryTag || "综合",
      enable: form.enable,
    };
    const res = await fetch("/api/admin/crawler/sources", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const b = await res.json();
    if (b.success) { setShowForm(false); loadData(); }
  };

  const remove = async () => {
    if (!confirmDel) return;
    await fetch("/api/admin/crawler/sources", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: confirmDel.id }),
    });
    setConfirmDel(null);
    loadData();
  };

  // ── 生成脚本：POST 返回纯文本 ──
  const openGenerate = async (s: CrawlerSource) => {
    setGenSource(s);
    setGenCode("");
    setGenLoading(true);
    try {
      const res = await fetch("/api/admin/crawler/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: s.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setGenCode(`# 生成失败：${err?.error?.message || res.status}`);
      } else {
        setGenCode(await res.text());
      }
    } catch {
      setGenCode("# 网络错误，生成失败");
    } finally {
      setGenLoading(false);
    }
  };

  const copyCode = () => {
    if (!genCode) return;
    navigator.clipboard.writeText(genCode).then(() => {
      setGenCopyOk(true);
      setTimeout(() => setGenCopyOk(false), 2000);
    });
  };
  const downloadCode = () => {
    if (!genCode || !genSource) return;
    const blob = new Blob([genCode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crawler_task_${genSource.id}.py`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-800">爬虫热点推送配置</h3>
          <p className="text-xs text-gray-400 mt-0.5">仅超级管理员可见 · 一键生成可运行 Python 爬虫并自动入库</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">
          <Plus className="w-3.5 h-3.5" /> 新增数据源
        </button>
      </div>

      {/* 数据源列表 */}
      {loading ? (
        <div className="text-center py-10 text-sm text-gray-400">加载中…</div>
      ) : list.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <p className="text-xs text-gray-400">暂无数据源，点击右上角新增</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((s) => (
            <div key={s.id} className="p-3 bg-white rounded-lg border border-gray-200">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-800">{s.sourceName}</span>
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                      {s.targetColumnId || "未绑定栏目"}
                    </span>
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{s.categoryTag}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.enable ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                      {s.enable ? "启用" : "停用"}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate">{s.baseUrl}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openGenerate(s)}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] bg-[#163f3a] text-white rounded-lg hover:bg-[#163f3a]/80"
                    title="生成一键爬虫脚本">
                    <Terminal className="w-3 h-3" /> 生成脚本
                  </button>
                  <button onClick={() => openEdit(s)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50" title="编辑">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setConfirmDel(s)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title="删除">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新增/编辑表单 */}
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
              <span className="text-xs text-gray-500">数据源名称 *</span>
              <input value={form.sourceName} onChange={(e) => setForm({ ...form, sourceName: e.target.value })}
                placeholder="如：人民日报" className={inputCls} />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">抓取根地址 *</span>
              <input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                placeholder="http://paper.people.com.cn/rmrb/pc/layout" className={inputCls} />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">绑定公文栏目</span>
              <select value={form.targetColumnId} onChange={(e) => setForm({ ...form, targetColumnId: e.target.value })}
                className={inputCls}>
                <option value="">（不绑定）</option>
                {allCats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">分类标签</span>
              <input value={form.categoryTag} onChange={(e) => setForm({ ...form, categoryTag: e.target.value })}
                placeholder="综合" className={inputCls} />
            </label>
            <label className="flex items-center gap-2 mt-6">
              <input type="checkbox" checked={form.enable}
                onChange={(e) => setForm({ ...form, enable: e.target.checked })} />
              <span className="text-xs text-gray-600">启用该数据源</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setShowForm(false)}
              className="px-4 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">取消</button>
            <button onClick={submit} disabled={!form.sourceName.trim() || !form.baseUrl.trim()}
              className="px-4 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300">保存</button>
          </div>
        </div>
      )}

      {/* 生成脚本弹窗 */}
      {genSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setGenSource(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[92vw] max-w-3xl h-[82vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[#163f3a]" />
                <h2 className="text-sm font-medium text-gray-800">一键爬虫脚本 · {genSource.sourceName}</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={copyCode} disabled={!genCode || genLoading}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                  {genCopyOk ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {genCopyOk ? "已复制" : "复制全部代码"}
                </button>
                <button onClick={downloadCode} disabled={!genCode || genLoading}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-[#163f3a] text-white rounded-lg hover:bg-[#163f3a]/80 disabled:opacity-50">
                  <Download className="w-3 h-3" /> 下载 crawler_task_{genSource.id}.py
                </button>
                <button onClick={() => setGenSource(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-[#1e1e1e] p-4">
              {genLoading ? (
                <p className="text-gray-400 text-xs">正在生成脚本…</p>
              ) : (
                <pre className="text-[11px] leading-relaxed text-gray-100 whitespace-pre"><code>{genCode}</code></pre>
              )}
            </div>
            <div className="px-5 py-2.5 border-t border-gray-200 text-[11px] text-gray-400 flex-shrink-0">
              运行：<code className="bg-gray-100 px-1 rounded">python3 crawler_task_{genSource.id}.py</code>
              （默认抓取当日理论版/评论版） · 密钥与后端地址已自动注入，本地不生成多余文件。
            </div>
          </div>
        </div>
      )}

      {/* 删除确认 */}
      <CustomDialog
        open={!!confirmDel}
        mode="confirm"
        title="删除数据源"
        message={confirmDel ? `确定删除「${confirmDel.sourceName}」？已入库文章不受影响，但爬虫将不再更新该源。` : ""}
        confirmText="确定删除"
        cancelText="取消"
        onConfirm={remove}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}
