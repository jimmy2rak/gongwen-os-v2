// ─── 系统级 MiniCPM 默认 API 配置 ─────────────────
// 数据持久化在 sys_secret_config（key_name = minicpm_default_api），整段 JSON 加密存储。
// 普通用户可见/可用；仅超级管理员可修改/删除。

import { client } from "@/server/db";
import { encryptSecret, decryptSecret } from "@/server/auth/secret";
import { AI_PROVIDERS } from "./providers";

export const SYSTEM_MINICPM_KEY_NAME = "minicpm_default_api";

export interface SystemMiniCPMConfig {
  id: string;                 // 固定 "system:minicpm"
  provider: "minicpm";
  label: string;
  baseUrl: string;
  apiKey: string;             // 明文 API Key（仅后端解密，前端仅展示掩码）
  models: string[];
  defaultModel: string;
  isActive: boolean;
  isSystem: true;
  createdAt: number;
  updatedAt: number;
}

const DEFAULT_MINICPM_KEY = "lis_sk_298cf78155f231c7_DkrDcNLHnK8dJRnfFrJCd4JGDbBLMkHrC3T-wLpvC9zy0BPemsyFuQ";

function buildDefault(): SystemMiniCPMConfig {
  const preset = AI_PROVIDERS.find((p) => p.id === "minicpm")!;
  return {
    id: "system:minicpm",
    provider: "minicpm",
    label: "MiniCPM (面壁智能) · 系统默认",
    baseUrl: preset.baseURL,
    apiKey: DEFAULT_MINICPM_KEY,
    models: [...preset.models],
    defaultModel: preset.models[0],
    isActive: true,
    isSystem: true,
    createdAt: Math.floor(Date.now() / 1000),
    updatedAt: Math.floor(Date.now() / 1000),
  };
}

export async function getSystemMiniCPMConfig(): Promise<SystemMiniCPMConfig | null> {
  try {
    const rows = await client.execute({
      sql: "SELECT encrypted_value FROM sys_secret_config WHERE key_name = ? LIMIT 1",
      args: [SYSTEM_MINICPM_KEY_NAME],
    });
    const enc = rows.rows?.[0]?.encrypted_value as string | undefined;
    if (!enc) return null;
    const plain = decryptSecret(enc);
    return JSON.parse(plain) as SystemMiniCPMConfig;
  } catch (e) {
    console.error("[system-minicpm] 读取失败:", e);
    return null;
  }
}

export async function setSystemMiniCPMConfig(cfg: SystemMiniCPMConfig): Promise<void> {
  const plain = JSON.stringify(cfg);
  const enc = encryptSecret(plain);
  const now = Math.floor(Date.now() / 1000);
  const existing = await client.execute({
    sql: "SELECT id FROM sys_secret_config WHERE key_name = ? LIMIT 1",
    args: [SYSTEM_MINICPM_KEY_NAME],
  });
  if (existing.rows.length > 0) {
    await client.execute({
      sql: "UPDATE sys_secret_config SET encrypted_value = ?, algorithm = ?, update_time = ? WHERE key_name = ?",
      args: [enc, "aes-256-gcm", now, SYSTEM_MINICPM_KEY_NAME],
    });
  } else {
    await client.execute({
      sql: "INSERT INTO sys_secret_config (key_name, encrypted_value, algorithm, create_time, update_time) VALUES (?, ?, ?, ?, ?)",
      args: [SYSTEM_MINICPM_KEY_NAME, enc, "aes-256-gcm", now, now],
    });
  }
}

export async function ensureSystemMiniCPMConfig(): Promise<SystemMiniCPMConfig> {
  let cfg = await getSystemMiniCPMConfig();
  if (!cfg) {
    cfg = buildDefault();
    await setSystemMiniCPMConfig(cfg);
  }
  return cfg;
}

export async function deleteSystemMiniCPMConfig(): Promise<void> {
  await client.execute({
    sql: "DELETE FROM sys_secret_config WHERE key_name = ?",
    args: [SYSTEM_MINICPM_KEY_NAME],
  });
}
