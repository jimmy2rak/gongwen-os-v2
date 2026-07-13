"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { KeyRound, User, Eye, Settings as SettingsIcon, Sparkles, UserCheck, Globe, Terminal, Shield, Brain } from "lucide-react";
import ApiConfigPanel from "@/components/settings/ApiConfigPanel";
import ProfilePanel from "@/components/settings/ProfilePanel";
import GlobalSkillPanel from "@/components/settings/GlobalSkillPanel";
import ReviewerPanel from "@/components/settings/ReviewerPanel";
import CrawlerAdminPanel from "@/components/settings/CrawlerAdminPanel";
import UserAdminPanel from "@/components/settings/UserAdminPanel";
import AiMemoryPanel from "@/components/settings/AiMemoryPanel";

interface SettingsMenu {
  id: string;
  label: string;
  desc: string;
  icon: typeof KeyRound;
  ready: boolean;
  /** 仅超级管理员可见（前端不渲染入口，但接口仍返回 403 兜底） */
  requiredSuper?: boolean;
}

const SETTINGS_MENUS: SettingsMenu[] = [
  { id: "api", label: "API配置", desc: "配置 AI 厂商密钥", icon: KeyRound, ready: true },
  { id: "profile", label: "用户画像", desc: "配置发文身份（全局 AI 调用）", icon: User, ready: true },
  { id: "skill", label: "全局Skill", desc: "全局写作规范（与 DocSkill 并存）", icon: Sparkles, ready: true },
  { id: "reviewer", label: "审阅人管理", desc: "配置公文审阅人名单", icon: UserCheck, ready: true },
  { id: "users", label: "用户权限管理", desc: "分配管理员权限并管理权限开关", icon: Shield, ready: true, requiredSuper: true },
  { id: "crawler", label: "爬虫热点推送配置", desc: "超管专属：数据源与一键爬虫脚本", icon: Terminal, ready: true, requiredSuper: true },
  { id: "memory", label: "AI 记忆", desc: "按账号持久化的 AI 写作记忆", icon: Brain, ready: true },
  { id: "menu", label: "菜单可见性", desc: "自定义菜单显示", icon: Eye, ready: false },
];

export default function SettingsPage() {
  const [active, setActiveRaw] = useState<string>("api");
  const setActive = (id: string) => {
    setActiveRaw(id);
    try { localStorage.setItem("gw-settings-active", id); } catch {}
  };
  // 当前登录用户的权限（来自 /api/auth/me，按账号同步，刷新/重登不丢失）
  const user = useAuthStore((s) => s.user);
  const isSuper = user?.role === "super_admin";
  const perms = user?.permissions || [];
  const current = SETTINGS_MENUS.find((m) => m.id === active) ?? SETTINGS_MENUS[0];

  // 恢复上次选中的 tab
  useEffect(() => {
    try {
      const saved = localStorage.getItem("gw-settings-active");
      if (saved && SETTINGS_MENUS.some((m) => m.id === saved)) {
        setActiveRaw(saved);
      }
    } catch {}
  }, []);

  // 菜单可见性：超管可见全部；爬虫配置额外对 crawler_manage 权限开放；
  // 用户权限管理仅超管可见（仅超管可授权）。
  const isMenuVisible = (m: SettingsMenu) => {
    if (m.id === "crawler") return isSuper || perms.includes("crawler_manage");
    if (m.requiredSuper) return isSuper;
    return true;
  };
  const visibleMenus = SETTINGS_MENUS.filter(isMenuVisible);

  return (
    <DashboardLayout title="系统设置">
      <div className="max-w-6xl mx-auto">
        {/* 移动端：顶部可滑动二级分类菜单（参考「一键初稿」二级导航） */}
        <div className="md:hidden flex items-center gap-1 px-4 py-2 border-b border-sidebar-border bg-white overflow-x-auto sticky top-0 z-20">
          {visibleMenus.map((m) => {
            const Icon = m.icon;
            const on = active === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setActive(m.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors ${
                  on ? "bg-[#163f3a]/10 text-[#163f3a] font-medium" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {m.label}
              </button>
            );
          })}
        </div>
        <div className="p-4 md:p-6 flex gap-6">
          <aside className="hidden md:flex w-56 flex-shrink-0 flex-col">
            <div className="flex items-center gap-1.5 px-3 mb-2 text-xs text-gray-400">
              <SettingsIcon className="w-3.5 h-3.5" />
              <span>设置项</span>
            </div>
            <nav className="space-y-1">
              {visibleMenus.map((m) => {
                const Icon = m.icon;
                const on = active === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setActive(m.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition ${
                      on ? "bg-red-50 text-red-600 font-medium" : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="flex-1 text-left">{m.label}</span>
                    {!m.ready && (
                      <span className="text-[9px] text-gray-400 bg-gray-100 px-1 py-0.5 rounded">待开发</span>
                    )}
                  </button>
                );
              })}
              {!isSuper && !perms.includes("crawler_manage") && (
                <p className="text-[10px] text-gray-300 px-3 pt-2">部分功能需相应权限，由超级管理员分配</p>
              )}
            </nav>
          </aside>

          <section className="flex-1 min-w-0">
            {active === "api" && <ApiConfigPanel />}
            {active === "profile" && <ProfilePanel />}
            {active === "skill" && <GlobalSkillPanel />}
            {active === "reviewer" && <ReviewerPanel />}
            {active === "crawler" && <CrawlerAdminPanel />}
            {active === "users" && <UserAdminPanel />}
            {active === "memory" && <AiMemoryPanel />}

            {!current.ready && (
              <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <current.icon className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">「{current.label}」模块正在开发中，敬请期待</p>
                <p className="text-xs text-gray-300 mt-1">{current.desc}</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
