// ─── 画像设置面板（按账号隔离，数据库为真相来源）─────────
// 管理默认画像（姓名/单位/级别/类型）。数据存 user_profiles 表（按 user_id 隔离），
// 写操作后同步更新预加载缓存，保证 AI 等同步场景读到的也是当前账号的画像。

"use client";

import { useEffect, useState } from "react";
import { Plus, Star, Trash2, Pencil, Check, X } from "lucide-react";
import { CustomDialog } from "@/components/ui/CustomDialog";
import { useAuthStore } from "@/stores/auth.store";
import { writePreload } from "@/lib/preload-cache";
import { migrateLocalProfilesToServer, type Profile } from "@/lib/profile-store";

const LEVELS = ["省级", "市级", "区级", "乡镇级"];
const TYPES = ["机关", "事业单位", "国企", "民企", "学校", "医院", "银行", "律所", "基层单位", "其他"];

export default function ProfilePanel() {
  const userId = useAuthStore((s) => s.user?.id);
  const [list, setList] = useState<Profile[]>([]);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [form, setForm] = useState<Profile>({
    id: "",
    name: "",
    unit: "",
    level: LEVELS[1],
    type: TYPES[0],
  });
  const [showForm, setShowForm] = useState(false);
  const [confirmDel, setConfirmDel] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfiles = async () => {
    if (!userId) return;
    try {
      const res = await fetch("/api/profiles", { credentials: "include" });
      const body = await res.json();
      if (body.success && Array.isArray(body.data)) {
        const data = body.data as Profile[];
        setList(data);
        // 同步预加载缓存，供 AI 等同步场景读取
        writePreload(userId, "profiles", { success: true, data });
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 一次性迁移旧版 localStorage 画像到服务端（按账号入库）
    migrateLocalProfilesToServer().finally(() => loadProfiles());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const openNew = () => {
    setForm({ id: "", name: "", unit: "", level: LEVELS[1], type: TYPES[0] });
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (p: Profile) => {
    setForm({ ...p });
    setEditing(p);
    setShowForm(true);
  };

  const submit = async () => {
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      unit: form.unit.trim(),
      level: form.level,
      type: form.type,
      isDefault: !!form.isDefault,
    };
    try {
      if (editing) {
        await fetch("/api/profiles", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id: editing.id, ...payload }),
        });
      } else {
        await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
      }
      setShowForm(false);
      await loadProfiles();
    } catch {
    }
  };

  const remove = async (id: string) => {
    try {
      await fetch(`/api/profiles?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
      setConfirmDel(null);
      await loadProfiles();
    } catch {
    }
  };

  const setDefault = async (id: string) => {
    const target = list.find((p) => p.id === id);
    if (!target) return;
    try {
      await fetch("/api/profiles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, name: target.name, unit: target.unit, level: target.level, type: target.type, isDefault: true }),
      });
      await loadProfiles();
    } catch {
    }
  };

  const def = list.find((p) => p.isDefault) || list[0] || null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-800">用户画像</h3>
          <p className="text-xs text-gray-400 mt-0.5">当前默认画像将作为身份背景注入 AI 公文生成与对话（按账号独立保存）</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          <Plus className="w-3.5 h-3.5" /> 新建画像
        </button>
      </div>

      {list.length === 0 && !showForm && !loading && (
        <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <p className="text-xs text-gray-400">尚未配置画像，点击右上角新建</p>
        </div>
      )}

      {/* 卡片列表 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {list.map((p) => {
          const isDef = def?.id === p.id;
          return (
            <div
              key={p.id}
              className={`p-4 rounded-xl border bg-white ${
                isDef ? "border-red-300 ring-1 ring-red-200" : "border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate">{p.name || "（未命名）"}</div>
                  <div className="text-xs text-gray-500 mt-1 truncate">{p.unit || "（未填单位）"}</div>
                  <div className="text-[11px] text-gray-400 mt-2">
                    {p.level} · {p.type}
                  </div>
                </div>
                {isDef && (
                  <span className="flex items-center gap-1 text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                    <Star className="w-3 h-3" /> 默认
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 mt-3">
                {!isDef && (
                  <button
                    onClick={() => setDefault(p.id)}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                  >
                    <Check className="w-3 h-3" /> 设为默认
                  </button>
                )}
                <button
                  onClick={() => openEdit(p)}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                >
                  <Pencil className="w-3 h-3" /> 编辑
                </button>
                <button
                  onClick={() => remove(p.id)}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] text-red-600 bg-red-50 rounded hover:bg-red-100"
                >
                  <Trash2 className="w-3 h-3" /> 删除
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 表单 */}
      {showForm && (
        <div className="border border-gray-200 rounded-xl p-5 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-700">{editing ? "编辑画像" : "新建画像"}</h4>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs text-gray-500">姓名 *</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="请输入姓名"
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-300"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">单位</span>
              <input
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="请输入单位名称"
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-300"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">级别</span>
              <select
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-red-300"
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">类型</span>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-red-300"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 mt-4">
            <input
              type="checkbox"
              checked={!!form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
            />
            <span className="text-xs text-gray-600">设为默认画像</span>
          </label>
          <div className="flex justify-end gap-2 mt-5">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={submit}
              disabled={!form.name.trim()}
              className="px-4 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300"
            >
              保存
            </button>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      <CustomDialog
        open={!!confirmDel}
        mode="confirm"
        title="删除用户画像"
        message="确定删除该画像？删除后无法恢复。"
        confirmText="确定删除"
        cancelText="取消"
        onConfirm={() => { if (confirmDel) remove(confirmDel.id); }}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}
