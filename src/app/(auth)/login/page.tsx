// ─── 登录页面 ──────────────────────────────────────
// 访问路径：/login
// 功能：输入邮箱 + 密码，登录后跳转到首页

"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth.store";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 如果有 redirect 参数，登录后跳到那个页面
  const redirectTo = searchParams.get("redirect") || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const body = await res.json();

      if (!res.ok) {
        setError(body.error?.message || "邮箱或密码错误");
        return;
      }

      // 登录成功，更新 auth store 并跳转
      useAuthStore.getState().setUser(body.data);
      router.push(redirectTo);
      router.refresh(); // 刷新服务端组件状态
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center mb-3">
              <span className="text-xl font-bold text-white">公</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">GongWen-OS v2</h2>
            <p className="text-sm text-gray-500 mt-1">智能公文写作系统</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 错误提示 */}
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* 邮箱 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="your@email.com"
                required
              />
            </div>

            {/* 密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? "登录中..." : "登录"}
            </button>
          </form>

          {/* 注册入口 */}
          <p className="text-center text-sm text-gray-500 mt-6">
            还没有账号？{" "}
            <Link href="/register" className="text-red-600 hover:text-red-700 font-medium">
              立即注册
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// 因为 useSearchParams() 需要 Suspense 包裹
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">加载中...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
