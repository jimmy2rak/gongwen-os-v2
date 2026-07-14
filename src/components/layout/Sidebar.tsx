// ─── 侧边栏导航 ──────────────────────────────────
// 左侧导航菜单，包含：公文编辑器、文档管理、模板管理、热点推送、系统设置
// 顶部 logo 区域替换为「当前用户头像 + 昵称」，点击展开下拉（修改资料 / 退出登录）

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  ChevronDown,
  LogOut,
  UserCog,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";

// 构建时自动注入的版本号（见 scripts/gen-version.mjs）
import { APP_VERSION } from "../../lib/version";

// 项目仓库地址（GitHub 猫图标 / 分支版本号点击跳转）
const REPO_URL = "https://github.com/jimmy2rak/gongwen-os-v2";

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

function UserAvatar({ src, name, email }: { src?: string | null; name?: string | null; email?: string | null }) {
  if (src) {
    return <img src={src} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />;
  }
  const initial = (name || email || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-[#163f3a] text-white flex items-center justify-center text-xs font-medium flex-shrink-0">
      {initial}
    </div>
  );
}

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    window.location.href = "/login";
  };

  const goProfile = () => {
    setMenuOpen(false);
    // 跳转到真实可用的「账户资料」修改页（昵称/邮箱/密码等）
    router.push("/account");
  };

  const displayName = user?.name || user?.email || "未登录";

  return (
    <aside
      className={`bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      {/* 用户身份区域（替代原 Logo 标题） */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => !collapsed && setMenuOpen((o) => !o)}
          className="flex items-center gap-2 h-14 px-4 border-b border-sidebar-border w-full hover:bg-sidebar-accent transition-colors"
        >
          <UserAvatar src={user?.avatar} name={user?.name} email={user?.email} />
          {!collapsed && (
            <>
              <span className="font-medium text-sm text-sidebar-foreground truncate flex-1 text-left">
                {displayName}
              </span>
              <ChevronDown className={`w-4 h-4 text-sidebar-foreground/50 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
            </>
          )}
        </button>

        {/* 下拉菜单：修改资料 / 退出登录（仅展开态显示） */}
        {!collapsed && menuOpen && (
          <div className="absolute left-3 right-3 top-14 mt-1 bg-popover border border-sidebar-border rounded-lg shadow-lg py-1 z-50">
            <button
              onClick={goProfile}
              className="flex items-center gap-2 w-full px-3 py-2.5 min-h-[44px] text-sm text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <UserCog className="w-4 h-4" />
              修改资料
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2.5 min-h-[44px] text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
              退出登录
            </button>
          </div>
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
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-sidebar-foreground/40 hover:text-[#163f3a] transition-colors group"
            title={`查看源代码（GitHub）· ${APP_VERSION}`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span className="font-mono">{APP_VERSION}</span>
          </a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
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
