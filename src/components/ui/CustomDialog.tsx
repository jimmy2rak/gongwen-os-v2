// ─── CustomDialog — 全站统一内部弹窗 ──────────────
// 三种模式：
//   "info"    — 单按钮信息提示（替代 alert）
//   "confirm" — 双按钮确认（替代 confirm）
//   "prompt"  — 带输入框（替代 prompt）

import { useState } from "react";
import { AlertCircle, AlertTriangle } from "lucide-react";

interface CustomDialogProps {
  open: boolean;
  mode: "info" | "confirm" | "prompt";
  title: string;
  message?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: (input?: string) => void;
  onCancel?: () => void;
}

export function CustomDialog({
  open, mode, title, message, placeholder,
  confirmText = "确认", cancelText = "取消",
  onConfirm, onCancel,
}: CustomDialogProps) {
  const [input, setInput] = useState("");

  if (!open) return null;

  const handleCancel = () => { setInput(""); onCancel?.(); };
  const handleConfirm = () => { const v = input; setInput(""); onConfirm?.(v); };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={handleCancel}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-96 max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        {/* 图标 */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            mode === "prompt" ? "bg-blue-100" : mode === "confirm" ? "bg-amber-100" : "bg-red-100"
          }`}>
            <AlertTriangle className={`w-5 h-5 ${
              mode === "prompt" ? "text-blue-500" : mode === "confirm" ? "text-amber-500" : "text-red-500"
            }`} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-gray-800">{title}</h3>
            {message && <p className="text-xs text-gray-500 mt-1">{message}</p>}
          </div>
        </div>

        {/* 输入框（prompt 模式） */}
        {mode === "prompt" && (
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder || ""}
            autoFocus
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 mb-4"
            onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
          />
        )}

        {/* 按钮 */}
        <div className="flex gap-2">
          {mode === "info" ? (
            <button onClick={handleCancel}
              className="w-full px-4 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">
              {confirmText}
            </button>
          ) : (
            <>
              <button onClick={handleCancel}
                className="flex-1 px-4 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">
                {cancelText}
              </button>
              <button onClick={handleConfirm}
                className="flex-1 px-4 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                {confirmText}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
