// ─── 爬虫热点文章展示页（读取 hot_article）────────
// 使用 stale-while-revalidate 缓存 + 骨架屏异步加载。

"use client";

import { useEffect, useState, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ExportMenu } from "@/components/editor/ExportMenu";
import { CategoryFilterPills } from "@/components/ui/CategoryFilterPills";
import { getAllCategories } from "@/types";
import {
  Newspaper, ExternalLink, Clock, Tag, RefreshCw, Eye, Star, FileText,
  Plus, X, CheckCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toggleFavorite } from "@/lib/favorite-store";

interface CacheItem { data: any; fetchedAt: number; }
const _cache = new Map<string, CacheItem>();
const STALE_MS = 30_000;

function cachedFetch(key: string, fetcher: () => Promise<any>): Promise<any> {
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < STALE_MS) return Promise.resolve(hit.data);
  return fetcher().then((d) => { _cache.set(key, { data: d, fetchedAt: Date.now() }); return d; });
}

interface HotArticleItem {
  id: string;
  sourceId: string | null;
  sourceName: string | null;
  columnId: string | null;
  title: string;
  contentPlain: string | null;
  contentHtml: string | null;
  pageName: string | null;
  originUrl: string | null;
  crawlDate: string | null;
  isPublished: number | boolean;
  createdAt: number;
}

export default function HotArticlesPage() {
  const router = useRouter();
  const [items, setItems] = useState<HotArticleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState<string>("");
  const [activeSrc, setActiveSrc] = useState<string>("");
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // 全屏 iframe 预览
  const [preview, setPreview] = useState<HotArticleItem | null>(null);
  // 收藏转文档弹窗
  const [favDialog, setFavDialog] = useState<HotArticleItem | null>(null);
  const [favCat, setFavCat] = useState<string>("通知");

  const allCats = getAllCategories();
  const mounted = useRef(true);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 2500);
  };

  const loadData = (skipCache = false) => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (activePage) qs.set("pageName", activePage);
    if (activeSrc) qs.set("sourceId", activeSrc);
    const url = `/api/hot-articles?${qs.toString()}`;
    const fetchFn = () => fetch(url).then((r) => r.json());
    const promise = skipCache ? fetchFn() : cachedFetch(url, fetchFn);
    promise
      .then((b) => { if (mounted.current && b.success) setItems((b.data as HotArticleItem[]) || []); })
      .catch(() => {})
      .finally(() => { if (mounted.current) setLoading(false); });
  };
  useEffect(() => { mounted.current = true; loadData(); return () => { mounted.current = false; };   }, [activePage, activeSrc]);

  // 去重后的筛选选项：版面（爬虫配置版块），不再回退到公文类型
  const pages = Array.from(new Set(items.map((i) => i.pageName).filter(Boolean) as string[])).sort();
  const srcs = Array.from(new Set(items.map((i) => i.sourceName).filter(Boolean) as string[])).sort();

  // ── 收藏转文档（收藏到文档管理） ──
  const handleFavToDoc = async () => {
    if (!favDialog) return;
    try {
      const bodyHtml = favDialog.contentHtml || `<p>${(favDialog.contentPlain || "").replace(/\n/g, "<br>")}</p>`;
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: favDialog.title,
          category: favCat,
          content: `<div data-type="doc-title">${favDialog.title}</div>${bodyHtml}`,
          format: "simple",
        }),
      });
      const b = await res.json();
      if (b.success) {
        // 同步收藏到文档管理（favorite-store）
        toggleFavorite(b.data.id);
        showToast("success", "已转入文档管理并收藏");
        if (b.data?.id) router.push(`/documents/${b.data.id}`);
      } else {
        showToast("error", "创建文档失败");
      }
    } catch {
      showToast("error", "网络错误");
    }
    setFavDialog(null);
  };

  // ── 仅保存到文档管理（不收藏） ──
  const handleSaveAsDocWithoutFav = async (item: HotArticleItem) => {
    try {
      const bodyHtml = item.contentHtml || `<p>${(item.contentPlain || "").replace(/\n/g, "<br>")}</p>`;
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.title,
          category: item.columnId || "通知",
          content: `<div data-type="doc-title">${item.title}</div>${bodyHtml}`,
          format: "simple",
        }),
      });
      const b = await res.json();
      if (b.success) {
        showToast("success", "已保存到文档管理");
        if (b.data?.id) router.push(`/documents/${b.data.id}`);
      } else {
        showToast("error", "创建文档失败");
      }
    } catch {
      showToast("error", "网络错误");
    }
  };

  // ── 编辑为文档（旧逻辑：创建+收藏） ──
  const handleEditAsDoc = async (item: HotArticleItem) => {
    try {
      const bodyHtml = item.contentHtml || `<p>${(item.contentPlain || "").replace(/\n/g, "<br>")}</p>`;
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.title,
          category: item.columnId || "通知",
          content: `<div data-type="doc-title">${item.title}</div>${bodyHtml}`,
          format: "simple",
        }),
      });
      const b = await res.json();
      if (b.success && b.data?.id) {
        showToast("success", "已创建文档");
        router.push(`/documents/${b.data.id}`);
      }
    } catch {
      showToast("error", "创建文档失败");
    }
  };

  const fmtTime = (ts: number) => {
    const d = new Date(ts * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  // iframe 预览内容：渲染公文样式 + 黑暗模式适配
  const previewSrcDoc = preview
    ? `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Noto Serif SC", "SimSun", "STSong", serif;
    padding: 48px 56px;
    max-width: 780px;
    margin: 0 auto;
    line-height: 1.9;
    font-size: 16px;
    color: #2b2722;
    background: #f6f4ef;
  }
  /* 正文渲染 */
  [data-type="doc-title"],
  h1, h2, h3, h4 { text-align: center; font-weight: 600; line-height: 1.6; margin-bottom: 1.2em; }
  [data-type="doc-title"] { font-size: 22px; }
  p { text-indent: 2em; margin-bottom: 0.8em; text-align: justify; }
  /* 公文正文样式 */
  .gongwen-content p { text-indent: 2em; margin-bottom: 0.8em; text-align: justify; }
  .gongwen-content h2 { font-size: 18px; margin-top: 1.5em; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; font-size: 14px; }
  th { background: #f0ede6; font-weight: 600; }
  /* 黑暗模式 */
  @media (prefers-color-scheme: dark) {
    body { background: #1a1e1d; color: #e8e4db; }
    th { background: #2a2e2d; }
    th, td { border-color: #3a3e3d; }
    a { color: #c9a55c; }
  }
  /* 图片自适应 */
  img { max-width: 100%; height: auto; display: block; margin: 1em auto; }
  blockquote { border-left: 3px solid #c9a55c; padding-left: 16px; margin: 1em 0; color: #666; }
  @media (prefers-color-scheme: dark) { blockquote { color: #aaa; } }
  /* 列表 */
  ul, ol { padding-left: 2em; margin-bottom: 0.8em; }
  li { margin-bottom: 0.3em; }
</style>
</head><body>
  <div class="gongwen-content">
    ${preview.contentHtml || `<p>${(preview.contentPlain || "（无正文）").replace(/\n/g, "</p><p>")}</p>`}
  </div>
</body></html>`
    : "";

  // 点击文章行任意位置进入预览
  const handleRowClick = (item: HotArticleItem) => {
    setPreview(item);
  };

  return (
    <DashboardLayout title="热点推送">
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
        {/* 头部 — 统一标题 "热点推送"，无副标题 */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">热点推送</h2>
          <button onClick={() => loadData(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            <RefreshCw className="w-3 h-3" /> 刷新
          </button>
        </div>

        {/* 筛选栏 — 栏目 pill + 来源下拉 */}
        <div className="flex items-center gap-2 flex-wrap">
          <CategoryFilterPills
            active={activePage}
            items={pages}
            onChange={(cat) => setActivePage(cat)}
          />
          <span className="text-[10px] text-gray-300">|</span>
          <select value={activeSrc} onChange={(e) => setActiveSrc(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#163f3a]/30">
            <option value="">全部来源</option>
            {srcs.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* 列表 */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-[#e7e2d8] p-4 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-full mb-1" />
                    <div className="h-3 bg-gray-100 rounded w-1/2" />
                    <div className="flex gap-3 mt-2">
                      <div className="h-3 w-20 bg-gray-100 rounded" />
                      <div className="h-3 w-16 bg-gray-100 rounded" />
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <div className="w-7 h-7 bg-gray-100 rounded" />
                    <div className="w-7 h-7 bg-gray-100 rounded" />
                    <div className="w-7 h-7 bg-gray-100 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 bg-gray-50/80 rounded-xl border border-dashed border-gray-200">
            <Newspaper className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">暂无热点文章，请等待超管运行爬虫入库</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-[#e7e2d8] p-4 hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => handleRowClick(item)}
              >
                <div className="flex flex-col md:flex-row md:items-start gap-2 md:gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-800 leading-relaxed">{item.title}</h3>
                    <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{item.contentPlain?.slice(0, 120) || "（无摘要）"}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap text-[10px] text-gray-400">
                      {item.crawlDate && <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{item.crawlDate}</span>}
                      {item.sourceName && <span className="flex items-center gap-1"><Tag className="w-2.5 h-2.5" />{item.sourceName}</span>}
                      {item.pageName && <span className="px-1.5 py-0.5 bg-gray-100 rounded">{item.pageName}</span>}
                      {item.columnId && <span className="px-1.5 py-0.5 bg-[#163f3a]/10 text-[#163f3a] rounded">{item.columnId}</span>}
                    </div>
                  </div>
                  {/* 操作按钮 — 阻止点击冒泡，以免触发行点击预览 */}
                  <div className="flex items-center gap-1 flex-shrink-0 mt-2 md:mt-0 justify-end md:justify-start" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setPreview(item)}
                      className="p-1.5 rounded text-gray-400 hover:text-cyan-600 hover:bg-cyan-50" title="全屏预览">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <ExportMenu title={item.title} content={item.contentPlain || item.title} size="sm" />
                    <button onClick={() => handleEditAsDoc(item)}
                      className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50" title="创建为文档">
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                    {/* 加号图标：仅保存到文档管理，不收藏 */}
                    <button onClick={() => handleSaveAsDocWithoutFav(item)}
                      className="p-1.5 rounded text-gray-400 hover:text-green-600 hover:bg-green-50" title="仅保存到文档管理（不收藏）">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    {/* 星星图标：收藏（和文档管理一致） */}
                    <button onClick={() => { setFavCat(item.columnId || "通知"); setFavDialog(item); }}
                      className="p-1.5 rounded text-gray-300 hover:text-amber-400 hover:bg-amber-50" title="收藏为文档">
                      <Star className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 全屏 iframe 预览（非弹窗）── */}
      {preview && (
        <div className="fixed inset-0 z-[80] bg-black flex flex-col">
          <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Eye className="w-4 h-4 text-cyan-600" />
              <h2 className="text-sm font-medium text-gray-800 truncate">热点推送 · {preview.title}</h2>
              {preview.originUrl && (
                <a href={preview.originUrl} target="_blank" rel="noreferrer"
                  className="text-xs text-blue-500 hover:underline flex items-center gap-0.5">
                  <ExternalLink className="w-3 h-3" /> 原文
                </a>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => handleEditAsDoc(preview)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-[#163f3a] text-white rounded-lg hover:bg-[#163f3a]/80">
                <FileText className="w-3 h-3" /> 创建为文档
              </button>
              <button onClick={() => { setFavCat(preview.columnId || "通知"); setFavDialog(preview); }}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600">
                <Star className="w-3 h-3" /> 收藏
              </button>
              <button onClick={() => setPreview(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100" title="关闭">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <iframe
            title={preview.title}
            srcDoc={previewSrcDoc}
            className="flex-1 w-full"
            sandbox="allow-same-origin"
          />
        </div>
      )}

      {/* ── 收藏转文档弹窗 ── */}
      {favDialog && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40" onClick={() => setFavDialog(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-96 max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Star className="w-5 h-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-gray-800">收藏为公文文档</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-1">{favDialog.title}</p>
              </div>
            </div>
            <label className="block mb-4">
              <span className="text-xs text-gray-500">选择公文类型</span>
              <select value={favCat} onChange={(e) => setFavCat(e.target.value)}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-red-300">
                {allCats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <div className="flex gap-2">
              <button onClick={handleFavToDoc}
                className="flex-1 px-4 py-2 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700">
                确认收藏
              </button>
              <button onClick={() => setFavDialog(null)}
                className="flex-1 px-4 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-2.5 rounded-xl shadow-lg text-xs flex items-center gap-2 ${
          toast.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {toast.type === "success" ? <CheckCircle className="w-4 h-4" /> : "✗"} {toast.msg}
        </div>
      )}
    </DashboardLayout>
  );
}
