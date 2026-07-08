// ─── 公文类型筛选 Pill 按钮组件 ────────────────
// 复刻知识库页面的全部在外 pill 样式，供热点推送/文档管理/回收站复用

"use client";

import { getAllCategories, getCategoryColor } from "@/types";

interface Props {
  activeCat: string;
  onChange: (cat: string) => void;
  /** 每个分类的计数映射（可选） */
  counts?: Record<string, number>;
}

export function CategoryFilterPills({ activeCat, onChange, counts }: Props) {
  const allCats = getAllCategories();

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => onChange("")}
        className={`px-2.5 py-1 text-[11px] rounded-full transition-colors ${
          !activeCat
            ? "bg-[#163f3a] text-white"
            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
        }`}
      >
        全部
      </button>
      {allCats.map((cat) => {
        const color = getCategoryColor(cat);
        const count = counts?.[cat];
        return (
          <button
            key={cat}
            onClick={() => onChange(activeCat === cat ? "" : cat)}
            className={`px-2.5 py-1 text-[11px] rounded-full transition-colors flex items-center gap-1 ${
              activeCat === cat
                ? "text-white font-medium"
                : "text-gray-500 hover:bg-gray-100"
            }`}
            style={activeCat === cat ? { backgroundColor: color } : {}}
          >
            {cat}
            {count !== undefined && count > 0 && (
              <span className="text-[9px] opacity-70">({count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
