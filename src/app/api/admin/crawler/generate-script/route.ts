// ─── POST /api/admin/crawler/generate-script ────
// 入参：{ sourceId }（爬虫数据源主键）
// 逻辑：超管鉴权 → 查 crawler_source → 解密 sys_secret_config 有效密钥
//       → 后端按请求源推导入库接口地址 → 把 API_KEY / 后端地址 / sourceId / columnId
//         注入 Python 母版 → 原样返回完整 .py 文本（text/plain）。
// 安全：所有敏感参数仅在后端注入，前端/脚本外发时均不含明文后端配置。

import { NextRequest, NextResponse } from "next/server";
import { client } from "@/server/db";
import { getServerUser } from "@/server/auth/guard";
import { isSuperAdmin } from "@/server/auth/super-admin";
import { getCrawlerUploadKey } from "@/server/auth/secret";
import { renderCrawlerScript } from "@/lib/crawler-template";

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  if (!(await isSuperAdmin(user.id))) {
    return NextResponse.json({ success: false, error: { message: "无权限：仅超级管理员可生成脚本" } }, { status: 403 });
  }

  try {
    const { sourceId } = await req.json();
    if (!sourceId) {
      return NextResponse.json({ success: false, error: { message: "缺少 sourceId" } }, { status: 400 });
    }

    const rowRes = await client.execute({
      sql: "SELECT id, source_name, base_url, target_column_id, category_tag FROM crawler_source WHERE id = ? LIMIT 1",
      args: [sourceId],
    });
    const row = rowRes.rows?.[0] as unknown as
      | { id: string; source_name: string; base_url: string; target_column_id?: string | null; category_tag?: string | null }
      | undefined;
    if (!row) {
      return NextResponse.json({ success: false, error: { message: "数据源不存在" } }, { status: 404 });
    }

    const apiKey = await getCrawlerUploadKey();
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: { message: "尚未配置爬虫入库密钥，请先运行 scripts/seed-crawler-secret.mjs" } },
        { status: 500 }
      );
    }

    // 后端推导入库接口地址（与超管访问同源，前端不接触该值）
    const backendUrl = new URL("/api/public/crawler/upload", req.nextUrl.origin).toString();

    const code = renderCrawlerScript({
      apiKey,
      backendUrl,
      sourceId: row.id,
      columnId: row.target_column_id || "",
      baseUrl: row.base_url,
      siteName: row.source_name,
      defaultCategory: row.category_tag || "综合",
    });

    return new NextResponse(code, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[crawler/generate-script] Error:", e);
    return NextResponse.json({ success: false, error: { message: "生成失败" } }, { status: 500 });
  }
}
