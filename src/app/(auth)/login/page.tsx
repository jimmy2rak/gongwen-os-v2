// ─── 登录 / 注册 / 验证码 / 找回密码 ───────────────
// 布局：叶子笔 Logo → 介绍文字 → Toggle Group（密码登录 / 验证码链接登录）
//      → 输入框 → 登录/注册按钮 → 小字提示 + 找回密码 → 底部 GitHub 链接

"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { Mail, Lock, User, Key } from "lucide-react";

type LoginMode = "password" | "code";
// 密码模式下的子流程：登录 / 注册 / 找回密码
type SubFlow = "login" | "register" | "forgot";

// 仓库地址（底部「前往仓库」）
const REPO_URL = "https://github.com/jimmy2rak/gongwen-os-v2";

// 叶子笔 Logo（叶身 + 中脉笔杆 + 笔尖）
function LeafPenLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7" aria-hidden="true">
      <path
        d="M4 20 C 4 11 10 4 19 4 C 19 13 13 20 4 20 Z"
        fill="white"
      />
      <path
        d="M5.5 18.5 L 14.5 8"
        stroke="#163f3a"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M14.5 8 L 20 3"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirectTo = searchParams.get("redirect") || "/";

  const [mode, setMode] = useState<LoginMode>("password");
  const [sub, setSub] = useState<SubFlow>("login");
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

  // 切换模式/子流程时清理提示
  useEffect(() => { setError(""); setSuccess(""); }, [mode, sub]);

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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
          {/* ── Logo + 介绍文字 ── */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-[#163f3a] flex items-center justify-center mb-3">
              <LeafPenLogo />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">公文 OS</h2>
            <p className="text-sm text-gray-500 mt-0.5">智能公文写作系统</p>
          </div>

          {/* ── Toggle Group：密码登录 / 验证码·链接登录 ── */}
          <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
            {([
              { k: "password" as LoginMode, label: "密码登录" },
              { k: "code" as LoginMode, label: "验证码/链接登录" },
            ]).map((opt) => (
              <button
                key={opt.k}
                onClick={() => { setMode(opt.k); if (opt.k === "code") setSub("login"); }}
                className={`flex-1 py-2 min-h-[44px] text-xs font-medium rounded-md transition-colors ${
                  mode === opt.k
                    ? "bg-white text-[#163f3a] shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {opt.label}
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

          {/* ── 密码登录 ── */}
          {mode === "password" && sub === "login" && (
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
              <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
                <button type="button" onClick={() => setSub("register")} className="hover:text-[#163f3a] transition-colors">
                  还没有账号？去注册
                </button>
                <button type="button" onClick={() => setSub("forgot")} className="hover:text-[#163f3a] transition-colors">
                  找回密码
                </button>
              </div>
            </form>
          )}

          {/* ── 注册 ── */}
          {mode === "password" && sub === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className={labelClass}><User className="w-3.5 h-3.5 inline mr-1" />昵称</label>
                <input type="text" value={regName} onChange={(e) => setRegName(e.target.value)}
                  className={inputClass} placeholder="您的昵称（可选）" />
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
              <div className="text-center text-xs text-gray-400 pt-1">
                <button type="button" onClick={() => setSub("login")} className="hover:text-[#163f3a] transition-colors">
                  已有账号？返回登录
                </button>
              </div>
            </form>
          )}

          {/* ── 找回密码 ── */}
          {mode === "password" && sub === "forgot" && (
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
              <div className="text-center text-xs text-gray-400 pt-1">
                <button type="button" onClick={() => setSub("login")} className="hover:text-[#163f3a] transition-colors">
                  返回登录
                </button>
              </div>
            </form>
          )}

          {/* ── 验证码 / 链接登录 ── */}
          {mode === "code" && (
            <form onSubmit={handleCodeLogin} className="space-y-4">
              <div>
                <label className={labelClass}><Mail className="w-3.5 h-3.5 inline mr-1" />邮箱</label>
                <div className="flex gap-2">
                  <input type="email" value={codeEmail} onChange={(e) => setCodeEmail(e.target.value)}
                    className={`${inputClass} flex-1`} placeholder="your@email.com" required
                    disabled={codeSent && countdown > 0} />
                  <button type="button" onClick={handleSendCode} disabled={loading || countdown > 0}
                    className="px-3 py-2 min-h-[44px] text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap transition-colors">
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
        </div>

        {/* ── 底部：淡色 GitHub 图标 + 前往仓库 ── */}
        <div className="mt-6 flex items-center justify-center">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-gray-500 transition-colors"
            title="前往 GitHub 仓库"
          >
            <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            <span>前往仓库</span>
          </a>
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
