// ─── 历史版本弹窗 — 左右分栏 + 相邻版本自动对比 ──
// P3-1: 点击左侧版本 → 自动对比上一相邻版本，分段差异高亮
// P3-2: 版本恢复二次确认弹窗

"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Clock, FileText, RotateCcw, X, AlertCircle, GitCommit } from "lucide-react";
import { diffWords } from "diff";

interface Version {
  id: string;
  type: string;
  content: string;
  createdAt: string;
  versionNumber: number;
}

interface HistoryModalProps {
  docId: string | null;
  open: boolean;
  onClose: () => void;
}

interface DiffRow {
  type: "新增" | "删除" | "修改";
  before: string;
  after: string;
}

/** 提取纯文本（标签→空格避免词粘连，空白归一） */
function stripHtml(html: string): string {
  if (!html || typeof html !== "string") return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** 格式化时间 */
function fmtDateTime(ts: string): string {
  if (!ts) return "-";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "-";
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${y}/${m}/${day} ${h}:${min}`;
  } catch {
    return "-";
  }
}

/** 格式化日期段（表格时间列） */
function fmtDateOnly(ts: string): string {
  if (!ts) return "-";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "-";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}\n${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "-";
  }
}

/** 构建变更记录表格行：按新增/删除/修改拆分，并截取对应上下文 */
function buildDiffRows(baseText: string, newText: string): DiffRow[] {
  // 原版为空、新版有内容 → 整版新增
  if (!baseText && newText) {
    return [{ type: "新增", before: "（初始空白文档）", after: newText }];
  }
  // 两版一致
  if (baseText === newText) return [];

  const parts = diffWords(baseText, newText);
  const rows: DiffRow[] = [];

  let i = 0;
  while (i < parts.length) {
    if (parts[i].added || parts[i].removed) {
      const groupStart = i;
      while (i < parts.length && (parts[i].added || parts[i].removed)) i++;
      const groupEnd = i; // exclusive

      const removed = parts.slice(groupStart, groupEnd).filter((p) => p.removed).map((p) => p.value).join("");
      const added = parts.slice(groupStart, groupEnd).filter((p) => p.added).map((p) => p.value).join("");
      const beforeCtx = groupStart > 0 ? parts[groupStart - 1].value : "";
      const afterCtx = groupEnd < parts.length ? parts[groupEnd].value : "";

      let type: "新增" | "删除" | "修改";
      let before: string;
      let after: string;

      if (removed && added) {
        type = "修改";
        before = (beforeCtx.slice(-10) + removed + afterCtx.slice(0, 10)).trim();
        after = (beforeCtx.slice(-10) + added + afterCtx.slice(0, 10)).trim();
      } else if (removed) {
        type = "删除";
        before = removed.trim(); // 完整展示被删除片段
        after = (afterCtx.slice(0, 10) || "（已删除）").trim();
      } else {
        type = "新增";
        before = (beforeCtx.slice(-20) || "（新增处前文）").trim();
        after = added.trim(); // 完整展示新增片段
      }

      if (before || after) rows.push({ type, before, after });
    } else {
      i++;
    }
  }

  return rows;
}

export function HistoryModal({ docId, open, onClose }: HistoryModalProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 内部弹窗
  const [dialog, setDialog] = useState<{ title: string; message: string } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<{ id: string; versionNumber: number; content: string } | null>(null);

  const showVer = (vn: number) => `v${vn}`;

  const refreshVersions = useCallback(async () => {
    if (!docId) return;
    setError("");
    setVersions([]);
    setSelectedId(null);
    try {
      const res = await fetch(`/api/documents/${docId}/versions`);
      const data = await res.json();
      if (data.success && data.data) {
        const list = data.data as Version[];
        setVersions(list);
        if (list.length > 0) setSelectedId(list[0].id);
      }
    } catch {}
  }, [docId]);

  useEffect(() => {
    if (!open || !docId) return;
    setVersions([]);
    setDiffLoading(false);
    setSelectedId(null);
    setLoading(true);
    setError("");
    fetch(`/api/documents/${docId}/versions`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          const list = data.data as Version[];
          setVersions(list);
          if (list.length > 0) setSelectedId(list[0].id);
        } else {
          setError(data.error?.message || "获取版本失败");
        }
      })
      .catch(() => setError("网络错误"))
      .finally(() => setLoading(false));
  }, [open, docId]);

  const selectedVer = useMemo(() => versions.find((v) => v.id === selectedId), [versions, selectedId]);

  const prevVer = useMemo(() => {
    if (!selectedVer) return null;
    const idx = versions.findIndex((v) => v.id === selectedVer.id);
    if (idx === -1) return null;
    return idx < versions.length - 1 ? versions[idx + 1] : null;
  }, [versions, selectedVer]);

  // 变更记录表格行（纯文本 diff，消除 HTML 干扰）
  const diffRows = useMemo(() => {
    if (!selectedVer || !prevVer) return null;
    const baseOrigin = stripHtml(prevVer.content);
    const newChanged = stripHtml(selectedVer.content);
    // 计算完成后通知视图
    if (typeof window !== "undefined") {
      (window as any).__diffReady__ = true;
    }
    return buildDiffRows(baseOrigin, newChanged);
  }, [selectedVer, prevVer]);

  // 切换版本 ID 时：清空旧 diff + 标记 loading
  const handleSelectVersion = (id: string) => {
    // 先清空 state，触发 re-render 清空旧表格
    setSelectedId(null);
    setDiffLoading(true);
    // 微任务后设置新 ID，useMemo 基于新 ID 重新计算 diff
    Promise.resolve().then(() => {
      setSelectedId(id);
      // 下一个微任务关闭 loading（确保 useMemo 已计算完）
      Promise.resolve().then(() => setDiffLoading(false));
    });
  };

  const performRestore = async (versionId: string, versionNumber: number) => {
    if (!docId) return;
    try {
      const res = await fetch(`/api/documents/${docId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      if (res.ok) {
        setDialog({ title: "恢复成功", message: `已恢复到 ${showVer(versionNumber)}` });
        await refreshVersions();
        setTimeout(() => window.location.reload(), 1000);
      } else {
        const err = await res.json();
        setDialog({ title: "恢复失败", message: err.error?.message || "未知错误" });
      }
    } catch {
      setDialog({ title: "恢复失败", message: "网络错误，请重试" });
    }
    setConfirmRestore(null);
  };

  useEffect(() => {
    if (typeof window !== "undefined") (window as any).__refreshVersions__ = refreshVersions;
    return () => { if (typeof window !== "undefined") delete (window as any).__refreshVersions__; };
  }, [refreshVersions]);

  if (!open) return null;

  return (<>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-[780px] h-[560px] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-medium text-gray-800">版本历史</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">加载中...</div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-sm text-red-500">{error}</div>
        ) : versions.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
            <FileText className="w-8 h-8 text-gray-200 mx-auto mb-2" />暂无版本，请先保存文档
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* ── 左侧 30% 版本列表 ── */}
            <div className="w-[30%] min-w-[160px] border-r border-gray-200 overflow-y-auto bg-gray-50/50 p-2 space-y-1">
              {versions.map((v) => {
                const isSelected = v.id === selectedId;
                return (
                  <div key={v.id}
                    onClick={() => handleSelectVersion(v.id)}
                    className={`p-2.5 rounded-lg cursor-pointer transition-colors ${
                      isSelected ? "bg-red-50 border border-red-200" : "hover:bg-gray-100 border border-transparent"
                    }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`text-xs font-semibold ${isSelected ? "text-red-700" : "text-gray-700"}`}>{showVer(v.versionNumber)}</span>
                        <span className="text-[9px] px-1 py-0.5 bg-gray-200 text-gray-500 rounded truncate max-w-[60px]">{v.type}</span>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmRestore({ id: v.id, versionNumber: v.versionNumber, content: v.content }); }}
                        className="flex items-center gap-0.5 px-1.5 py-0.5 bg-red-600 text-white text-[9px] rounded hover:bg-red-700 flex-shrink-0">
                        <RotateCcw className="w-2.5 h-2.5" />恢复
                      </button>
                    </div>
                    <div className="text-[9px] text-gray-400 mt-1">{fmtDateTime(v.createdAt)}</div>
                  </div>
                );
              })}
            </div>

            {/* ── 右侧 70% 变更记录表 ── */}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              {diffLoading ? (
                <div className="flex-1 flex items-center justify-center text-xs text-gray-400">计算差异中...</div>
              ) : !selectedVer ? (
                <div className="flex-1 flex items-center justify-center text-xs text-gray-400">请选择一个版本查看差异</div>
              ) : !prevVer ? (
                <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
                  <div className="text-center">
                    <GitCommit className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p>{selectedVer.versionNumber === 0 ? "这是文档初始基准版本，无更早历史" : "当前为文档最新版本，无前置历史可对比"}</p>
                  </div>
                </div>
              ) : diffRows?.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
                  <div className="text-center">
                    <FileText className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p>两个相邻版本内容完全一致，无改动</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-xs text-gray-500 font-medium flex-shrink-0">
                    以 <span className="text-blue-600 font-semibold">{showVer(prevVer.versionNumber)}</span> 为原版，查看 <span className="text-red-600 font-semibold">{showVer(selectedVer.versionNumber)}</span> 的改动内容
                  </div>
                  <div className="flex-1 overflow-auto p-2">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="text-left text-gray-500 bg-gray-100">
                          <th className="px-2 py-1.5 font-medium w-14 border-b border-gray-200">类型</th>
                          <th className="px-2 py-1.5 font-medium w-[35%] border-b border-gray-200">修改前</th>
                          <th className="px-2 py-1.5 font-medium w-[35%] border-b border-gray-200">修改后</th>
                          <th className="px-2 py-1.5 font-medium w-20 border-b border-gray-200">时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diffRows?.map((row, ri) => (
                          <tr key={ri} className="border-b border-gray-100 last:border-b-0 align-top">
                            <td className="px-2 py-2">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                row.type === "新增" ? "bg-green-100 text-green-700" :
                                row.type === "删除" ? "bg-red-100 text-red-700" :
                                "bg-amber-100 text-amber-700"
                              }`}>{row.type}</span>
                            </td>
                            <td className="px-2 py-2">
                              <div className={`whitespace-pre-wrap break-words leading-relaxed ${
                                row.type === "删除" || row.type === "修改" ? "bg-red-50 text-red-700 line-through rounded px-1 py-0.5" : "text-gray-500"
                              }`}>
                                {row.before}
                              </div>
                            </td>
                            <td className="px-2 py-2">
                              <div className={`whitespace-pre-wrap break-words leading-relaxed ${
                                row.type === "新增" || row.type === "修改" ? "bg-green-50 text-green-800 rounded px-1 py-0.5" : "text-gray-500"
                              }`}>
                                {row.after}
                              </div>
                            </td>
                            <td className="px-2 py-2 text-gray-400 whitespace-pre-line">{fmtDateOnly(selectedVer.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>

    {/* 回滚确认弹窗 */}
    {confirmRestore && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={() => setConfirmRestore(null)}>
        <div className="bg-white rounded-2xl shadow-2xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-amber-500" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-gray-800">确认恢复历史版本？</h3>
              <p className="text-xs text-gray-500 mt-1">恢复后当前文档内容将被覆盖，未保存修改会丢失，是否确认？</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setConfirmRestore(null)}
              className="flex-1 px-4 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">取消</button>
            <button onClick={() => performRestore(confirmRestore.id, confirmRestore.versionNumber)}
              className="flex-1 px-4 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">确认恢复</button>
          </div>
        </div>
      </div>
    )}

    {/* 提示弹窗 */}
    {dialog && (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={() => setDialog(null)}>
        <div className="bg-white rounded-2xl shadow-2xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-gray-800">{dialog.title}</h3>
              <p className="text-xs text-gray-500 mt-1">{dialog.message}</p>
            </div>
          </div>
          <button onClick={() => setDialog(null)}
            className="w-full px-4 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">确定</button>
        </div>
      </div>
    )}
  </>);
}
