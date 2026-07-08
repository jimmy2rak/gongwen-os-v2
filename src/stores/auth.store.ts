// ─── 用户认证状态管理 ──────────────────────────────
// 使用 Zustand 管理前端登录状态
// 为什么不存到 localStorage？因为 JWT 存在 HTTP-only Cookie 中，
// JS 无法读取，所以用 Zustand store 跟踪"是否登录"这个状态就够了。

import { create } from "zustand";

export interface User {
  id: string;
  email: string;
  name: string | null;
}

interface AuthState {
  user: User | null;         // 当前登录用户，null = 未登录
  isLoading: boolean;        // 是否正在加载用户信息（首次打开页面时）

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;

  // 从服务端获取当前用户
  fetchUser: () => Promise<void>;

  // 退出登录
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true, // 初始为 true，页面加载时会立刻请求 /api/auth/me

  setUser: (user) => set({ user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),

  // 调用 /api/auth/me 获取当前用户
  fetchUser: async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const body = await res.json();
        if (body.success && body.data) {
          set({ user: body.data, isLoading: false });
          return;
        }
      }
      set({ user: null, isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },

  // 调用 /api/auth/logout 退出
  logout: async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // 即使请求失败，也清除本地状态
    }
    set({ user: null });
  },
}));

// ─── 全局会话过期监听 ──────────────────────────────
// 在 auth store 初始化时注册一次
if (typeof window !== "undefined") {
  window.addEventListener("auth:session-expired", () => {
    // 弹出内部提示后跳转登录页
    const msg = "登录已过期，请重新登录";
    // 使用 CustomDialog 事件 — 用户自定义弹窗
    window.dispatchEvent(
      new CustomEvent("app:show-dialog", { detail: { title: "登录过期", message: msg } })
    );
    // 延迟后跳转，给弹窗展示时间
    setTimeout(() => { window.location.href = "/login"; }, 2000);
  });
}
