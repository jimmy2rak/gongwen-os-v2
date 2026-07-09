// ─── Magic Link 自动登录回调页 ──────────────────
// 用户点击邮件中的链接后跳转到此页 → 调用 API 验证 token → 自动登录

"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";

function MagicLinkContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState("登录中...");

  useEffect(() => {
    if (!token) {
      setStatus("链接无效：缺少登录令牌");
      return;
    }

    fetch("/api/auth/magic-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((b) => {
        if (b.success && b.data) {
          useAuthStore.getState().setUser(b.data);
          router.push("/");
        } else {
          setStatus(b.error?.message || "登录失败");
        }
      })
      .catch(() => setStatus("网络错误"));
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-sm" style={{ color: status.startsWith("登录中") ? "#666" : "#dc2626" }}>
        {status}
      </div>
    </div>
  );
}

export default function MagicLinkPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 text-sm">加载中...</div>
      </div>
    }>
      <MagicLinkContent />
    </Suspense>
  );
}
