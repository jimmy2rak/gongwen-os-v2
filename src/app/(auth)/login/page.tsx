// ─── 统一认证页面（密码登录 / 注册 / 验证码登录 / 找回密码） ─────
// 四合一 tab 切换，含验证码登录和 Magic Link

"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { Mail, Lock, User, Key } from "lucide-react";

type AuthTab = "login" | "register" | "code" | "forgot";

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = searchParams.get("tab") === "register" ? "register" : "login";
  const redirectTo = searchParams.get("redirect") || "/";

  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // 密码登录
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // 注册
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  // 验证码登录
  const [codeEmail, setCodeEmail] = useState("");
  const [codeValue, setCodeValue] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 找回密码
  const [resetEmail, setResetEmail] = useState("");

  // 清理
  useEffect(() => { setError(""); setSuccess(""); }, [tab]);

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [countdown]);

  // ── 密码登录 ──
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

  // ── 发送验证码 ──
  const handleSendCode = async () => {
    if (!codeEmail.trim()) { setError("请输入邮箱地址"); return; }
    setError(""); setSuccess("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: codeEmail.trim() }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error?.message || "发送失败"); return; }
      setSuccess("验证码已发送到邮箱");
      setCodeSent(true);
      setCountdown(60);
    } catch { setError("网络错误，请稍后重试"); }
    finally { setLoading(false); }
  };

  // ── 验证码登录 ──
  const handleCodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeValue.trim()) { setError("请输入验证码"); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: codeEmail.trim(), code: codeValue.trim() }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error?.message || "验证失败"); return; }
      useAuthStore.getState().setUser(body.data);
      router.push(redirectTo);
      router.refresh();
    } catch { setError("网络错误，请稍后重试"); }
    finally { setLoading(false); }
  };

  // ── 找回密码 ──
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

  const btnClass = "w-full py-2.5 bg-[#163f3a] hover:bg-[#0f2d2a] disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors";
  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#163f3a] focus:border-transparent";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm px-4 mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-[#163f3a] flex items-center justify-center mb-3">
              <span className="text-xl font-bold text-white">公</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">公文 OS</h2>
            <p className="text-sm text-gray-500 mt-0.5">智能公文写作系统</p>
          </div>

          {/* ── Tab 切换 ── */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden mb-6">
            {(["login", "register", "code", "forgot"] as AuthTab[]).map((t, i) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${
                  i !== 0 && i !== 3 ? "border-x border-gray-200" : ""
                } ${
                  tab === t
                    ? "bg-[#163f3a] text-white"
                    : "bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                {t === "login" ? "密码登录" : t === "register" ? "注册" : t === "code" ? "验证码" : "找回密码"}
              </button>
            ))}
          </div>

          {/* 错误 / 成功提示 */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">{error}</div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">{success}</div>
          )}

          {/* ── Tab: 密码登录 ── */}
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

          {/* ── Tab: 注册 ── */}
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

          {/* ── Tab: 验证码登录 ── */}
          {tab === "code" && (
            <form onSubmit={handleCodeLogin} className="space-y-4">
              <div>
                <label className={labelClass}><Mail className="w-3.5 h-3.5 inline mr-1" />邮箱</label>
                <div className="flex gap-2">
                  <input type="email" value={codeEmail} onChange={(e) => setCodeEmail(e.target.value)}
                    className={`${inputClass} flex-1`} placeholder="your@email.com" required
                    disabled={codeSent && countdown > 0} />
                  <button type="button" onClick={handleSendCode} disabled={loading || countdown > 0}
                    className="px-3 py-2 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap transition-colors">
                    {countdown > 0 ? `${countdown}s` : codeSent ? "重新发送" : "发送验证码"}
                  </button>
                </div>
              </div>
              <div>
                <label className={labelClass}><Key className="w-3.5 h-3.5 inline mr-1" />验证码</label>
                <input type="text" value={codeValue} onChange={(e) => setCodeValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className={inputClass} placeholder="输入 6 位验证码" required maxLength={6}
                  inputMode="numeric" autoComplete="one-time-code" />
              </div>
              <button type="submit" disabled={loading || !codeSent} className={btnClass}>
                {loading ? "验证中..." : "验证码登录"}
              </button>
              <p className="text-xs text-gray-400 text-center leading-relaxed">
                验证码发送到您的邮箱，10 分钟内有效。<br />
                邮件中同时包含一键登录链接，点击即可登录。
              </p>
            </form>
          )}

          {/* ── Tab: 找回密码 ── */}
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
        </div>
      </div>
    </div>
  );
}

// useSearchParams() 需要 Suspense 包裹
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
