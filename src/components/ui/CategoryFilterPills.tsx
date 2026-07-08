// ─── 通用筛选 Pill 按钮组件 ──────────────────────
// 复刻知识库页面的全部在外 pill 样式，可传入任意选项列表
// 默认行为（不传入 items）= 使用公文类型分类 + 分类色

"use client";

import { getAllCategories, getCategoryColor } from "@/types";

interface Props {
  active: string;
  onChange: (value: string) => void;
  /** 自定义选项列表（不传则使用公文类型） */
  items?: string[];
  /** 自定义选项激活颜色（不传则使用分类色或默认金色） */
  colorFor?: (value: string) => string;
  /** 每个选项的计数映射（可选） */
  counts?: Record<string, number>;
  /** "全部"按钮的显示文本（可选） */
  allLabel?: string;
}

const DEFAULT_ACTIVE_COLOR = "#c9a55c";

export function CategoryFilterPills({
  active,
  onChange,
  items,
  colorFor,
  counts,
  allLabel = "全部",
}: Props) {
  const options = items ?? getAllCategories();
  const resolveColor = (value: string) => {
    if (colorFor) return colorFor(value);
    if (!items) return getCategoryColor(value);
    return DEFAULT_ACTIVE_COLOR;
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => onChange("")}
        className={`px-2.5 py-1 text-[11px] rounded-full transition-colors ${
          !active
            ? "bg-[#163f3a] text-white"
            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
        }`}
      >
        {allLabel}
      </button>
      {options.map((value) => {
        const color = resolveColor(value);
        const count = counts?.[value];
        return (
          <button
            key={value}
            onClick={() => onChange(active === value ? "" : value)}
            className={`px-2.5 py-1 text-[11px] rounded-full transition-colors flex items-center gap-1 ${
              active === value
                ? "text-white font-medium"
                : "text-gray-500 hover:bg-gray-100"
            }`}
            style={active === value ? { backgroundColor: color } : {}}
          >
            {value}
            {count !== undefined && count > 0 && (
              <span className="text-[9px] opacity-70">({count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
