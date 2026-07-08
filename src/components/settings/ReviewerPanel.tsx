// ─── 审阅人管理面板（增强版） ────────────────────
// 管理审阅人列表（姓名+部门），部门下拉选单 + 部门管理弹窗
// 存 localStorage "gw-reviewers"

"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, X, UserCheck, Building2, Users, AlertTriangle } from "lucide-react";
import { CustomDialog } from "@/components/ui/CustomDialog";

interface Reviewer {
  id: string;
  name: string;
  department: string;
}

const DEFAULT_REVIEWERS: Reviewer[] = [
  { id: "r1", name: "张主任", department: "办公室" },
  { id: "r2", name: "李副主任", department: "办公室" },
  { id: "r3", name: "王科长", department: "综合科" },
  { id: "r4", name: "赵副科长", department: "综合科" },
];

const STORAGE_KEY = "gw-reviewers";

function uid() { return "rv" + Math.random().toString(36).slice(2, 10); }

function loadReviewers(): Reviewer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_REVIEWERS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_REVIEWERS;
  } catch { return DEFAULT_REVIEWERS; }
}

function saveReviewers(list: Reviewer[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

/** 从审阅人列表中提取去重排序后的部门列表 */
function getDepartments(list: Reviewer[]): string[] {
  return Array.from(new Set(list.map((r) => r.department).filter(Boolean))).sort();
}

export default function ReviewerPanel() {
  const [list, setList] = useState<Reviewer[]>([]);
  const [editing, setEditing] = useState<Reviewer | null>(null);
  const [form, setForm] = useState<Reviewer>({ id: "", name: "", department: "" });
  const [showForm, setShowForm] = useState(false);
  const [confirmDel, setConfirmDel] = useState<{ id: string } | null>(null);

  // 部门下拉选单：新增部门 inline 模式
  const [showNewDeptInput, setShowNewDeptInput] = useState(false);
  const [newDeptValue, setNewDeptValue] = useState("");

  // 部门管理弹窗
  const [showDeptModal, setShowDeptModal] = useState(false);

  // 删除部门确认（若有成员需迁移）
  const [deptDeleteConfirm, setDeptDeleteConfirm] = useState<{
    dept: string;
    migrationTarget: string;
    memberCount: number;
  } | null>(null);

  useEffect(() => { setList(loadReviewers()); }, []);

  const refresh = () => setList(loadReviewers());
  const departments = getDepartments(list);

  // ── 新增/编辑审阅人 ──
  const openNew = () => {
    setForm({ id: uid(), name: "", department: departments.length > 0 ? departments[0] : "" });
    setEditing(null);
    setShowNewDeptInput(false);
    setNewDeptValue("");
    setShowForm(true);
  };

  const openEdit = (r: Reviewer) => {
    setForm({ ...r });
    setEditing(r);
    setShowNewDeptInput(false);
    setNewDeptValue("");
    setShowForm(true);
  };

  const submit = () => {
    if (!form.name.trim()) return;
    const dept = form.department.trim() || "";
    const updated = editing
      ? list.map((r) => r.id === editing.id ? { ...form, name: form.name.trim(), department: dept } : r)
      : [...list, { ...form, name: form.name.trim(), department: dept }];
    saveReviewers(updated);
    refresh();
    setShowForm(false);
  };

  const remove = (id: string) => {
    setConfirmDel({ id });
  };

  // ── 部门选择：下拉选单 + 新增部门 inline ──
  const handleDeptSelect = (val: string) => {
    if (val === "__new__") {
      setShowNewDeptInput(true);
      setNewDeptValue("");
      setForm({ ...form, department: "" });
    } else {
      setShowNewDeptInput(false);
      setNewDeptValue("");
      setForm({ ...form, department: val });
    }
  };

  const confirmNewDept = () => {
    const name = newDeptValue.trim();
    if (name) {
      setForm({ ...form, department: name });
    }
    setShowNewDeptInput(false);
    setNewDeptValue("");
  };

  // ── 部门管理 ──
  // 获取某部门的成员
  const getDeptMembers = (dept: string) => list.filter((r) => r.department === dept);

  // 删除部门：如果部门有人则弹出迁移确认
  const handleDeleteDepartment = (dept: string) => {
    const members = getDeptMembers(dept);
    if (members.length === 0) {
      // 无人，直接删除（实际是清空部门字段）
      const updated = list.map((r) => r.department === dept ? { ...r, department: "" } : r);
      saveReviewers(updated);
      refresh();
    } else {
      // 有人，弹出迁移确认
      const otherDepts = departments.filter((d) => d !== dept);
      setDeptDeleteConfirm({
        dept,
        migrationTarget: otherDepts.length > 0 ? otherDepts[0] : "",
        memberCount: members.length,
      });
    }
  };

  const confirmDeleteDept = (action: "migrate" | "force") => {
    if (!deptDeleteConfirm) return;
    const { dept, migrationTarget } = deptDeleteConfirm;
    let updated: Reviewer[];
    if (action === "migrate") {
      // 迁移到目标部门
      updated = list.map((r) =>
        r.department === dept ? { ...r, department: migrationTarget } : r
      );
    } else {
      // 直接删除（清空部门字段）
      updated = list.map((r) =>
        r.department === dept ? { ...r, department: "" } : r
      );
    }
    saveReviewers(updated);
    refresh();
    setDeptDeleteConfirm(null);
  };

  return (
    <div>
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-800">审阅人管理</h3>
          <p className="text-xs text-gray-400 mt-0.5">配置公文审阅环节的审阅人名单</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowDeptModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
            <Building2 className="w-3.5 h-3.5" /> 部门管理
          </button>
          <button onClick={openNew}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">
            <Plus className="w-3.5 h-3.5" /> 新增审阅人
          </button>
        </div>
      </div>

      {/* 审阅人列表 */}
      <div className="space-y-2">
        {list.map((r) => (
          <div key={r.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
            <div className="w-8 h-8 rounded-full bg-[#163f3a]/10 flex items-center justify-center flex-shrink-0">
              <UserCheck className="w-4 h-4 text-[#163f3a]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800">{r.name}</p>
              <p className="text-xs text-gray-400">{r.department || "未填部门"}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => openEdit(r)}
                className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => remove(r.id)}
                className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {list.length === 0 && !showForm && (
        <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <p className="text-xs text-gray-400">暂无审阅人，点击右上角新增</p>
        </div>
      )}

      {/* ── 新增/编辑审阅人表单 ── */}
      {showForm && (
        <div className="mt-4 border border-gray-200 rounded-xl p-5 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-700">{editing ? "编辑审阅人" : "新增审阅人"}</h4>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs text-gray-500">姓名 *</span>
              <input value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="姓名/职务"
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-300" />
            </label>

            {/* 部门：下拉选单 + 新增部门 inline */}
            <label className="block">
              <span className="text-xs text-gray-500">部门</span>
              {showNewDeptInput ? (
                <div className="mt-1 flex gap-1">
                  <input
                    value={newDeptValue}
                    onChange={(e) => setNewDeptValue(e.target.value)}
                    placeholder="输入新部门名称"
                    autoFocus
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-300"
                    onKeyDown={(e) => { if (e.key === "Enter") confirmNewDept(); if (e.key === "Escape") setShowNewDeptInput(false); }}
                  />
                  <button onClick={confirmNewDept} disabled={!newDeptValue.trim()}
                    className="px-2.5 py-1 text-xs bg-[#163f3a] text-white rounded-lg hover:bg-[#163f3a]/80 disabled:bg-gray-300">
                    确定
                  </button>
                  <button onClick={() => setShowNewDeptInput(false)}
                    className="px-2 py-1 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                    取消
                  </button>
                </div>
              ) : (
                <select
                  value={form.department}
                  onChange={(e) => handleDeptSelect(e.target.value)}
                  className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-red-300 appearance-none"
                  style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center", paddingRight: "28px" }}
                >
                  {departments.length === 0 && <option value="">（暂无部门，请先新增）</option>}
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                  <option value="__new__" className="text-[#163f3a] font-medium">+ 新增部门</option>
                </select>
              )}
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setShowForm(false)}
              className="px-4 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">取消</button>
            <button onClick={submit} disabled={!form.name.trim()}
              className="px-4 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300">保存</button>
          </div>
        </div>
      )}

      {/* ── 部门管理弹窗 ── */}
      {showDeptModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setShowDeptModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[480px] max-w-[90vw] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                <Building2 className="w-4 h-4" /> 部门管理
              </h3>
              <button onClick={() => setShowDeptModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto space-y-2">
              {departments.length === 0 ? (
                <div className="text-center py-10 text-xs text-gray-400">暂无部门</div>
              ) : (
                departments.map((dept) => {
                  const members = getDeptMembers(dept);
                  return (
                    <div key={dept} className="p-3 bg-white rounded-xl border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-800">{dept}</span>
                          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            <Users className="w-2.5 h-2.5 inline mr-0.5" />
                            {members.length} 人
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteDepartment(dept)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                          title="删除部门"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {/* 部门成员列表 */}
                      {members.length > 0 && (
                        <div className="mt-2 ml-6 space-y-1">
                          {members.map((m) => (
                            <div key={m.id} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                              <UserCheck className="w-3 h-3 text-gray-300" />
                              {m.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
              <button onClick={() => setShowDeptModal(false)}
                className="px-4 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 删除部门确认弹窗（含人员迁移） ── */}
      {deptDeleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40" onClick={() => setDeptDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-96 max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-800">删除部门「{deptDeleteConfirm.dept}」</h3>
                <p className="text-xs text-gray-500 mt-1">
                  该部门下有 <strong className="text-red-600">{deptDeleteConfirm.memberCount}</strong> 名审阅人，请选择处理方式
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {/* 迁移选项 */}
              {departments.filter((d) => d !== deptDeleteConfirm.dept).length > 0 && (
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <label className="block text-xs text-gray-500 mb-1.5">迁移人员到</label>
                  <select
                    value={deptDeleteConfirm.migrationTarget}
                    onChange={(e) => setDeptDeleteConfirm({ ...deptDeleteConfirm, migrationTarget: e.target.value })}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-red-300"
                  >
                    {departments.filter((d) => d !== deptDeleteConfirm.dept).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => confirmDeleteDept("migrate")}
                    className="mt-2 w-full px-4 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    迁移到「{deptDeleteConfirm.migrationTarget}」后删除
                  </button>
                </div>
              )}

              {/* 直接删除 */}
              <button
                onClick={() => confirmDeleteDept("force")}
                className="w-full px-4 py-2 text-xs bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
              >
                直接删除部门（人员部门清空为"未填部门"）
              </button>

              <button
                onClick={() => setDeptDeleteConfirm(null)}
                className="w-full px-4 py-2 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      <CustomDialog
        open={!!confirmDel}
        mode="confirm"
        title="删除审阅人"
        message="确定删除该审阅人？删除后无法恢复。"
        confirmText="确定删除"
        cancelText="取消"
        onConfirm={() => {
          if (confirmDel) {
            saveReviewers(list.filter((r) => r.id !== confirmDel.id));
            refresh();
            setConfirmDel(null);
          }
        }}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}
