// ─── 一键初稿 · 任务列表 ────────────────────────

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2, PenLine, ListTree, ExternalLink } from "lucide-react";
import { getTasks, deleteTask, type GenTask } from "@/lib/task-store";
import { CustomDialog } from "@/components/ui/CustomDialog";

function fmt(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<GenTask[]>([]);
  const [confirmDel, setConfirmDel] = useState<{ id: string } | null>(null);

  useEffect(() => {
    setTasks(getTasks());
  }, []);

  const remove = (id: string) => {
    setConfirmDel({ id });
  };

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-800 mb-1">生成任务</h2>
      <p className="text-xs text-gray-400 mb-5">每次成功保存的初稿都会记录在此</p>

      {tasks.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <p className="text-xs text-gray-400">暂无生成任务，去「出稿」或「大纲」生成初稿吧</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => {
            const Icon = t.kind === "quick" ? PenLine : ListTree;
            return (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white">
                <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-gray-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-800 truncate">{t.title}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {t.kind === "quick" ? "出稿" : "大纲"} · {t.category} · {fmt(t.createdAt)}
                  </div>
                </div>
                {t.docId && (
                  <Link
                    href={`/documents/${t.docId}`}
                    className="flex items-center gap-1 text-[11px] text-red-600 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" /> 打开
                  </Link>
                )}
                <button
                  onClick={() => remove(t.id)}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] text-red-600 bg-red-50 rounded hover:bg-red-100"
                >
                  <Trash2 className="w-3 h-3" /> 删除
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 删除确认弹窗 */}
      <CustomDialog
        open={!!confirmDel}
        mode="confirm"
        title="删除任务记录"
        message="确定删除该任务记录？删除后无法恢复。"
        confirmText="确定删除"
        cancelText="取消"
        onConfirm={() => {
          if (confirmDel) {
            setTasks(deleteTask(confirmDel.id));
            setConfirmDel(null);
          }
        }}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}
