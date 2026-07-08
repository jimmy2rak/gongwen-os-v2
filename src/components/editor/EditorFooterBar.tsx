// ─── 底部状态栏 ──────────────────────────────────
// 显示字数统计、保存状态、纸面缩放

"use client";

import { useMemo, useState } from "react";
import { HelpCircle, CheckCircle, Clock, ZoomIn } from "lucide-react";

interface EditorFooterBarProps {
  content: string;
  saved: boolean;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
}

export function EditorFooterBar({ content, saved, zoom = 100, onZoomChange }: EditorFooterBarProps) {
  const [editingZoom, setEditingZoom] = useState(false);
  const [zoomInput, setZoomInput] = useState(String(Math.round(zoom)));
  const [showHelp, setShowHelp] = useState(false);

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

  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-white border-t border-gray-200 text-[11px] text-gray-500">
      {/* 左侧：字数 + 保存状态 */}
      <div className="flex items-center gap-4">
        <span>字数：{wordCount}</span>
        <span className="flex items-center gap-1">
          {saved ? (
            <><CheckCircle className="w-3 h-3 text-green-500" /> 已保存</>
          ) : (
            <><Clock className="w-3 h-3 text-amber-500" /> 未保存</>
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
              <strong className="block text-white mb-2">快捷键说明</strong>
              <span className="block mb-1"><kbd className="px-1 bg-gray-700 rounded text-gray-300">Ctrl+S</kbd> 保存</span>
              <span className="block mb-1"><kbd className="px-1 bg-gray-700 rounded text-gray-300">Ctrl+N</kbd> 新建文档</span>
              <span className="block mb-1"><kbd className="px-1 bg-gray-700 rounded text-gray-300">Ctrl+Z</kbd> 撤销</span>
              <span className="block mb-1"><kbd className="px-1 bg-gray-700 rounded text-gray-300">Ctrl+Shift+Z</kbd> 重做</span>
              <span className="block"><kbd className="px-1 bg-gray-700 rounded text-gray-300">Ctrl+滚轮</kbd> 缩放</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
