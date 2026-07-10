// ─── 首页快捷入口管理面板 ─────────────────────────
// 用户可勾选「显示/隐藏」并调整顺序（上/下移动，移动端友好）。
// 保存后回调新的可见入口有序 id 数组（按账号同步）。

"use client";

import { useState, useEffect } from "react";
import { X, ChevronUp, ChevronDown, Check, RotateCcw } from "lucide-react";
import { QUICK_ENTRY_CATALOG, DEFAULT_QUICK_ENTRIES } from "@/lib/quick-entries";

interface Props {
  value: string[];                 // 当前可见入口有序 id
  onSave: (ids: string[]) => void; // 保存回调（已过滤为可见有序 id）
  onClose: () => void;
}

export function QuickEntryManager({ value, onSave, onClose }: Props) {
  // working: 全部目录 id 的当前顺序；visible: 可见集合
  const [working, setWorking] = useState<string[]>(
    QUICK_ENTRY_CATALOG.map((e) => e.id)
  );
  const [visible, setVisible] = useState<Set<string>>(new Set(value));

  // 打开时按当前值重新排列（可见在前、按原顺序，其余补在后面）
  useEffect(() => {
    const set = new Set(value);
    const vis = QUICK_ENTRY_CATALOG.filter((e) => set.has(e.id)).map((e) => e.id);
    const hidden = QUICK_ENTRY_CATALOG.filter((e) => !set.has(e.id)).map((e) => e.id);
    setWorking([...vis, ...hidden]);
    setVisible(set);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...working];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setWorking(next);
  };

  const toggle = (id: string) => {
    setVisible((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const reset = () => {
    setWorking(QUICK_ENTRY_CATALOG.map((e) => e.id));
    setVisible(new Set(DEFAULT_QUICK_ENTRIES));
  };

  const save = () => {
    onSave(working.filter((id) => visible.has(id)));
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-800">管理快捷入口</h3>
          <div className="flex items-center gap-1">
            <button onClick={reset} title="恢复默认"
              className="flex items-center gap-1 px-2 py-1.5 text-[11px] text-gray-500 hover:bg-gray-100 rounded-lg">
              <RotateCcw className="w-3.5 h-3.5" /> 默认
            </button>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 列表 */}
        <div className="overflow-y-auto px-3 py-3 space-y-1.5">
          {working.map((id, idx) => {
            const def = QUICK_ENTRY_CATALOG.find((e) => e.id === id)!;
            const Icon = def.icon;
            const isVis = visible.has(id);
            return (
              <div
                key={id}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-colors ${
                  isVis ? "border-gray-200 bg-white" : "border-dashed border-gray-200 bg-gray-50 opacity-60"
                }`}
              >
                <button
                  onClick={() => toggle(id)}
                  className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
                    isVis ? "bg-[#163f3a] text-white" : "bg-white border border-gray-300 text-transparent"
                  }`}
                  title={isVis ? "点击隐藏" : "点击显示"}
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${def.bg}1a`, color: def.color }}
                >
                  <Icon className="w-4 h-4" />
                </span>
                <span className="text-sm text-gray-700 flex-1">{def.label}</span>
                <div className="flex items-center gap-0.5">
                  <button onClick={() => move(idx, -1)} disabled={idx === 0}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent"
                    title="上移">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button onClick={() => move(idx, 1)} disabled={idx === working.length - 1}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent"
                    title="下移">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部保存 */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 text-xs bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200">
            取消
          </button>
          <button onClick={save}
            className="flex-1 px-4 py-2.5 text-xs bg-[#163f3a] text-white rounded-xl hover:bg-[#163f3a]/85">
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
