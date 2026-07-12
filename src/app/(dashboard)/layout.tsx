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
  const { user, isLoading, loadError, fetchUser } = useAuthStore();
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
  // 注意：loadError（网络/超时）时不跳转登录页，交由下方「重试」界面处理
  useEffect(() => {
    if (!isLoading && !user && !loadError) {
      router.replace("/login");
    }
  }, [user, isLoading, loadError, router]);

  // 加载中：转圈
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-400">加载中...</div>
      </div>
    );
  }

  // 网络/超时导致加载失败：展示「重试」，避免刷新时永久卡在加载中
  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4 px-6">
        <div className="text-sm text-gray-500">加载失败，可能是网络波动或服务启动中</div>
        <button
          onClick={() => fetchUser()}
          className="px-4 py-2 text-sm bg-[#163f3a] text-white rounded-lg hover:bg-[#0f2e2a]"
        >
          点击重试
        </button>
      </div>
    );
  }

  // 未登录：不渲染内容（由上方 effect 跳转到登录页）
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-400">加载中...</div>
      </div>
    );
  }

  // 已登录：正常显示内容
  return <>{children}</>;
}
