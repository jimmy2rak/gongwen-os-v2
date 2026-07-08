// ─── 主应用页面布局 ──────────────────────────────
// 所有登录后的页面共享这个布局
// 页面文件放在 (dashboard) 文件夹下面的会自动使用这个布局

"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";

export default function DashboardPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, fetchUser } = useAuthStore();
  const router = useRouter();
  const fetched = useRef(false);

  // 页面加载时获取用户信息，只执行一次
  useEffect(() => {
    if (!fetched.current) {
      fetched.current = true;
      fetchUser();
    }
  }, [fetchUser]);

  // 未登录时跳转（用 useEffect 避免渲染时更新 Router 组件）
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [user, isLoading, router]);

  // 加载中或未登录：不渲染内容
  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-400">加载中...</div>
      </div>
    );
  }

  // 已登录：正常显示内容
  return <>{children}</>;
}
