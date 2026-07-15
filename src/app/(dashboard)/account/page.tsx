// ─── 账户资料页 ──────────────────────────────────
// 用户可在此真正修改：昵称、邮箱、手机号、头像、登录密码。
// 侧边栏「修改资料」跳转至此。

"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { proxyImageUrl } from "@/lib/image-proxy";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { User, Mail, Phone, KeyRound, Lock, CheckCircle, AlertTriangle, Image as ImageIcon, Crop } from "lucide-react";
import AvatarCropper from "@/components/settings/AvatarCropper";

export default function AccountPage() {
  const user = useAuthStore((s) => s.user);
  const fetchUser = useAuthStore((s) => s.fetchUser);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState("");
  const [avatarError, setAvatarError] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // 用当前账号信息预填
  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setEmail(user.email ?? "");
      setPhone(user.phone ?? "");
      setAvatar(user.avatar ?? "");
      setAvatarError(false);
    }
  }, [user]);

  const handleSave = async () => {
    setError(""); setSuccess("");
    // 前端基础校验
    if (!email.trim()) { setError("邮箱不能为空"); return; }
    if (newPassword) {
      if (newPassword.length < 6) { setError("新密码至少需要 6 位"); return; }
      if (newPassword !== confirmPassword) { setError("两次输入的新密码不一致"); return; }
    }

    // 仅提交发生变化的字段
    const payload: Record<string, unknown> = {};
    if (name !== (user?.name ?? "")) payload.name = name;
    if (email.trim() !== (user?.email ?? "")) payload.email = email.trim();
    if (phone !== (user?.phone ?? "")) payload.phone = phone.trim();
    if (avatar !== (user?.avatar ?? "")) payload.avatar = avatar.trim();
    if (newPassword) {
      payload.currentPassword = currentPassword;
      payload.newPassword = newPassword;
    }

    if (Object.keys(payload).length === 0) {
      setSuccess("没有任何修改");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error?.message || "保存失败");
        return;
      }
      // 刷新全局用户（侧边栏头像/昵称同步）
      await fetchUser();
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("资料已保存");
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#163f3a] focus:border-transparent";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <DashboardLayout title="账户资料">
      <div className="max-w-2xl mx-auto">
        <div className="mb-5">
          <h3 className="text-base font-semibold text-gray-800">账户资料</h3>
          <p className="text-xs text-gray-400 mt-1">修改您的个人资料与登录密码，保存后立即生效</p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
            <CheckCircle className="w-4 h-4 flex-shrink-0" /> {success}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          {/* 头像 */}
          <div>
            <span className={labelClass}><ImageIcon className="w-3.5 h-3.5 inline mr-1" />头像（图片链接）</span>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0 border border-gray-200">
                {avatar && !avatarError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={proxyImageUrl(avatar)}
                    alt="头像预览"
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-gray-400 text-lg">
                    {(name || email || "?").trim().charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={avatar}
                onChange={(e) => { setAvatar(e.target.value); setAvatarError(false); }}
                placeholder="https://... 留空则使用首字母头像"
                className={`${inputClass} flex-1`}
              />
              <button
                type="button"
                onClick={() => { setCropSrc(avatar); setCropOpen(true); }}
                disabled={!avatar.trim()}
                className="flex items-center gap-1 px-3 py-2 text-xs text-[#163f3a] bg-white border border-[#163f3a]/30 rounded-lg hover:bg-[#163f3a]/5 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                title="粘贴链接后框选头像范围"
              >
                <Crop className="w-3.5 h-3.5" /> 框选裁剪
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
              提示：请粘贴图片直链（在图片上右键 → 复制图片地址，形如 <span className="font-mono">images.unsplash.com/...</span>）；粘贴后点「框选裁剪」可手动拖拽/缩放调整头像范围。
            </p>
          </div>

          {/* 昵称 */}
          <div>
            <label className={labelClass}><User className="w-3.5 h-3.5 inline mr-1" />昵称</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="您的昵称" className={inputClass} />
          </div>

          {/* 邮箱 */}
          <div>
            <label className={labelClass}><Mail className="w-3.5 h-3.5 inline mr-1" />邮箱（登录账号）</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className={inputClass} required />
          </div>

          {/* 手机号 */}
          <div>
            <label className={labelClass}><Phone className="w-3.5 h-3.5 inline mr-1" />手机号（可选）</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="用于接收通知（可选）" className={inputClass} />
          </div>

          <div className="border-t border-gray-100 pt-5">
            <p className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4" /> 修改密码
            </p>
            <div className="space-y-4">
              <div>
                <label className={labelClass}><Lock className="w-3.5 h-3.5 inline mr-1" />当前密码</label>
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="修改密码时填写（OAuth 登录可留空）" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>新密码</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="至少 6 位，不修改请留空" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>确认新密码</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="再次输入新密码" className={inputClass} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2.5 bg-[#163f3a] hover:bg-[#0f2d2a] disabled:bg-gray-300 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {loading ? "保存中..." : "保存修改"}
          </button>
        </div>
      </div>

      {cropOpen && (
        <AvatarCropper
          src={cropSrc}
          onCancel={() => setCropOpen(false)}
          onCropped={(dataUrl) => {
            setAvatar(dataUrl);
            setAvatarError(false);
            setCropOpen(false);
          }}
        />
      )}
    </DashboardLayout>
  );
}
