// ─── GET|POST|PUT|DELETE /api/settings/api-keys ──
// 用户自管理的 AI API Key（加密存储，返回仅掩码）
// 同时暴露系统默认 MiniCPM 配置，仅超级管理员可改。

import { NextRequest, NextResponse } from "next/server";
import { db, client } from "@/server/db";
import { apiKeys } from "@/server/db/schema";
import { getServerUser } from "@/server/auth/guard";
import { isSuperAdmin } from "@/server/auth/super-admin";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { encryptApiKey, decryptApiKey, maskApiKey } from "@/server/lib/crypto";
import { AI_PROVIDERS, getProvider, isValidProvider } from "@/server/lib/ai/providers";
import {
  ensureSystemMiniCPMConfig,
  setSystemMiniCPMConfig,
  deleteSystemMiniCPMConfig,
  SYSTEM_MINICPM_KEY_NAME,
  type SystemMiniCPMConfig,
} from "@/server/lib/ai/system-minicpm";

function safeParseModels(s: string | null): string[] {
  if (!s) return [];
  try {
    const a = JSON.parse(s);
    return Array.isArray(a) ? a.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function systemMiniCPMToItem(cfg: SystemMiniCPMConfig) {
  return {
    id: cfg.id,
    provider: cfg.provider,
    label: cfg.label,
    masked: maskApiKey(cfg.apiKey),
    models: cfg.models,
    defaultModel: cfg.defaultModel,
    isActive: cfg.isActive,
    isSystem: true,
    baseUrl: cfg.baseUrl,
    createdAt: cfg.createdAt,
    updatedAt: cfg.updatedAt,
  };
}

// ─── GET 列表（仅返回掩码，绝不回明文）────────────
export async function GET() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  }
  try {
    const rows = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, user.id))
      .orderBy(desc(apiKeys.createdAt));

    const data = rows.map((r) => {
      let masked = "****";
      try {
        masked = maskApiKey(decryptApiKey(r.encrypted, r.iv));
      } catch {
        masked = "****";
      }
      const models = safeParseModels(r.models as string);
      return {
        id: r.id,
        provider: r.provider,
        label: getProvider(r.provider)?.label || r.provider,
        masked,
        models,
        defaultModel: (r.defaultModel as string) || models[0] || null,
        isActive: Boolean(r.isActive),
        isSystem: false,
        baseUrl: (r.baseUrl as string) || getProvider(r.provider)?.baseURL || null,
        createdAt: r.createdAt,
      };
    });

    const systemMiniCPM = await ensureSystemMiniCPMConfig();
    const isSuper = await isSuperAdmin(user.id);

    return NextResponse.json({
      success: true,
      data: [systemMiniCPMToItem(systemMiniCPM), ...data],
      providers: AI_PROVIDERS,
      isSuper,
    });
  } catch (error) {
    console.error("[api-keys GET]", error);
    return NextResponse.json({ success: false, error: { message: "获取失败" } }, { status: 500 });
  }
}

// ─── POST 新增 ───────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { provider, apiKey, models, baseUrl } = body;

    if (!isValidProvider(provider)) {
      return NextResponse.json({ success: false, error: { message: "不支持的厂商" } }, { status: 400 });
    }
    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      return NextResponse.json({ success: false, error: { message: "API Key 不能为空" } }, { status: 400 });
    }

    const preset = getProvider(provider)!;
    let modelList: string[] = [];
    if (Array.isArray(models)) modelList = models.filter((m) => typeof m === "string");
    if (modelList.length === 0) modelList = [...preset.models];

    const finalBaseUrl = typeof baseUrl === "string" && baseUrl.trim() ? baseUrl.trim() : preset.baseURL;

    const { encrypted, iv } = encryptApiKey(apiKey.trim());
    const now = Math.floor(Date.now() / 1000);
    const id = `ak${nanoid(16)}`;

    await client.execute({
      sql: "INSERT INTO api_keys (id, user_id, provider, encrypted, iv, models, default_model, base_url, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [id, user.id, provider, encrypted, iv, JSON.stringify(modelList), modelList[0], finalBaseUrl, 1, now, now],
    });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("[api-keys POST]", error);
    return NextResponse.json({ success: false, error: { message: "保存失败" } }, { status: 500 });
  }
}

// ─── PUT 更新（models / isActive / defaultModel / baseUrl / 可选重填 key）──
export async function PUT(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { id, apiKey, models, isActive, defaultModel, baseUrl } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: { message: "缺少 ID" } }, { status: 400 });
    }

    const isSuper = await isSuperAdmin(user.id);

    // 系统默认 MiniCPM
    if (id === "system:minicpm") {
      if (!isSuper) {
        return NextResponse.json({ success: false, error: { message: "无权限：仅超级管理员可修改系统默认配置" } }, { status: 403 });
      }
      const cfg = await ensureSystemMiniCPMConfig();
      if (typeof apiKey === "string" && apiKey.trim()) {
        cfg.apiKey = apiKey.trim();
      }
      if (Array.isArray(models)) {
        cfg.models = models.filter((m) => typeof m === "string");
      }
      if (typeof defaultModel === "string") {
        cfg.defaultModel = defaultModel;
      }
      if (typeof baseUrl === "string" && baseUrl.trim()) {
        cfg.baseUrl = baseUrl.trim();
      }
      if (typeof isActive === "boolean") {
        cfg.isActive = isActive;
      }
      cfg.updatedAt = Math.floor(Date.now() / 1000);
      await setSystemMiniCPMConfig(cfg);
      return NextResponse.json({ success: true });
    }

    // 普通用户 key
    const existing = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
    if (existing.length === 0 || existing[0].userId !== user.id) {
      return NextResponse.json({ success: false, error: { message: "记录不存在或无权修改" } }, { status: 404 });
    }

    const now = Math.floor(Date.now() / 1000);
    const sets: string[] = [];
    const vals: any[] = [];

    if (typeof apiKey === "string" && apiKey.trim()) {
      const { encrypted, iv } = encryptApiKey(apiKey.trim());
      sets.push("encrypted = ?", "iv = ?");
      vals.push(encrypted, iv);
    }
    if (Array.isArray(models)) {
      sets.push("models = ?");
      vals.push(JSON.stringify(models.filter((m) => typeof m === "string")));
    }
    if (typeof defaultModel === "string") {
      sets.push("default_model = ?");
      vals.push(defaultModel);
    }
    if (typeof baseUrl === "string" && baseUrl.trim()) {
      sets.push("base_url = ?");
      vals.push(baseUrl.trim());
    } else if (baseUrl === null || baseUrl === "") {
      sets.push("base_url = ?");
      vals.push(null);
    }
    if (typeof isActive === "boolean") {
      sets.push("is_active = ?");
      vals.push(isActive ? 1 : 0);
    }
    sets.push("updated_at = ?");
    vals.push(now);
    vals.push(id);

    await client.execute({
      sql: `UPDATE api_keys SET ${sets.join(", ")} WHERE id = ?`,
      args: vals,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api-keys PUT]", error);
    return NextResponse.json({ success: false, error: { message: "更新失败" } }, { status: 500 });
  }
}

// ─── DELETE 删除 ─────────────────────────────────
export async function DELETE(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: { message: "缺少 ID" } }, { status: 400 });
    }

    const isSuper = await isSuperAdmin(user.id);

    if (id === "system:minicpm") {
      if (!isSuper) {
        return NextResponse.json({ success: false, error: { message: "无权限：仅超级管理员可删除系统默认配置" } }, { status: 403 });
      }
      await deleteSystemMiniCPMConfig();
      return NextResponse.json({ success: true });
    }

    const existing = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
    if (existing.length === 0 || existing[0].userId !== user.id) {
      return NextResponse.json({ success: false, error: { message: "记录不存在或无权删除" } }, { status: 404 });
    }

    await client.execute({ sql: "DELETE FROM api_keys WHERE id = ?", args: [id] });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api-keys DELETE]", error);
    return NextResponse.json({ success: false, error: { message: "删除失败" } }, { status: 500 });
  }
}
