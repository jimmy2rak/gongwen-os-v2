// ─── Dashboard 布局 ──────────────────────────────
// 主应用页面（登录后）的通用布局
// 结构：左侧 Sidebar + 右侧 Topbar + 内容区

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
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
  // 桌面端默认展开；移动端（<768px）默认折叠为离屏抽屉，避免首屏遮挡内容
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  const pathname = usePathname();

  // 移动端：路由切换后自动收起抽屉（桌面端 innerWidth>=768 不触发，零影响）
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarCollapsed(true);
    }
  }, [pathname]);

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* 左侧导航 */}
      <Sidebar collapsed={sidebarCollapsed} />

      {/* 移动端抽屉遮罩：仅 <768px 显示，点击收起抽屉；桌面端隐藏 */}
      {!sidebarCollapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setSidebarCollapsed(true)}
          aria-hidden="true"
        />
      )}

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
