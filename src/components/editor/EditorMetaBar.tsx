// ─── 公文元信息栏 ──────────────────────────────
// 显示和编辑公文的红头、文号、版记等元信息

"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type { DocMetaInfo } from "@/types";

interface EditorMetaBarProps {
  meta: DocMetaInfo;
  onChange: (meta: DocMetaInfo) => void;
  expanded: boolean;
  onToggle: () => void;
}

export function EditorMetaBar({ meta, onChange, expanded, onToggle }: EditorMetaBarProps) {
  const update = (key: keyof DocMetaInfo, value: string) => {
    onChange({ ...meta, [key]: value });
  };

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="px-4 py-1 border-b border-gray-100">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          公文信息
        </button>
      </div>
      {expanded && (
        <div className="flex gap-3 px-4 py-2 flex-wrap">
          {/* 第一行：红头 + 文号 + 发文机关 + 成文日期 */}
          <label className="flex flex-col gap-0.5 flex-1 min-w-[120px]">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">红头</span>
            <input
              type="text"
              value={meta.redHeader}
              onChange={(e) => update("redHeader", e.target.value)}
              placeholder="请输入红头名称"
              className="px-2 py-1 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:bg-white"
            />
          </label>
          <label className="flex flex-col gap-0.5 flex-1 min-w-[120px]">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">文号</span>
            <input
              type="text"
              value={meta.docNumber}
              onChange={(e) => update("docNumber", e.target.value)}
              placeholder="〔2026〕1号"
              className="px-2 py-1 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:bg-white"
            />
          </label>
          <label className="flex flex-col gap-0.5 flex-1 min-w-[120px]">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">发文机关</span>
            <input
              type="text"
              value={meta.submitUnit}
              onChange={(e) => update("submitUnit", e.target.value)}
              placeholder="发文机关全称"
              className="px-2 py-1 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:bg-white"
            />
          </label>
          <label className="flex flex-col gap-0.5 flex-1 min-w-[120px]">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">成文日期</span>
            <input
              type="text"
              value={meta.submitDate}
              onChange={(e) => update("submitDate", e.target.value)}
              placeholder="2026年7月7日"
              className="px-2 py-1 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:bg-white"
            />
          </label>
          {/* 第二行：密级 + 紧急程度 + 抄送 + 印发日期 */}
          <label className="flex flex-col gap-0.5 flex-1 min-w-[120px]">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">密级</span>
            <input
              type="text"
              value={meta.secrecy}
              onChange={(e) => update("secrecy", e.target.value)}
              placeholder="秘密/机密/绝密"
              className="px-2 py-1 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:bg-white"
            />
          </label>
          <label className="flex flex-col gap-0.5 flex-1 min-w-[120px]">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">紧急程度</span>
            <input
              type="text"
              value={meta.level}
              onChange={(e) => update("level", e.target.value)}
              placeholder="特急/加急/平急"
              className="px-2 py-1 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:bg-white"
            />
          </label>
          <label className="flex flex-col gap-0.5 flex-1 min-w-[120px]">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">抄送</span>
            <input
              type="text"
              value={meta.drawer}
              onChange={(e) => update("drawer", e.target.value)}
              placeholder="抄送单位"
              className="px-2 py-1 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:bg-white"
            />
          </label>
          <label className="flex flex-col gap-0.5 flex-1 min-w-[120px]">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">印发日期</span>
            <input
              type="text"
              value={meta.printDate}
              onChange={(e) => update("printDate", e.target.value)}
              placeholder="2026年7月1日印发"
              className="px-2 py-1 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:bg-white"
            />
          </label>
          {/* 第三行：版记 */}
          <label className="flex flex-col gap-0.5 flex-1 min-w-[120px]">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">印发机关</span>
            <input
              type="text"
              value={meta.issuingAuthority}
              onChange={(e) => update("issuingAuthority", e.target.value)}
              placeholder="版记第一行：印发机关"
              className="px-2 py-1 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:bg-white"
            />
          </label>
          <label className="flex flex-col gap-0.5 flex-1 min-w-[120px]">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">主送机关</span>
            <input
              type="text"
              value={meta.recipient}
              onChange={(e) => update("recipient", e.target.value)}
              placeholder="版记第二行：主送机关"
              className="px-2 py-1 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-red-500 focus:bg-white"
            />
          </label>
        </div>
      )}
    </div>
  );
}
