// ─── 顶部导航栏 ──────────────────────────────────
// 显示页面标题 + 用户信息 + 退出按钮

"use client";

import { useAuthStore } from "@/stores/auth.store";
import { LogOut, User, Menu, Home } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export function Topbar({
  title,
  onToggleSidebar,
  headerSlot,
}: {
  title: string;
  onToggleSidebar: () => void;
  /** 标题右侧可以插入额外的按钮（如"保存""导出"等） */
  headerSlot?: React.ReactNode;
}) {
  const { user, logout } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击其他地方时关闭用户菜单
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    // 使用 window.location.href 强制全页跳转，确保中间件重新检查 Cookie
    // 如果用 router.push()，Next.js 客户端导航不会重新触发中间件
    window.location.href = "/login";
  };

  return (
    <header className="h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4">
      {/* 左侧：菜单按钮 + 标题 + 工具栏插槽 */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 flex-shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-medium text-sidebar-foreground flex-shrink-0">{title}</h1>
        {headerSlot && (
          <div className="flex items-center gap-2 min-w-0 flex-shrink">
            {headerSlot}
          </div>
        )}
      </div>

      {/* 右侧：用户信息 */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* 首页图标 */}
        <a href="/home"
          className="p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
          title="首页">
          <Home className="w-4 h-4" />
        </a>
        {user && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-sidebar-accent text-sm text-sidebar-foreground/80"
            >
              <User className="w-4 h-4" />
              <span>{user.name || user.email}</span>
            </button>

            {/* 下拉菜单 */}
            {showUserMenu && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-popover border border-sidebar-border rounded-lg shadow-lg py-1 z-50">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent"
                >
                  <LogOut className="w-4 h-4" />
                  退出登录
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
