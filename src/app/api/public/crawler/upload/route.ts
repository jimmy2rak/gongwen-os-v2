// ─── POST /api/public/crawler/upload ─────────────
// 爬虫脚本调用的开放入库接口（无需登录，但必须携带 X-Crawler-Auth 请求头）。
// 请求头：X-Crawler-Auth: <密钥>
// Body 固定结构：
//   { sourceId, columnId, title, contentPlain, contentHtml, pageName, originUrl, crawlDate }
// 逻辑：校验密钥 → 按 originUrl 查重 → 数据清洗插入 hot_article。

import { NextRequest, NextResponse } from "next/server";
import { client } from "@/server/db";
import { getCrawlerUploadKey } from "@/server/auth/secret";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  // 1) 请求头鉴权
  const incoming = req.headers.get("X-Crawler-Auth");
  const valid = await getCrawlerUploadKey();
  if (!valid || !incoming || incoming !== valid) {
    return NextResponse.json({ success: false, message: "鉴权失败：无效或缺失 X-Crawler-Auth" }, { status: 401 });
  }

  // 2) 解析 + 校验入参
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "请求体不是合法 JSON" }, { status: 400 });
  }

  const { sourceId, sourceName, columnId, title, contentPlain, contentHtml, pageName, originUrl, crawlDate } = body;
  if (!title || !String(title).trim()) {
    return NextResponse.json({ success: false, message: "title 不能为空" }, { status: 400 });
  }

  try {
    // 3) 按原文链接查重，避免重复入库
    if (originUrl) {
      const dup = await client.execute({
        sql: "SELECT 1 FROM hot_article WHERE origin_url = ? LIMIT 1",
        args: [originUrl],
      });
      if ((dup.rows?.length ?? 0) > 0) {
        return NextResponse.json({ success: true, duplicated: true, message: "已存在相同原文，跳过" });
      }
    }

    // 4) 数据清洗 + 入库
    const id = `ha${nanoid(16)}`;
    const now = Math.floor(Date.now() / 1000);
    await client.execute({
      sql: `INSERT INTO hot_article
            (id, source_id, source_name, column_id, title, content_plain, content_html, page_name, origin_url, crawl_date, is_published, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      args: [
        id,
        sourceId || null,
        sourceName || null,
        columnId || null,
        String(title).trim(),
        contentPlain || null,
        contentHtml || null,
        pageName || null,
        originUrl || null,
        crawlDate || null,
        now,
      ],
    });

    return NextResponse.json({ success: true, data: { id }, message: "入库成功" });
  } catch (e) {
    console.error("[crawler/upload] Error:", e);
    return NextResponse.json({ success: false, message: "入库失败" }, { status: 500 });
  }
}
