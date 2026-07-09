// ─── Dashboard 布局 ──────────────────────────────
// 主应用页面（登录后）的通用布局
// 结构：左侧 Sidebar + 右侧 Topbar + 内容区
// 响应式：桌面端保持现有三栏布局，移动端侧栏改为覆盖层

"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { X } from "lucide-react";

export function DashboardLayout({
  title,
  children,
  headerSlot,
}: {
  title: string;
  children: React.ReactNode;
  /** 顶部标题右侧的插槽，可以放操作按钮 */
  headerSlot?: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleToggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
    setMobileSidebarOpen(!mobileSidebarOpen);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── 桌面端侧边栏（md 以上显示，手机端隐藏） ── */}
      <div className="hidden md:flex">
        <Sidebar collapsed={sidebarCollapsed} />
      </div>

      {/* ── 手机端侧边栏覆盖层 ── */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* 半透明遮罩 */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={handleToggleSidebar}
          />
          {/* 侧栏面板 */}
          <div className="fixed inset-y-0 left-0 z-50 shadow-2xl">
            <Sidebar collapsed={false} />
          </div>
          {/* 右上角关闭按钮 */}
          <button
            onClick={handleToggleSidebar}
            className="fixed top-3 right-3 z-50 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-md text-gray-600 hover:text-gray-900 md:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── 右侧内容区 ── */}
      <div className="flex-1 flex flex-col min-w-0 w-full">
        <Topbar
          title={title}
          onToggleSidebar={handleToggleSidebar}
          headerSlot={headerSlot}
        />

        {/* 主内容区 */}
        <main className="flex-1 overflow-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
