// ─── Dashboard 布局 ──────────────────────────────
// 主应用页面（登录后）的通用布局
// 结构：左侧 Sidebar + 右侧 Topbar + 内容区

"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

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

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 左侧导航 */}
      <Sidebar collapsed={sidebarCollapsed} />

      {/* 右侧内容区 */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          title={title}
          onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
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
