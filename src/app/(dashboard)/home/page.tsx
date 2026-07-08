// ─── 首页总览仪表盘 ────────────────────────────
// 使用 stale-while-revalidate 本地缓存，导航回首页不闪烁加载。

"use client";

import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Link from "next/link";
import {
  FileText, FileSearch, CheckCircle, LayoutTemplate, Sparkles,
  TrendingUp, Clock, ArrowRight, BookOpen, PenSquare,
} from "lucide-react";

interface CacheItem {
  data: any;
  fetchedAt: number;
}
const _cache = new Map<string, CacheItem>();
const STALE_MS = 30_000; // 30 秒内不重新请求

function cachedFetch(key: string, fetcher: () => Promise<any>): Promise<any> {
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < STALE_MS) {
    return Promise.resolve(hit.data);
  }
  return fetcher().then((d) => {
    _cache.set(key, { data: d, fetchedAt: Date.now() });
    return d;
  });
}

export default function HomePage() {
  const [stats, setStats] = useState({
    totalDocs: 0, pendingReview: 0, reviewed: 0, templates: 0, skills: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentDocs, setRecentDocs] = useState<any[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    Promise.all([
      cachedFetch("docs:1", () => fetch("/api/documents?pageSize=1").then((r) => r.json())),
      cachedFetch("docs:reviewed", () => fetch("/api/documents?reviewed=true&pageSize=100").then((r) => r.json()).catch(() => ({ success: false }))),
      cachedFetch("docs:pending", () => fetch("/api/documents?reviewed=false&pageSize=100").then((r) => r.json()).catch(() => ({ success: false }))),
      cachedFetch("templates", () => fetch("/api/templates").then((r) => r.json())),
      cachedFetch("skills", () => fetch("/api/skills").then((r) => r.json())),
    ]).then(([docRes, reviewedRes, pendingRes, tplRes, skillRes]) => {
      if (!mounted.current) return;
      const allDocs = docRes.success ? (docRes.data?.items || docRes.data || []) : [];
      const docTotal = docRes.meta?.total ?? allDocs.length;
      const reviewedDocs = reviewedRes.success ? (reviewedRes.data?.items || reviewedRes.data || []) : [];
      const pendingDocs = pendingRes.success ? (pendingRes.data?.items || pendingRes.data || []) : [];
      const allTpls = tplRes.success ? (tplRes.data?.custom || []) : [];
      const allSkills = skillRes.success ? (skillRes.data || []) : [];

      setStats({
        totalDocs: docTotal,
        pendingReview: pendingDocs.length,
        reviewed: reviewedDocs.length,
        templates: 11 + allTpls.length,
        skills: allSkills.length,
      });
      setRecentDocs(allDocs.slice(0, 5));
      setLoading(false);
    }).catch(() => { if (mounted.current) setLoading(false); });
    return () => { mounted.current = false; };
  }, []);

  const cards = [
    { label: "文档总数", value: stats.totalDocs, icon: FileText, color: "#2563eb", bg: "#eff6ff", href: "/documents" },
    { label: "待审阅", value: stats.pendingReview, icon: FileSearch, color: "#d97706", bg: "#fffbeb", href: "/documents" },
    { label: "已审阅", value: stats.reviewed, icon: CheckCircle, color: "#059669", bg: "#f0fdf4", href: "/knowledge" },
    { label: "模板", value: stats.templates, icon: LayoutTemplate, color: "#7c3aed", bg: "#f5f3ff", href: "/templates" },
    { label: "Skill 规范", value: stats.skills, icon: Sparkles, color: "#0891b2", bg: "#ecfeff", href: "/settings?tab=skill" },
  ];

  const SkeletonCard = () => (
    <div className="bg-white rounded-xl border border-[#e7e2d8] p-4 animate-pulse">
      <div className="w-8 h-8 rounded-lg bg-gray-200 mb-3" />
      <div className="h-7 w-16 bg-gray-200 rounded mb-1" />
      <div className="h-3 w-12 bg-gray-100 rounded" />
    </div>
  );

  return (
    <DashboardLayout title="首页">
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {loading ? (
            <>
              <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
            </>
          ) : cards.map((c) => (
            <Link key={c.label} href={c.href}
              className="block bg-white rounded-xl border border-[#e7e2d8] p-4 hover:shadow-sm transition-shadow group">
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.bg }}>
                  <c.icon className="w-4 h-4" style={{ color: c.color }} />
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-200 group-hover:text-gray-400 transition-colors" />
              </div>
              <p className="text-2xl font-bold text-gray-800">{c.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
            </Link>
          ))}
        </div>

        {/* 第二行：最近文档 + 快捷入口 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 最近文档 */}
          <div className="bg-white rounded-xl border border-[#e7e2d8] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-400" /> 最近文档
              </h3>
              <Link href="/documents" className="text-[10px] text-[#163f3a] hover:underline">查看全部</Link>
            </div>
            {loading ? (
              <div className="text-xs text-gray-400 py-4 text-center">加载中...</div>
            ) : recentDocs.length === 0 ? (
              <div className="text-xs text-gray-400 py-4 text-center">暂无文档</div>
            ) : (
              <div className="space-y-1.5">
                {recentDocs.map((doc: any) => (
                  <Link key={doc.id} href={`/documents/${doc.id}`}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors group">
                    <FileText className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                    <span className="text-xs text-gray-700 truncate flex-1">{doc.title}</span>
                    <span className="text-[10px] text-gray-400">
                      {doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString("zh-CN") : ""}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* 快捷入口 */}
          <div className="bg-white rounded-xl border border-[#e7e2d8] p-4">
            <h3 className="text-xs font-medium text-gray-700 flex items-center gap-1.5 mb-3">
              <TrendingUp className="w-3.5 h-3.5 text-gray-400" /> 快捷入口
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/quick-draft/quick"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[#163f3a]/5 text-[#163f3a] hover:bg-[#163f3a]/10 transition-colors text-xs font-medium">
                <PenSquare className="w-4 h-4" /> 一键出稿
              </Link>
              <Link href="/templates"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors text-xs font-medium">
                <LayoutTemplate className="w-4 h-4" /> 模板管理
              </Link>
              <Link href="/documents"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-xs font-medium">
                <FileText className="w-4 h-4" /> 全部文档
              </Link>
              <Link href="/settings"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors text-xs font-medium">
                <Sparkles className="w-4 h-4" /> 系统设置
              </Link>
            </div>
          </div>
        </div>

        {/* 底部：使用提示 */}
        <div className="bg-gradient-to-r from-[#163f3a]/5 to-[#c9a55c]/10 rounded-xl border border-[#e7e2d8] p-4">
          <div className="flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-[#163f3a] mt-0.5" />
            <div>
              <p className="text-xs font-medium text-gray-700">使用提示</p>
              <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                在左侧编辑器中选中文字可使用 AI 助手进行续写/润色/缩写/扩写/解释/翻译。
                「一键初稿」可快速生成公文初稿并保存为文档。右侧「模板管理」中可设置当前使用的模板和写作规范 Skill。
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
