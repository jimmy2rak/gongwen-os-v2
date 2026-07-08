// ─── 注册页面 ──────────────────────────────────────
// 访问路径：/register
// 功能：输入邮箱 + 密码 + 姓名（可选），提交后自动登录

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth.store";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const body = await res.json();

      if (!res.ok) {
        setError(body.error?.message || "注册失败");
        return;
      }

      // 注册成功后，更新 auth store 并跳转到首页
      useAuthStore.getState().setUser(body.data);
      router.push("/");
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
          {/* Logo 区域 */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center mb-3">
              <span className="text-xl font-bold text-white">公</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">GongWen-OS v2</h2>
            <p className="text-sm text-gray-500 mt-1">创建新账号</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 错误提示 */}
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* 姓名（可选） */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="您的姓名（可选）"
              />
            </div>

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
                placeholder="至少 6 位密码"
                required
                minLength={6}
              />
            </div>

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? "注册中..." : "注册"}
            </button>
          </form>

          {/* 已有账号 -> 跳转登录 */}
          <p className="text-center text-sm text-gray-500 mt-6">
            已有账号？{" "}
            <Link href="/login" className="text-red-600 hover:text-red-700 font-medium">
              登录
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
