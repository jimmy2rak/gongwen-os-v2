// ─── 一键初稿生成任务（localStorage） ────────────

"use client";

export type TaskKind = "quick" | "outline";

export interface GenTask {
  id: string;
  title: string;
  category: string;
  kind: TaskKind;
  createdAt: number;
  docId?: string;
}

const KEY = "gw-tasks";

function read(): GenTask[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(list: GenTask[]): GenTask[] {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}

export function getTasks(): GenTask[] {
  return read().sort((a, b) => b.createdAt - a.createdAt);
}

export function addTask(t: Omit<GenTask, "id" | "createdAt">): GenTask {
  const task: GenTask = { ...t, id: "tk" + Math.random().toString(36).slice(2, 10), createdAt: Date.now() };
  const list = [task, ...read()].slice(0, 100);
  return write(list)[0];
}

export function deleteTask(id: string): GenTask[] {
  return write(read().filter((x) => x.id !== id));
}
