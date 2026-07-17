// ─── 底部状态栏 ──────────────────────────────────
// 显示字数统计、保存状态（含保存时间）、纸面缩放

"use client";

import { useEffect, useMemo, useState } from "react";
import { HelpCircle, CheckCircle, Clock, ZoomIn } from "lucide-react";

interface EditorFooterBarProps {
  content: string;
  saved: boolean;
  /** 最近一次成功保存的时间戳（ms），无则传 null/undefined */
  savedAt?: number | null;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
}

/** 格式化保存时间：今天只显示 HH:mm；非今天显示 YYYY.M.D  HH:mm */
function formatSaveTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isToday) return `${hh}:${mm}`;
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}\u00A0\u00A0${hh}:${mm}`;
}

export function EditorFooterBar({ content, saved, savedAt, zoom = 100, onZoomChange }: EditorFooterBarProps) {
  const [editingZoom, setEditingZoom] = useState(false);
  const [zoomInput, setZoomInput] = useState(String(Math.round(zoom)));
  const [showHelp, setShowHelp] = useState(false);
  // 设备识别：避免 SSR  hydration 不一致，挂载后再判定
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent || ""));
  }, []);

  // 计算字数（去 HTML 标签）
  const wordCount = useMemo(() => {
    const text = content.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
    const cn = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const en = text.replace(/[\u4e00-\u9fff]/g, " ").split(/\s+/).filter(Boolean).length;
    return cn + en;
  }, [content]);

  const handleZoomClick = () => {
    setZoomInput(String(Math.round(zoom)));
    setEditingZoom(true);
  };

  const handleZoomSubmit = () => {
    const val = parseInt(zoomInput, 10);
    if (!isNaN(val) && val >= 10 && val <= 300) {
      onZoomChange?.(val);
    }
    setEditingZoom(false);
  };

  const saveTimeText = savedAt ? formatSaveTime(savedAt) : "";

  // 快捷键清单（按设备给出对应按键）
  const shortcutRows = isMac
    ? [
        { keys: "⌘ + S", label: "保存" },
        { keys: "⌘ + N", label: "新建文档" },
        { keys: "⌘ + Z", label: "撤销" },
        { keys: "⌘ + ⇧ + Z", label: "重做" },
        { keys: "⌘ + 滚轮", label: "缩放" },
      ]
    : [
        { keys: "Ctrl + S", label: "保存" },
        { keys: "Ctrl + N", label: "新建文档" },
        { keys: "Ctrl + Z", label: "撤销" },
        { keys: "Ctrl + Shift + Z", label: "重做" },
        { keys: "Ctrl + 滚轮", label: "缩放" },
      ];

  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-white border-t border-gray-200 text-[11px] text-gray-500">
      {/* 左侧：字数 + 保存状态 + 保存时间 */}
      <div className="flex items-center gap-4">
        <span>字数：{wordCount}</span>
        <span className="flex items-center gap-1">
          {saved ? (
            <><CheckCircle className="w-3 h-3 text-green-500" /> 已保存</>
          ) : (
            <><Clock className="w-3 h-3 text-amber-500" /> 未保存</>
          )}
          {savedAt && (
            <span className="text-gray-400">
              {" · "}
              {saved ? saveTimeText : `上次 ${saveTimeText}`}
            </span>
          )}
        </span>
      </div>

      {/* 右侧：缩放 + 帮助 */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <ZoomIn className="w-3 h-3 text-gray-400" />
          {editingZoom ? (
            <input
              type="number"
              value={zoomInput}
              onChange={(e) => setZoomInput(e.target.value)}
              onBlur={handleZoomSubmit}
              onKeyDown={(e) => { if (e.key === "Enter") handleZoomSubmit(); if (e.key === "Escape") setEditingZoom(false); }}
              className="w-12 px-1 py-0.5 text-[11px] text-gray-700 bg-white border border-gray-300 rounded text-center outline-none"
              min={10}
              max={300}
              autoFocus
            />
          ) : (
            <button onClick={handleZoomClick} className="hover:text-gray-700 min-w-[32px] text-center" title="点击输入缩放比例">
              {Math.round(zoom)}%
            </button>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="p-1 rounded hover:bg-gray-100"
            title="快捷键说明"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
          {showHelp && (
            <div className="absolute bottom-full right-0 mb-2 w-56 p-3 bg-gray-800 rounded-lg shadow-lg z-50 text-[10px] text-gray-300">
              <strong className="block text-white mb-1">
                快捷键说明{isMac ? "（macOS）" : "（Windows）"}
              </strong>
              <span className="block mb-2 text-gray-400">
                {isMac ? "当前设备：Mac" : "当前设备：Windows / 其他"}
              </span>
              {shortcutRows.map((row) => (
                <span key={row.keys} className="block mb-1">
                  <kbd className="px-1 bg-gray-700 rounded text-gray-300">{row.keys}</kbd> {row.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
