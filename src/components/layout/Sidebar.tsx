// ─── 侧边栏导航 ──────────────────────────────────
// 左侧导航菜单，包含：公文编辑器、文档管理、模板管理、热点推送、系统设置

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  PenSquare,
  FileText,
  LayoutTemplate,
  Newspaper,
  Settings,
  Library,
  Trash2,
  Wand2,
  GitBranch,
} from "lucide-react";

// 导航菜单项定义
const navItems = [
  { href: "/home", label: "首页", icon: Home },
  { href: "/", label: "公文编辑器", icon: PenSquare },
  { href: "/documents", label: "文档管理", icon: FileText },
  { href: "/knowledge", label: "公文知识库", icon: Library },
  { href: "/templates", label: "模板管理", icon: LayoutTemplate },
  { href: "/hotspots", label: "热点推送", icon: Newspaper },
  { href: "/quick-draft", label: "一键初稿", icon: Wand2 },
  { href: "/trash", label: "回收站", icon: Trash2 },
  { href: "/settings", label: "系统设置", icon: Settings },
];

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();

  return (
    <aside
      className={`bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {/* Logo 区域 */}
      <div className="flex items-center gap-2 h-14 px-4 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-[#163f3a] flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-[#f6f4ef]">公</span>
        </div>
        {!collapsed && (
          <span className="font-semibold text-sm text-sidebar-foreground whitespace-nowrap">
            公文 AI 写作
          </span>
        )}
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 py-3 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname?.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? "bg-[#163f3a]/10 text-[#163f3a] font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
              title={item.label}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="text-sm truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* 底部：版本号 + GitHub */}
      {!collapsed && (
        <div className="p-3 border-t border-sidebar-border flex items-center justify-between">
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="flex items-center gap-2 text-xs text-sidebar-foreground/40 hover:text-[#163f3a] transition-colors group"
            title="查看源代码（GitHub）"
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span className="font-mono">dev-20260707</span>
          </a>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="w-6 h-6 rounded-full bg-[#e7e2d8] flex items-center justify-center hover:bg-[#163f3a] group transition-colors"
            title="GitHub 仓库"
          >
            {/* GitHub Octocat 简化图标 */}
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-sidebar-foreground/30 group-hover:fill-white transition-colors" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
          </a>
        </div>
      )}
    </aside>
  );
}
