// ─── 注册页（向后兼容，跳转到统一认证页的注册 tab） ──

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/login?tab=register"); }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-gray-400 text-sm">跳转中...</div>
    </div>
  );
}
