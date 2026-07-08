"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { KeyRound, User, Eye, Settings as SettingsIcon, Sparkles, UserCheck, Globe, Terminal } from "lucide-react";
import ApiConfigPanel from "@/components/settings/ApiConfigPanel";
import ProfilePanel from "@/components/settings/ProfilePanel";
import GlobalSkillPanel from "@/components/settings/GlobalSkillPanel";
import ReviewerPanel from "@/components/settings/ReviewerPanel";
import CrawlerAdminPanel from "@/components/settings/CrawlerAdminPanel";

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
  { id: "crawler", label: "爬虫热点推送配置", desc: "超管专属：数据源与一键爬虫脚本", icon: Terminal, ready: true, requiredSuper: true },
  { id: "menu", label: "菜单可见性", desc: "自定义菜单显示", icon: Eye, ready: false },
];

export default function SettingsPage() {
  const [active, setActive] = useState<string>("api");
  const [isSuper, setIsSuper] = useState(false);
  const current = SETTINGS_MENUS.find((m) => m.id === active) ?? SETTINGS_MENUS[0];

  // 超管探测：拉取爬虫列表，200 → 是超管；401/403 → 普通用户（不显示入口）
  useEffect(() => {
    fetch("/api/admin/crawler/list")
      .then((r) => setIsSuper(r.ok))
      .catch(() => setIsSuper(false));
  }, []);

  return (
    <DashboardLayout title="系统设置">
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex gap-6">
          <aside className="w-56 flex-shrink-0">
            <div className="flex items-center gap-1.5 px-3 mb-2 text-xs text-gray-400">
              <SettingsIcon className="w-3.5 h-3.5" />
              <span>设置项</span>
            </div>
            <nav className="space-y-1">
              {SETTINGS_MENUS.filter((m) => !m.requiredSuper || isSuper).map((m) => {
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
              {!isSuper && (
                <p className="text-[10px] text-gray-300 px-3 pt-2">爬虫配置为超级管理员专属功能</p>
              )}
            </nav>
          </aside>

          <section className="flex-1 min-w-0">
            {active === "api" && <ApiConfigPanel />}
            {active === "profile" && <ProfilePanel />}
            {active === "skill" && <GlobalSkillPanel />}
            {active === "reviewer" && <ReviewerPanel />}
            {active === "crawler" && <CrawlerAdminPanel />}

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
