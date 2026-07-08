// ─── 一键初稿 · 工作台 ──────────────────────────

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wand2, PenLine, ListTree, User, ArrowRight, History } from "lucide-react";
import { getDefaultProfile, type Profile } from "@/lib/profile-store";
import { getTasks } from "@/lib/task-store";

export default function QuickDraftHome() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [taskCount, setTaskCount] = useState(0);

  useEffect(() => {
    setProfile(getDefaultProfile());
    setTaskCount(getTasks().length);
  }, []);

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Wand2 className="w-5 h-5 text-red-600" />
        <h2 className="text-base font-semibold text-gray-800">一键初稿工作台</h2>
      </div>
      <p className="text-xs text-gray-400 mb-6">从画像与规范出发，快速生成合规公文初稿</p>

      {/* 画像状态条 */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
            <User className="w-5 h-5 text-red-500" />
          </div>
          <div>
            {profile ? (
              <>
                <div className="text-sm font-medium text-gray-800">
                  {profile.name} <span className="text-xs text-gray-400">· {profile.level} · {profile.type}</span>
                </div>
                <div className="text-xs text-gray-400">{profile.unit || "（未填单位）"}</div>
              </>
            ) : (
              <div className="text-sm text-gray-500">尚未配置默认画像</div>
            )}
          </div>
        </div>
        <Link href="/settings" className="flex items-center gap-1 text-xs text-red-600 hover:underline">
          去设置 <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* 入口卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Link
          href="/quick-draft/quick"
          className="p-5 rounded-xl border border-gray-200 bg-white hover:border-red-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center group-hover:bg-red-100">
              <PenLine className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-800">出稿</div>
              <div className="text-xs text-gray-400 mt-0.5">描述需求，一键生成完整初稿</div>
            </div>
          </div>
        </Link>
        <Link
          href="/quick-draft/outline"
          className="p-5 rounded-xl border border-gray-200 bg-white hover:border-red-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center group-hover:bg-green-100">
              <ListTree className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-800">大纲</div>
              <div className="text-xs text-gray-400 mt-0.5">先拟大纲，再扩写为正文</div>
            </div>
          </div>
        </Link>
      </div>

      {/* 统计 */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <History className="w-3.5 h-3.5" />
        已生成任务：<span className="font-medium text-gray-700">{taskCount}</span> 篇
        <Link href="/quick-draft/tasks" className="ml-2 text-red-600 hover:underline">查看任务</Link>
      </div>
    </div>
  );
}
