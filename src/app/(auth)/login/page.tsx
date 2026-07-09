// ─── 统一认证页面（登录 / 注册 / 找回密码） ─────
// 三合一 tab 切换 + 社交登录圆形图标占位

"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { Mail, Lock, User } from "lucide-react";

type AuthTab = "login" | "register" | "forgot";

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 支持 ?tab=register 跳转到注册 tab
  const initialTab = searchParams.get("tab") === "register" ? "register" : "login";
  const redirectTo = searchParams.get("redirect") || "/";

  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // 清除提示
  useEffect(() => { setError(""); setSuccess(""); }, [tab]);

  // ── 登录 ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error?.message || "邮箱或密码错误"); return; }
      useAuthStore.getState().setUser(body.data);
      router.push(redirectTo);
      router.refresh();
    } catch { setError("网络错误，请稍后重试"); }
    finally { setLoading(false); }
  };

  // ── 注册 ──
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: regName, email: regEmail, password: regPassword }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error?.message || "注册失败"); return; }
      useAuthStore.getState().setUser(body.data);
      router.push("/");
    } catch { setError("网络错误，请稍后重试"); }
    finally { setLoading(false); }
  };

  // ── 找回密码（真实 API 调用） ──
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!resetEmail.trim()) { setError("请输入邮箱地址"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail.trim() }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error?.message || "发送失败"); return; }
      setSuccess(body.message || "重置链接已发送到邮箱");
    } catch { setError("网络错误，请稍后重试"); }
    finally { setLoading(false); }
  };

  // ── 社交登录（OAuth 授权跳转） ──
  const handleSocialLogin = (provider: "github" | "google") => {
    const clientIds: Record<string, string> = {
      github: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || "",
      google: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
    };
    const authUrls: Record<string, string> = {
      github: `https://github.com/login/oauth/authorize?client_id=${clientIds.github}&redirect_uri=${encodeURIComponent(window.location.origin)}/auth/callback/github&scope=user:email`,
      google: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientIds.google}&redirect_uri=${encodeURIComponent(window.location.origin)}/auth/callback/google&response_type=code&scope=openid%20email%20profile`,
    };
    const url = authUrls[provider];
    if (!url || !clientIds[provider]) {
      setError(`${provider === "github" ? "GitHub" : "Google"} 登录尚未配置，请在 .env 中设置相关密钥`);
      return;
    }
    window.location.href = url;
  };

  const btnClass = "w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors";
  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center mb-3">
              <span className="text-xl font-bold text-white">公</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">公文 OS</h2>
            <p className="text-sm text-gray-500 mt-0.5">智能公文写作系统</p>
          </div>

          {/* ── Tab 切换 ── */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden mb-6">
            <button
              onClick={() => setTab("login")}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                tab === "login" ? "bg-red-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >登录</button>
            <button
              onClick={() => setTab("register")}
              className={`flex-1 py-2 text-xs font-medium transition-colors border-x border-gray-200 ${
                tab === "register" ? "bg-red-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >注册</button>
            <button
              onClick={() => setTab("forgot")}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                tab === "forgot" ? "bg-red-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >找回密码</button>
          </div>

          {/* 错误 / 成功提示 */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">{error}</div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">{success}</div>
          )}

          {/* ── Tab 内容 ── */}
          {tab === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className={labelClass}><Mail className="w-3.5 h-3.5 inline mr-1" />邮箱</label>
                <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
                  className={inputClass} placeholder="your@email.com" required />
              </div>
              <div>
                <label className={labelClass}><Lock className="w-3.5 h-3.5 inline mr-1" />密码</label>
                <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                  className={inputClass} placeholder="••••••••" required />
              </div>
              <button type="submit" disabled={loading} className={btnClass}>
                {loading ? "登录中..." : "登录"}
              </button>
            </form>
          )}

          {tab === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className={labelClass}><User className="w-3.5 h-3.5 inline mr-1" />姓名</label>
                <input type="text" value={regName} onChange={(e) => setRegName(e.target.value)}
                  className={inputClass} placeholder="您的姓名（可选）" />
              </div>
              <div>
                <label className={labelClass}><Mail className="w-3.5 h-3.5 inline mr-1" />邮箱</label>
                <input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)}
                  className={inputClass} placeholder="your@email.com" required />
              </div>
              <div>
                <label className={labelClass}><Lock className="w-3.5 h-3.5 inline mr-1" />密码</label>
                <input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)}
                  className={inputClass} placeholder="至少 6 位密码" required minLength={6} />
              </div>
              <button type="submit" disabled={loading} className={btnClass}>
                {loading ? "注册中..." : "注册"}
              </button>
            </form>
          )}

          {tab === "forgot" && (
            <form onSubmit={handleForgot} className="space-y-4">
              <p className="text-xs text-gray-500 leading-relaxed">
                输入注册时使用的邮箱地址，我们将发送密码重置链接。
              </p>
              <div>
                <label className={labelClass}><Mail className="w-3.5 h-3.5 inline mr-1" />邮箱</label>
                <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                  className={inputClass} placeholder="your@email.com" required />
              </div>
              <button type="submit" disabled={loading} className={btnClass}>
                {loading ? "发送中..." : "发送重置链接"}
              </button>
            </form>
          )}

          {/* ── 分隔线 ── */}
          <div className="flex items-center gap-3 my-6">
            <span className="flex-1 h-px bg-gray-200" />
            <span className="text-[11px] text-gray-400 flex-shrink-0">其他登录方式</span>
            <span className="flex-1 h-px bg-gray-200" />
          </div>

          {/* ── 社交登录按钮（圆形图标） ── */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => handleSocialLogin("github")}
              className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 hover:border-gray-300 transition-all"
              title="GitHub 登录"
            >
              {/* GitHub SVG 图标 */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </button>
            <button
              onClick={() => handleSocialLogin("google")}
              className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100 hover:border-gray-300 transition-all"
              title="Google 登录"
            >
              {/* Google G SVG 图标 */}
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </button>
          </div>
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
      <AuthContent />
    </Suspense>
  );
}
