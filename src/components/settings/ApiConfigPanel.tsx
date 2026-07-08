"use client";

import { useState, useEffect, useCallback } from "react";
import {
  KeyRound, Plus, Edit3, Trash2, ShieldCheck, AlertCircle, CheckCircle, Power,
} from "lucide-react";

interface ApiKeyItem {
  id: string;
  provider: string;
  label: string;
  masked: string;
  models: string[];
  defaultModel: string | null;
  isActive: boolean;
  createdAt: number;
}

interface ProviderPreset {
  id: string;
  label: string;
  baseURL: string;
  models: string[];
  openaiCompatible: boolean;
}

interface ModalState {
  id?: string;
  provider: string;
  apiKey: string;
  models: string[];
  defaultModel: string;
}

export default function ApiConfigPanel() {
  const [items, setItems] = useState<ApiKeyItem[]>([]);
  const [providers, setProviders] = useState<ProviderPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ title: string; message: string } | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ApiKeyItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/api-keys");
      const body = await res.json();
      if (body.success) {
        setItems(body.data);
        setProviders(body.providers || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showDialog = (title: string, message: string) => setDialog({ title, message });

  const providerById = (id: string) => providers.find((p) => p.id === id);

  const openAdd = () => {
    const first = providers[0];
    if (!first) return;
    setModal({ provider: first.id, apiKey: "", models: [...first.models], defaultModel: first.models[0] });
  };

  const openEdit = (item: ApiKeyItem) => {
    setModal({
      id: item.id,
      provider: item.provider,
      apiKey: "",
      models: [...item.models],
      defaultModel: item.defaultModel || item.models[0] || "",
    });
  };

  const onProviderChange = (pid: string) => {
    const p = providerById(pid);
    if (!p) return;
    setModal((m) => (m ? { ...m, provider: pid, models: [...p.models], defaultModel: p.models[0] } : m));
  };

  const toggleModel = (m: string) => {
    setModal((prev) => {
      if (!prev) return prev;
      const has = prev.models.includes(m);
      const models = has ? prev.models.filter((x) => x !== m) : [...prev.models, m];
      const defaultModel = prev.defaultModel === m && !has ? prev.defaultModel : models[0] || "";
      return { ...prev, models, defaultModel };
    });
  };

  const save = async () => {
    if (!modal) return;
    if (modal.models.length === 0) {
      showDialog("提示", "请至少选择一个模型");
      return;
    }
    const isNew = !modal.id;
    const res = await fetch("/api/settings/api-keys", {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: modal.id,
        provider: modal.provider,
        apiKey: modal.apiKey,
        models: modal.models,
        defaultModel: modal.defaultModel,
      }),
    });
    const body = await res.json();
    if (body.success) {
      showDialog("成功", isNew ? "已保存 API Key" : "已更新");
      setModal(null);
      load();
    } else {
      showDialog("失败", body.error?.message || "操作失败");
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    const res = await fetch("/api/settings/api-keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: confirmDelete.id }),
    });
    if (res.ok) {
      showDialog("成功", "已删除");
      setConfirmDelete(null);
      load();
    }
  };

  const toggleActive = async (item: ApiKeyItem) => {
    const res = await fetch("/api/settings/api-keys", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, isActive: !item.isActive }),
    });
    if (res.ok) load();
  };

  return (
    <>
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-gray-500" />
          <span className="text-sm text-gray-600">模型配置 · 配置你的 AI 厂商密钥</span>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700"
        >
          <Plus className="w-3.5 h-3.5" />添加密钥
        </button>
      </div>

      {/* 安全提示 */}
      <div className="flex items-start gap-2 mb-5 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-lg">
        <ShieldCheck className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          API Key 使用 AES-256-GCM 加密后存储，服务端永不保存明文，界面仅展示掩码（如 <span className="font-mono">sk-****1234</span>）。
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-gray-400">加载中...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <KeyRound className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-xs text-gray-400">尚未配置任何 AI 密钥，点击「添加密钥」开始</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const p = providerById(item.provider);
            return (
              <div key={item.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">{item.label}</span>
                    <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                      {item.provider}
                    </span>
                    {item.isActive ? (
                      <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">已启用</span>
                    ) : (
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">已停用</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => toggleActive(item)}
                      title={item.isActive ? "点击停用" : "点击启用"}
                      className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded ${
                        item.isActive ? "bg-green-50 text-green-600 hover:bg-green-100" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      <Power className="w-3 h-3" />
                      {item.isActive ? "启用中" : "已停用"}
                    </button>
                    <button
                      onClick={() => openEdit(item)}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 text-[10px] rounded hover:bg-blue-100"
                    >
                      <Edit3 className="w-3 h-3" />编辑
                    </button>
                    <button
                      onClick={() => setConfirmDelete(item)}
                      className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 text-[10px] rounded hover:bg-red-100"
                    >
                      <Trash2 className="w-3 h-3" />删除
                    </button>
                  </div>
                </div>

                <div className="font-mono text-xs text-gray-500 mb-2">{item.masked}</div>

                <div className="flex flex-wrap gap-1.5 mb-2">
                  {item.models.map((m) => (
                    <span
                      key={m}
                      className={`text-[10px] px-2 py-0.5 rounded ${
                        m === item.defaultModel ? "bg-red-50 text-red-600 border border-red-100" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {m}
                      {m === item.defaultModel && " · 默认"}
                    </span>
                  ))}
                </div>

                {p && <div className="text-[10px] text-gray-400">接口：{p.baseURL}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* 添加/编辑弹窗 */}
      {modal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-[520px] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-gray-800 mb-4">{modal.id ? "编辑密钥" : "添加密钥"}</h3>

            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">厂商</label>
              <select
                value={modal.provider}
                onChange={(e) => onProviderChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">
                API Key {modal.id && <span className="text-gray-400">（留空则不修改）</span>}
              </label>
              <input
                type="password"
                value={modal.apiKey}
                onChange={(e) => setModal({ ...modal, apiKey: e.target.value })}
                placeholder="粘贴厂商 API Key"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
              />
            </div>

            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">可选模型（可多选）</label>
              <div className="flex flex-wrap gap-2">
                {(providerById(modal.provider)?.models || []).map((m) => {
                  const checked = modal.models.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleModel(m)}
                      className={`px-2.5 py-1 text-[11px] rounded-lg border ${
                        checked ? "bg-red-50 border-red-200 text-red-600" : "bg-gray-50 border-gray-200 text-gray-500"
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">默认模型</label>
              <select
                value={modal.defaultModel}
                onChange={(e) => setModal({ ...modal, defaultModel: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500"
              >
                {modal.models.length === 0 ? (
                  <option value="">请先选择模型</option>
                ) : (
                  modal.models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setModal(null)}
                className="flex-1 px-4 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
              >
                取消
              </button>
              <button
                onClick={save}
                className="flex-1 px-4 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认 */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-500" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-gray-800">确认删除密钥？</h3>
                <p className="text-xs text-gray-500 mt-1">
                  删除「{confirmDelete.label}」({confirmDelete.masked}) 后无法恢复
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
              >
                取消
              </button>
              <button
                onClick={doDelete}
                className="flex-1 px-4 py-2 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 提示弹窗 */}
      {dialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={() => setDialog(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-gray-800">{dialog.title}</h3>
                <p className="text-xs text-gray-500 mt-1">{dialog.message}</p>
              </div>
            </div>
            <button
              onClick={() => setDialog(null)}
              className="w-full px-4 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
            >
              确定
            </button>
          </div>
        </div>
      )}
    </>
  );
}
