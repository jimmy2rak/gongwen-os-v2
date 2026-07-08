// ─── 一键初稿 二级导航 ──────────────────────────

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PenLine, ListTree, ListChecks, History, Download } from "lucide-react";

const ITEMS = [
  { href: "/quick-draft", label: "工作台", icon: LayoutDashboard, exact: true },
  { href: "/quick-draft/quick", label: "出稿", icon: PenLine },
  { href: "/quick-draft/outline", label: "大纲", icon: ListTree },
  { href: "/quick-draft/tasks", label: "任务", icon: ListChecks },
  { href: "/quick-draft/recent", label: "最近", icon: History },
  { href: "/quick-draft/export", label: "导出", icon: Download },
];

export function QuickDraftNav() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1 px-6 py-2.5 border-b border-gray-200 bg-white overflow-x-auto">
      {ITEMS.map((it) => {
        const on = it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(it.href + "/");
        const Icon = it.icon;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${
              on ? "bg-red-50 text-red-700 font-medium" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}
