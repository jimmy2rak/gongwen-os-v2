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
import { useAuthStore } from "@/stores/auth.store";
import { getCachedData, writePreload } from "@/lib/preload-cache";
import { AddQuoteDialog } from "@/components/quotations/AddQuoteDialog";
import { useQuotationStore } from "@/stores/quotation.store";
import type { Quote } from "@/lib/quotations/types";

interface CacheItem { data: any; fetchedAt: number; }
const _cache = new Map<string, CacheItem>();
const STALE_MS = 30_000;

function cachedFetch(key: string, fetcher: () => Promise<any>): Promise<any> {
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < STALE_MS) return Promise.resolve(hit.data);
  return fetcher().then((d) => { _cache.set(key, { data: d, fetchedAt: Date.now() }); return d; });
}

// ── 金句高亮样式（iframe 内联，与主站 quote.css 一致）──
const QUOTE_CSS = `
.gw-quote{position:relative;border-radius:2px;transition:background-color .15s ease;cursor:pointer}
.gw-ch-start{position:relative}
.gw-ch-start::before{content:"";position:absolute;top:-0.5em;left:-0.4em;width:7px;height:7px;border-radius:50%;background:#f5c518;box-shadow:0 0 0 1.5px #fff;z-index:3}
.gw-ch-end{position:relative}
.gw-ch-end::after{content:"";position:absolute;top:-0.5em;right:-0.4em;width:7px;height:7px;border-radius:50%;background:#f5c518;box-shadow:0 0 0 1.5px #fff;z-index:3}
.gw-quote:hover{background-color:rgba(147,51,234,0.18)}
@keyframes gwFlash{0%{background-color:rgba(245,197,24,0.45)}100%{background-color:transparent}}
.gw-locate-flash{animation:gwFlash 1.6s ease}
`;

// ── iframe 内金句脚本：高亮 + 选区气泡(postMessage) + 定位闪烁 ──
const QUOTE_SCRIPT = `
(function(){
  var quotes = window.__GW_QUOTES__ || [];
  var locate = window.__GW_LOCATE__ || "";
  function clearHighlights(root){
    var els = root.querySelectorAll('span.gw-quote');
    for(var i=0;i<els.length;i++){ var el=els[i]; var p=el.parentNode; if(!p) continue; while(el.firstChild) p.insertBefore(el.firstChild, el); p.removeChild(el); }
  }
  function wrapFirst(root, text){
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function(n){
        var tag = (n.parentNode && n.parentNode.tagName);
        if(tag==='SCRIPT'||tag==='STYLE') return NodeFilter.FILTER_REJECT;
        if(n.parentNode && n.parentNode.closest && n.parentNode.closest('.gw-quote')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var node;
    while((node = walker.nextNode())){
      var tn = node; var idx = tn.nodeValue ? tn.nodeValue.indexOf(text) : -1;
      if(idx !== -1){
        try {
          var range = document.createRange();
          range.setStart(tn, idx); range.setEnd(tn, idx+text.length);
          var span = document.createElement('span'); span.className='gw-quote';
          range.surroundContents(span);
          var first = span.firstChild;
          if(first && first.nodeType===3){
            var len = first.nodeValue.length;
            if(len<=1){ var w=document.createElement('span'); w.className='gw-ch gw-ch-start'; w.textContent=first.nodeValue; span.replaceChild(w, first); }
            else {
              var r1=document.createRange(); r1.setStart(first,0); r1.setEnd(first,1);
              var s1=document.createElement('span'); s1.className='gw-ch gw-ch-start'; r1.surroundContents(s1);
              var rest=s1.nextSibling;
              if(rest && rest.nodeType===3 && rest.nodeValue && rest.nodeValue.length>=1){
                var r2=document.createRange(); r2.setStart(rest, rest.nodeValue.length-1); r2.setEnd(rest, rest.nodeValue.length);
                var s2=document.createElement('span'); s2.className='gw-ch gw-ch-end'; r2.surroundContents(s2);
              }
            }
          }
        } catch(e){}
        return;
      }
    }
  }
  function apply(){
    var root = document.querySelector('.gongwen-content');
    if(!root) return;
    clearHighlights(root);
    for(var i=0;i<quotes.length;i++){ if(quotes[i].content) wrapFirst(root, quotes[i].content); }
    if(locate){
      var matches = root.querySelectorAll('span.gw-quote'); var target=null;
      for(var j=0;j<matches.length;j++){ if(!target && (matches[j].textContent||'').indexOf(locate)>=0) target=matches[j]; }
      if(!target){ var ps = root.querySelectorAll('p,li,div'); for(var k=0;k<ps.length;k++){ if(!target && (ps[k].textContent||'').indexOf(locate)>=0) target=ps[k]; } }
      if(target){ target.scrollIntoView({behavior:'smooth', block:'center'}); target.classList.add('gw-locate-flash'); setTimeout(function(){ target.classList.remove('gw-locate-flash'); }, 1700); }
    }
  }
  // 读取当前选区并浮出「添加金句」气泡（桌面/移动端通用）
  function showBubble(){
    var sel = window.getSelection();
    if(!sel || sel.isCollapsed || sel.rangeCount===0){ hideBubble(); return; }
    var text = sel.toString().trim();
    if(!text || text.length<2){ hideBubble(); return; }
    var range = sel.getRangeAt(0);
    var rect = range.getBoundingClientRect();
    if(rect.width===0 && rect.height===0){ hideBubble(); return; }
    var bubble = document.getElementById('gw-bubble');
    if(!bubble){
      bubble = document.createElement('div');
      bubble.id='gw-bubble';
      bubble.style.cssText='position:fixed;z-index:9999;display:flex;align-items:center;gap:4px;padding:6px 10px;font-size:13px;color:#fff;background:#f59e0b;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.25);cursor:pointer;-webkit-user-select:none;user-select:none';
      bubble.innerHTML='✦ 添加金句';
      document.body.appendChild(bubble);
    }
    var top = rect.top - 40; if(top<8) top = rect.bottom + 8;
    bubble.style.top = top + 'px';
    bubble.style.left = Math.min(Math.max(rect.left + rect.width/2 - 40, 8), (window.innerWidth||800)-100) + 'px';
    // 用捕获的 text，避免移动端点按气泡时选区已折叠
    bubble.onmousedown = function(e){ e.preventDefault(); };
    bubble.ontouchstart = function(e){ e.preventDefault(); };
    var send = function(){
      parent.postMessage({ type:'gw-add-quote', text: text, sourceId: window.__GW_SRC__ ? window.__GW_SRC__.id : '', sourceTitle: window.__GW_SRC__ ? window.__GW_SRC__.title : '' }, '*');
      hideBubble();
    };
    bubble.onclick = send;
    bubble.style.display='flex';
  }
  function hideBubble(){ var b=document.getElementById('gw-bubble'); if(b) b.style.display='none'; }
  // selectionchange 是移动端最可靠的主检测（长按+拖动手柄）；防抖等选区稳定
  var selTimer=null;
  document.addEventListener('selectionchange', function(){
    if(selTimer) clearTimeout(selTimer);
    selTimer = setTimeout(showBubble, 300);
  });
  // 指针抬起后即时补充确认
  document.addEventListener('mouseup', function(){ setTimeout(showBubble, 20); });
  document.addEventListener('touchend', function(){ setTimeout(showBubble, 20); });
  if(document.readyState!=='loading') apply(); else document.addEventListener('DOMContentLoaded', apply);
})();
`;

function buildHotspotSrcDoc(item: HotArticleItem, quotes: Quote[], locate: string): string {
  const body = item.contentHtml || `<p>${(item.contentPlain || "（无正文）").replace(/\n/g, "</p><p>")}</p>`;
  const esc = (s: string) => s.replace(/</g, "\\u003c");
  const quotesJson = esc(JSON.stringify(quotes.map((q) => ({ id: q.id, content: q.content }))));
  const srcJson = esc(JSON.stringify({ id: item.id, title: item.title }));
  const locateJson = esc(JSON.stringify(locate || ""));
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
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
  [data-type="doc-title"],
  h1, h2, h3, h4 { text-align: center; font-weight: 600; line-height: 1.6; margin-bottom: 1.2em; }
  [data-type="doc-title"] { font-size: 22px; }
  p { text-indent: 2em; margin-bottom: 0.8em; text-align: justify; }
  .gongwen-content p { text-indent: 2em; margin-bottom: 0.8em; text-align: justify; }
  .gongwen-content h2 { font-size: 18px; margin-top: 1.5em; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; font-size: 14px; }
  th { background: #f0ede6; font-weight: 600; }
  @media (prefers-color-scheme: dark) {
    body { background: #1a1e1d; color: #e8e4db; }
    th { background: #2a2e2d; }
    th, td { border-color: #3a3e3d; }
    a { color: #c9a55c; }
  }
  img { max-width: 100%; height: auto; display: block; margin: 1em auto; }
  blockquote { border-left: 3px solid #c9a55c; padding-left: 16px; margin: 1em 0; color: #666; }
  @media (prefers-color-scheme: dark) { blockquote { color: #aaa; } }
  ul, ol { padding-left: 2em; margin-bottom: 0.8em; }
  li { margin-bottom: 0.3em; }
</style>
<style>${QUOTE_CSS}</style>
</head><body>
  <div class="gongwen-content">
    ${body}
  </div>
  <script>window.__GW_QUOTES__=${quotesJson};window.__GW_SRC__=${srcJson};window.__GW_LOCATE__=${locateJson};</script>
  <script>${QUOTE_SCRIPT}</script>
</body></html>`;
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
  const [activeSrc, setActiveSrc] = useState<string>("");
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // 全屏 iframe 预览
  const [preview, setPreview] = useState<HotArticleItem | null>(null);
  // 收藏转文档弹窗
  const [favDialog, setFavDialog] = useState<HotArticleItem | null>(null);
  const [favCat, setFavCat] = useState<string>("通知");

  // 金句：当前账号全部金句（用于热点文章内高亮）、添加弹窗、定位闪烁
  const [allQuotes, setAllQuotes] = useState<Quote[]>([]);
  const [quoteAdd, setQuoteAdd] = useState<{ text: string; sourceId: string; sourceTitle: string } | null>(null);
  const [locateContent, setLocateContent] = useState("");
  const pendingRef = useRef<{ sourceId: string; content: string } | null>(null);
  const locatedRef = useRef(false);

  const allCats = getAllCategories();
  const mounted = useRef(true);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 2500);
  };

  const loadData = (skipCache = false) => {
    const userId = useAuthStore.getState().user?.id;
    // 先读本地预加载缓存，秒开
    const cached = getCachedData<{ data: HotArticleItem[] }>(userId, "hotspots");
    if (cached?.data?.length) {
      setItems(cached.data);
      setLoading(false);
    } else {
      setLoading(true);
    }
    const fetchFn = () => fetch("/api/hot-articles").then((r) => r.json());
    const promise = skipCache ? fetchFn() : cachedFetch("/api/hot-articles", fetchFn);
    promise
      .then((b) => {
        if (mounted.current && b.success) {
          const list = (b.data as HotArticleItem[]) || [];
          setItems(list);
          writePreload(userId, "hotspots", { success: true, data: list });
        }
      })
      .catch(() => {})
      .finally(() => { if (mounted.current) setLoading(false); });
  };
  useEffect(() => { mounted.current = true; loadData(); return () => { mounted.current = false; };   }, []);

  // 拉取当前账号全部金句（用于热点文章内高亮）
  const refreshQuotes = () => {
    fetch("/api/quotations").then((r) => r.json()).then((b) => { if (b.success) setAllQuotes(b.data || []); }).catch(() => {});
  };
  useEffect(() => { refreshQuotes(); }, []);

  // 监听 iframe 内「添加金句」选区气泡消息
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data && e.data.type === "gw-add-quote") {
        setQuoteAdd({ text: e.data.text || "", sourceId: e.data.sourceId || "", sourceTitle: e.data.sourceTitle || "" });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // 从金句库跳转定位：读取 pendingLocate，文章加载后自动打开并定位
  useEffect(() => {
    const pl = useQuotationStore.getState().pendingLocate;
    if (pl) { pendingRef.current = pl; useQuotationStore.getState().clearPendingLocate(); }
  }, []);
  useEffect(() => {
    if (pendingRef.current && !locatedRef.current && items.length && !preview) {
      const art = items.find((i) => i.id === pendingRef.current!.sourceId);
      if (art) { locatedRef.current = true; setLocateContent(pendingRef.current.content); setPreview(art); }
    }
  }, [items]);

  // 去重后的筛选选项：来源（人民日报 / 新华网 等大分类）
  const srcs = Array.from(new Set(items.map((i) => i.sourceName).filter(Boolean) as string[])).sort();
  // 客户端按来源筛选（不依赖 API 的 source_id 字段，保证 pill 一定生效）
  const visibleItems = activeSrc ? items.filter((i) => i.sourceName === activeSrc) : items;

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

  // iframe 预览内容：渲染公文样式 + 黑暗模式适配 + 金句高亮/选区气泡
  const articleQuotes = preview
    ? allQuotes.filter((q) => q.sourceType === "hotspot" && q.sourceId === preview.id)
    : [];
  const previewSrcDoc = preview ? buildHotspotSrcDoc(preview, articleQuotes, locateContent) : "";

  // 记录列表滚动位置，关闭阅读视图后恢复原位
  const scrollPosRef = useRef(0);

  // 打开内嵌阅读视图（铺满内容区，替换列表）
  const openPreview = (item: HotArticleItem) => {
    const main = document.querySelector("main");
    scrollPosRef.current = main ? main.scrollTop : 0;
    setPreview(item);
  };

  // 点击文章行任意位置进入阅读视图
  const handleRowClick = (item: HotArticleItem) => {
    openPreview(item);
  };

  // 关闭阅读视图时恢复列表滚动位置
  useEffect(() => {
    if (!preview) {
      const main = document.querySelector("main");
      if (main) requestAnimationFrame(() => { main.scrollTop = scrollPosRef.current; });
    }
  }, [preview]);

  return (
    <DashboardLayout title="热点推送">
      {preview ? (
        /* ── 内嵌阅读视图：铺满内容区，非全屏弹窗；关闭后列表滚动位置不变 ── */
        <div className="h-full flex flex-col bg-background">
          <div className="flex items-center justify-between px-4 md:px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Eye className="w-4 h-4 text-cyan-600 flex-shrink-0" />
              <h2 className="text-sm font-medium text-gray-800 truncate">热点推送 · {preview.title}</h2>
              {preview.originUrl && (
                <a href={preview.originUrl} target="_blank" rel="noreferrer"
                  className="text-xs text-blue-500 hover:underline flex items-center gap-0.5 flex-shrink-0">
                  <ExternalLink className="w-3 h-3" /> 原文
                </a>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
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
            className="flex-1 w-full min-h-0 bg-white"
            sandbox="allow-scripts"
          />
        </div>
      ) : (
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
        {/* 头部 — 统一标题 "热点推送"，无副标题 */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">热点推送</h2>
          <button onClick={() => loadData(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            <RefreshCw className="w-3 h-3" /> 刷新
          </button>
        </div>

        {/* 筛选栏 — 来源 pill 菜单（人民日报 / 新华网 等大分类） */}
        <div className="flex items-center gap-2 flex-wrap">
          <CategoryFilterPills
            active={activeSrc}
            items={srcs}
            onChange={(cat) => setActiveSrc(cat)}
            allLabel="全部来源"
          />
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
        ) : visibleItems.length === 0 ? (
          <div className="text-center py-16 bg-gray-50/80 rounded-xl border border-dashed border-gray-200">
            <Newspaper className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">暂无热点文章，请等待超管运行爬虫入库</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleItems.map((item) => (
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
                      {item.columnId && <span className="px-1.5 py-0.5 bg-[#163f3a]/10 text-[#163f3a] rounded">{item.columnId}</span>}
                    </div>
                  </div>
                  {/* 操作按钮 — 阻止点击冒泡，以免触发行点击预览 */}
                  <div className="flex items-center gap-1 flex-shrink-0 mt-2 md:mt-0 justify-end md:justify-start" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openPreview(item)}
                      className="p-1.5 rounded text-gray-400 hover:text-cyan-600 hover:bg-cyan-50" title="阅读">
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

      {/* 热点文章内选区 → 添加金句（来自 iframe postMessage） */}
      <AddQuoteDialog
        open={!!quoteAdd}
        onClose={() => setQuoteAdd(null)}
        defaultText={quoteAdd?.text || ""}
        sourceType="hotspot"
        sourceId={quoteAdd?.sourceId || ""}
        sourceTitle={quoteAdd?.sourceTitle || ""}
        onAdded={refreshQuotes}
      />
    </DashboardLayout>
  );
}
