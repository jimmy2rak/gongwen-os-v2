// ─── 用户权限管理面板（仅超级管理员可见）──────
// 普通用户以列表展示；管理员/超管以大卡片展示。
// 点击管理员卡片展开抽屉菜单，可开关该管理员拥有的权限。

"use client";

import { useEffect, useState } from "react";
import {
  Shield, Users, User as UserIcon, ChevronDown, ChevronUp,
  Check, X, Loader2, Crown, UserCog,
} from "lucide-react";

interface PermissionDef {
  id: string;
  label: string;
  description: string;
}

interface UserItem {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: "user" | "admin" | "super_admin";
  createdAt: number;
  permissions: string[];
}

const ROLE_LABELS: Record<string, string> = {
  user: "普通用户",
  admin: "管理员",
  super_admin: "超级管理员",
};

const ROLE_COLORS: Record<string, string> = {
  user: "bg-gray-100 text-gray-500",
  admin: "bg-blue-50 text-blue-600",
  super_admin: "bg-red-50 text-red-600",
};

const inputCls =
  "mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-red-300";

export default function UserAdminPanel() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [perms, setPerms] = useState<PermissionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const body = await res.json();
      if (body.success) {
        setUsers(body.data || []);
        setPerms(body.permissions || []);
      } else {
        setError(body.error?.message || "加载失败");
      }
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveRoleAndPerms = async (userId: string, role: string, permissions: string[]) => {
    setSavingId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role, permissions }),
      });
      const body = await res.json();
      if (body.success) {
        await loadData();
      } else {
        setError(body.error?.message || "保存失败");
      }
    } catch {
      setError("保存失败");
    } finally {
      setSavingId(null);
    }
  };

  const togglePermission = (user: UserItem, permId: string) => {
    const next = user.permissions.includes(permId)
      ? user.permissions.filter((p) => p !== permId)
      : [...user.permissions, permId];
    saveRoleAndPerms(user.id, user.role, next);
  };

  const setRole = (user: UserItem, role: "user" | "admin" | "super_admin") => {
    const nextPerms = role === "super_admin" ? [] : user.permissions;
    saveRoleAndPerms(user.id, role, nextPerms);
    if (expandedId === user.id && role === "super_admin") {
      setExpandedId(null);
    }
  };

  const superAdmins = users.filter((u) => u.role === "super_admin");
  const admins = users.filter((u) => u.role === "admin");
  const normalUsers = users.filter((u) => u.role === "user");

  const renderAvatar = (u: UserItem) => (
    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-400">
      {u.avatar ? (
        <img src={u.avatar} alt="" className="w-full h-full rounded-full object-cover" />
      ) : (
        <UserIcon className="w-5 h-5" />
      )}
    </div>
  );

  const renderPermissionTags = (u: UserItem) => {
    if (u.role === "super_admin") {
      return <span className="text-[11px] text-red-500">拥有所有权限</span>;
    }
    if (u.permissions.length === 0) {
      return <span className="text-[11px] text-gray-400">暂无额外权限</span>;
    }
    return (
      <div className="flex flex-wrap gap-1 mt-1.5">
        {u.permissions.map((pid) => {
          const p = perms.find((x) => x.id === pid);
          return (
            <span key={pid} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
              {p?.label || pid}
            </span>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return <div className="text-center py-10 text-sm text-gray-400">加载用户列表中…</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-800">用户权限管理</h3>
          <p className="text-xs text-gray-400 mt-0.5">仅超级管理员可见 · 分配管理员权限并管理权限开关</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 bg-red-50 text-red-600 text-xs rounded-lg flex items-center gap-2">
          <X className="w-3.5 h-3.5" /> {error}
        </div>
      )}

      {/* 超级管理员 */}
      {superAdmins.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-4 h-4 text-red-500" />
            <h4 className="text-xs font-medium text-gray-700">超级管理员</h4>
            <span className="text-[10px] text-gray-400">{superAdmins.length} 人</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {superAdmins.map((u) => (
              <div key={u.id} className="p-4 bg-white rounded-xl border border-red-100 shadow-sm">
                <div className="flex items-center gap-3">
                  {renderAvatar(u)}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-800 truncate">{u.name || u.email}</div>
                    <div className="text-[11px] text-gray-400 truncate">{u.email}</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-50">
                  {renderPermissionTags(u)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 管理员 */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <UserCog className="w-4 h-4 text-blue-500" />
            <h4 className="text-xs font-medium text-gray-700">管理员</h4>
            <span className="text-[10px] text-gray-400">{admins.length} 人</span>
          </div>
        </div>
        {admins.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p className="text-xs text-gray-400">暂无管理员，可在普通用户列表中提升</p>
          </div>
        ) : (
          <div className="space-y-3">
            {admins.map((u) => {
              const expanded = expandedId === u.id;
              return (
                <div key={u.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedId(expanded ? null : u.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {renderAvatar(u)}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-800 truncate">{u.name || u.email}</div>
                          <div className="text-[11px] text-gray-400 truncate">{u.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[10px] px-2 py-0.5 rounded ${ROLE_COLORS[u.role]}`}>
                          {ROLE_LABELS[u.role]}
                        </span>
                        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </div>
                    </div>
                    <div className="mt-3">
                      {renderPermissionTags(u)}
                    </div>
                  </div>

                  {/* 抽屉：权限开关 */}
                  {expanded && (
                    <div className="border-t border-gray-100 bg-gray-50 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-gray-700">权限开关</span>
                        {savingId === u.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {perms.map((p) => {
                          const checked = u.permissions.includes(p.id);
                          return (
                            <label
                              key={p.id}
                              className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                                checked ? "bg-white border-blue-200" : "bg-white border-gray-200 hover:border-gray-300"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePermission(u, p.id)}
                                className="mt-0.5 w-3.5 h-3.5 rounded border-gray-300 text-[#163f3a] focus:ring-[#163f3a]/30"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-gray-700">{p.label}</div>
                                <div className="text-[10px] text-gray-400">{p.description}</div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      <div className="mt-4 pt-3 border-t border-gray-200 flex justify-end">
                        <button
                          onClick={() => setRole(u, "user")}
                          disabled={savingId === u.id}
                          className="text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          撤销管理员权限
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 普通用户 */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-gray-400" />
          <h4 className="text-xs font-medium text-gray-700">普通用户</h4>
          <span className="text-[10px] text-gray-400">{normalUsers.length} 人</span>
        </div>
        {normalUsers.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p className="text-xs text-gray-400">暂无普通用户</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {normalUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-3 p-3 hover:bg-gray-50">
                <div className="flex items-center gap-3 min-w-0">
                  {renderAvatar(u)}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-gray-800 truncate">{u.name || u.email}</div>
                    <div className="text-[11px] text-gray-400 truncate">{u.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <select
                    value={u.role}
                    onChange={(e) => setRole(u, e.target.value as any)}
                    disabled={savingId === u.id}
                    className={`text-xs border rounded-lg px-2 py-1 focus:outline-none ${inputCls} w-auto`}
                  >
                    <option value="user">普通用户</option>
                    <option value="admin">管理员</option>
                    <option value="super_admin">超级管理员</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
