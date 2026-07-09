// ─── Skill 树状选择器（复用 AI chatbox 的选择逻辑） ─
// 供一键初稿/大纲生成页使用，与 AiAssistant 的 Skill 面板行为一致

"use client";

import { useEffect, useState, useCallback } from "react";
import { getGlobalSkills } from "@/lib/global-skill-store";
import { Sparkles, ChevronDown, ChevronRight, Check } from "lucide-react";

interface DbSkill {
  id: string;
  name: string;
  content: string;
  category: string;
  isBuiltin: boolean;
}

interface GlobalSkill {
  id: string;
  name: string;
  content: string;
  category?: string;
}

interface SkillSelectorProps {
  /** 当前公文分类，用于默认勾选该分类的内置 Skill */
  category?: string;
  /** 选择变化回调 */
  onChange?: (selectedIds: string[]) => void;
  /** 构建好的 Skill 上下文文本回调（可直接拼入 system prompt） */
  onContextChange?: (contextText: string) => void;
  /** 是否默认展开 */
  defaultOpen?: boolean;
}

export function SkillSelector({
  category,
  onChange,
  onContextChange,
  defaultOpen = true,
}: SkillSelectorProps) {
  const [allSkills, setAllSkills] = useState<DbSkill[]>([]);
  const [globalSkills, setGlobalSkills] = useState<GlobalSkill[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [treeOpen, setTreeOpen] = useState<Record<string, boolean>>({});
  const [panelOpen, setPanelOpen] = useState(defaultOpen);

  // 加载 Skill 列表
  useEffect(() => {
    let gSkills: GlobalSkill[] = [];
    try {
      gSkills = getGlobalSkills();
      setGlobalSkills(gSkills);
    } catch {}

    fetch("/api/skills")
      .then((r) => r.json())
      .then((b) => {
        if (b.success && Array.isArray(b.data)) {
          setAllSkills(b.data);
          // 默认勾选：当前分类的内置 Skill + 所有全局 Skill
          const defaultIds: string[] = [];
          for (const s of b.data) {
            if (s.isBuiltin && (!category || s.category === category)) {
              defaultIds.push(s.id);
            }
          }
          for (const g of gSkills) {
            defaultIds.push(g.id);
          }
          setSelectedIds(new Set(defaultIds));

          const opens: Record<string, boolean> = {};
          const catSet = new Set<string>(b.data.map((s: DbSkill) => s.category));
          for (const c of catSet) opens[c] = true;
          if (gSkills.length > 0) opens["__global__"] = true;
          setTreeOpen(opens);
        }
      })
      .catch(() => {});
  }, [category]);

  // 构建上下文文本
  const buildContext = useCallback((): string => {
    const parts: string[] = [];
    const selectedDb = allSkills.filter((s) => selectedIds.has(s.id));
    if (selectedDb.length > 0) {
      const lines = selectedDb
        .map((s) => `- ${s.name}（${s.isBuiltin ? "内置" : "自定义"}）：${s.content}`)
        .join("\n");
      parts.push(`【已选写作规范(Skill)，请严格遵循】\n${lines}`);
    }
    const selectedGlobal = globalSkills.filter((s) => selectedIds.has(s.id));
    if (selectedGlobal.length > 0) {
      const lines = selectedGlobal
        .map((s) => `- ${s.name}${s.category ? `（${s.category}）` : ""}：${s.content}`)
        .join("\n");
      parts.push(`【全局写作规范(Skill)，请一并遵循】\n${lines}`);
    }
    return parts.join("\n\n");
  }, [allSkills, globalSkills, selectedIds]);

  // 选择变化时通知父组件
  useEffect(() => {
    onChange?.(Array.from(selectedIds));
    onContextChange?.(buildContext());
  }, [selectedIds, buildContext, onChange, onContextChange]);

  const skillsByCategory = useCallback((): Record<string, DbSkill[]> => {
    const map: Record<string, DbSkill[]> = {};
    for (const s of allSkills) {
      (map[s.category] ||= []).push(s);
    }
    return map;
  }, [allSkills]);

  const toggleSkill = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCategory = (key: string) => {
    setTreeOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (allSkills.length === 0 && globalSkills.length === 0) {
    return null;
  }

  return (
    <div className="border border-gray-200 rounded-xl bg-gray-50/50 overflow-hidden">
      {/* 折叠头 */}
      <button
        onClick={() => setPanelOpen(!panelOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100/60 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-red-500" />
          写作规范 Skill
          {selectedIds.size > 0 && (
            <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px]">
              {selectedIds.size}
            </span>
          )}
        </span>
        {panelOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>

      {/* 树内容 */}
      {panelOpen && (
        <div className="max-h-56 overflow-y-auto px-2 pb-2 space-y-1">
          {globalSkills.length > 0 && (
            <SkillGroup
              label="全局 Skill"
              count={globalSkills.length}
              isOpen={treeOpen["__global__"]}
              onToggle={() => toggleCategory("__global__")}
              allSelected={globalSkills.every((s) => selectedIds.has(s.id))}
              onSelectAll={(select) => {
                const ids = globalSkills.map((s) => s.id);
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  for (const id of ids) select ? next.add(id) : next.delete(id);
                  return next;
                });
              }}
            >
              {globalSkills.map((s) => (
                <SkillLeaf
                  key={s.id}
                  name={s.name}
                  checked={selectedIds.has(s.id)}
                  onToggle={() => toggleSkill(s.id)}
                  isGlobal
                />
              ))}
            </SkillGroup>
          )}

          {Object.entries(skillsByCategory()).map(([cat, skills]) => (
            <SkillGroup
              key={cat}
              label={`${cat}类`}
              count={skills.length}
              isOpen={treeOpen[cat]}
              onToggle={() => toggleCategory(cat)}
              allSelected={skills.every((s) => selectedIds.has(s.id))}
              onSelectAll={(select) => {
                const ids = skills.map((s) => s.id);
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  for (const id of ids) select ? next.add(id) : next.delete(id);
                  return next;
                });
              }}
            >
              {skills.map((s) => (
                <SkillLeaf
                  key={s.id}
                  name={s.name}
                  checked={selectedIds.has(s.id)}
                  onToggle={() => toggleSkill(s.id)}
                  isBuiltin={s.isBuiltin}
                />
              ))}
            </SkillGroup>
          ))}
        </div>
      )}
    </div>
  );
}

function SkillGroup({
  label,
  count,
  isOpen,
  onToggle,
  onSelectAll,
  allSelected,
  children,
}: {
  label: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  onSelectAll: (select: boolean) => void;
  allSelected: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-gray-200/80 bg-white overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="w-3 h-3 text-gray-400" />
        ) : (
          <ChevronRight className="w-3 h-3 text-gray-400" />
        )}
        <span>{label}</span>
        <span className="text-[10px] text-gray-400">({count})</span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectAll(!allSelected);
          }}
          className="text-[10px] px-1.5 py-0.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          {allSelected ? "取消全选" : "全选"}
        </button>
      </button>
      {isOpen && (
        <div className="pl-4 pr-1 pb-1 space-y-0.5 border-t border-gray-100/60">{children}</div>
      )}
    </div>
  );
}

function SkillLeaf({
  name,
  checked,
  onToggle,
  isBuiltin,
  isGlobal,
}: {
  name: string;
  checked: boolean;
  onToggle: () => void;
  isBuiltin?: boolean;
  isGlobal?: boolean;
}) {
  return (
    <label className="flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer hover:bg-red-50/50 transition-colors group">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={(e) => {
          e.preventDefault();
          onToggle();
        }}
        className={`flex items-center justify-center w-3.5 h-3.5 rounded-[3px] border transition-all flex-shrink-0 ${
          checked
            ? "bg-red-500 border-red-500 text-white"
            : "border-gray-300 group-hover:border-red-300"
        }`}
      >
        {checked && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
      </button>
      <span className={`text-[11px] truncate ${checked ? "text-gray-800 font-medium" : "text-gray-500"}`}>
        {name}
      </span>
      {isBuiltin && (
        <span className="text-[9px] px-1 rounded bg-blue-50 text-blue-500 flex-shrink-0">内置</span>
      )}
      {isGlobal && !isBuiltin && (
        <span className="text-[9px] px-1 rounded bg-amber-50 text-amber-600 flex-shrink-0">全局</span>
      )}
    </label>
  );
}
