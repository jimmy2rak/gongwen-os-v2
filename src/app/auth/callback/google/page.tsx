// ─── Google OAuth 回调页面 ───────────────────────
// Google 授权后重定向到这里，接收 code，调用 API 完成登录

"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code) { setError("未收到授权码"); return; }
    fetch("/api/auth/oauth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then((r) => r.json())
      .then((b) => {
        if (b.success && b.data) {
          useAuthStore.getState().setUser(b.data);
          router.push("/");
        } else {
          setError(b.error?.message || "Google 登录失败");
        }
      })
      .catch(() => setError("网络错误"));
  }, [code, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-sm text-gray-500">
        {error ? (
          <div className="text-red-600">{error}</div>
        ) : (
          "Google 登录中..."
        )}
      </div>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="text-gray-500">加载中...</div></div>}>
      <CallbackContent />
    </Suspense>
  );
}
