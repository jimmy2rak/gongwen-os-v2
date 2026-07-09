// ─── POST /api/cron/daily-hotspot ────────────────
// 每日热点邮件推送端点（需 X-Cron-Secret 头鉴权）
// 查询最新热点文章 → 生成 HTML 邮件 → 通过 Brevo 发送
//
// 使用方式（cron-job.org / GitHub Actions / 本地终端）：
//   curl -X POST https://gongwenos.182183.xyz/api/cron/daily-hotspot \
//     -H "X-Cron-Secret: 你的CRON_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{"email":"your@email.com"}'
//
// 环境变量：
//   CRON_SECRET — 保护此端点的密钥
//   EMAIL_TO   — 默认收件人（可在请求 body 中覆盖）

import { NextRequest, NextResponse } from "next/server";
import { client } from "@/server/db";
import { sendEmail } from "@/server/email/send";

const SITE_URL = process.env.NEXTAUTH_URL || "https://gongwenos.182183.xyz";
const CRON_SECRET = process.env.CRON_SECRET || "";
const DEFAULT_EMAIL_TO = process.env.EMAIL_TO || "";

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function formatDate(dateStr: string): string {
  if (dateStr.length === 8) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  return dateStr;
}

/** 生成热点文章邮件 HTML */
function buildEmailHtml(articles: any[], dateLabel: string): string {
  if (articles.length === 0) {
    return `<div style="max-width:600px;margin:0 auto;font-family:sans-serif;padding:24px;">
      <h2 style="font-size:18px;margin-bottom:16px;">今日热点</h2>
      <p style="font-size:14px;color:#666;">暂无热点推送内容。</p>
    </div>`;
  }

  const itemsHtml = articles
    .map(
      (a, i) => `
    <tr>
      <td style="padding:12px 0;${i < articles.length - 1 ? 'border-bottom:1px solid #eee;' : ''}">
        <div style="display:flex;align-items:flex-start;gap:8px;">
          <span style="font-size:12px;font-weight:600;color:#999;min-width:24px;line-height:1.6;">${i + 1}.</span>
          <div>
            <div style="margin-bottom:4px;">
              <span style="display:inline-block;font-size:11px;padding:1px 6px;border-radius:3px;background:#e8f5e9;color:#2e7d32;margin-right:6px;">${a.sourceName || "未知来源"}</span>
              ${a.columnId ? `<span style="display:inline-block;font-size:11px;padding:1px 6px;border-radius:3px;background:#e3f2fd;color:#1565c0;margin-right:6px;">${a.columnId}</span>` : ""}
              ${a.crawlDate ? `<span style="font-size:11px;color:#999;">${formatDate(a.crawlDate)}</span>` : ""}
            </div>
            <a href="${SITE_URL}/hotspots" style="font-size:14px;font-weight:500;color:#163f3a;text-decoration:none;line-height:1.5;">
              ${a.title}
            </a>
            ${a.contentPlain ? `<p style="font-size:12px;color:#666;line-height:1.5;margin:4px 0 0 0;">${a.contentPlain.slice(0, 150)}${a.contentPlain.length > 150 ? "…" : ""}</p>` : ""}
          </div>
        </div>
      </td>
    </tr>`,
    )
    .join("");

  return `<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;width:40px;height:40px;border-radius:10px;background:#163f3a;color:#fff;font-size:20px;font-weight:bold;line-height:40px;margin-bottom:8px;">公</div>
      <h1 style="font-size:20px;font-weight:600;color:#1a1a1a;margin:8px 0 4px;">公文 OS · 每日热点推送</h1>
      <p style="font-size:13px;color:#888;margin:0;">${dateLabel}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px 12px;background:#f5f5f5;border-radius:6px;font-size:12px;font-weight:600;color:#555;">
            共 ${articles.length} 篇热点文章
          </th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #eee;">
      <a href="${SITE_URL}/hotspots" style="display:inline-block;padding:10px 24px;background:#163f3a;color:#fff;text-decoration:none;border-radius:8px;font-size:13px;">
        在公文 OS 中查看全部热点 →
      </a>
      <p style="font-size:11px;color:#aaa;margin-top:12px;">
        您收到此邮件是因为您在公文 OS 注册了账号。<br/>
        如不想继续接收，可在设置中关闭。
      </p>
    </div>
  </div>`;
}

export async function POST(req: NextRequest) {
  try {
    // ── 鉴权：检查 X-Cron-Secret ──
    const secret = req.headers.get("X-Cron-Secret");
    if (!CRON_SECRET || secret !== CRON_SECRET) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "无效的 CRON_SECRET" } },
        { status: 401 },
      );
    }

    // ── 确定收件人 ──
    let toEmail: string;
    try {
      const body = await req.json().catch(() => ({}));
      toEmail = body.email || DEFAULT_EMAIL_TO;
    } catch {
      toEmail = DEFAULT_EMAIL_TO;
    }

    if (!toEmail) {
      return NextResponse.json(
        { success: false, error: { code: "NO_RECIPIENT", message: "未指定收件人，请设置 EMAIL_TO 环境变量或传入 email 参数" } },
        { status: 400 },
      );
    }

    // ── 查询最新热点文章 ──
    const today = todayStr();
    const sql = `
      SELECT id, title, source_name, column_id, content_plain, crawl_date, created_at
      FROM hot_article
      WHERE is_published = 1
      ORDER BY created_at DESC
      LIMIT 30
    `;
    const result = await client.execute(sql);
    const articles = (result.rows || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      sourceName: r.source_name,
      columnId: r.column_id,
      contentPlain: r.content_plain,
      crawlDate: r.crawl_date,
      createdAt: r.created_at,
    }));

    // ── 日期标签 ──
    const latestDate = articles[0]?.crawlDate || today;
    const dateLabel = `📅 ${formatDate(latestDate)} · 共 ${articles.length} 篇`;

    // ── 生成并发送邮件 ──
    const html = buildEmailHtml(articles, dateLabel);
    const ok = await sendEmail(toEmail, `【公文 OS】每日热点推送 · ${formatDate(latestDate)}`, html);

    if (!ok) {
      return NextResponse.json(
        { success: false, error: { code: "EMAIL_FAILED", message: "邮件发送失败" } },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        email: toEmail,
        articleCount: articles.length,
        date: formatDate(latestDate),
      },
    });
  } catch (err) {
    console.error("[cron/daily-hotspot]", err);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL", message: "服务器错误" } },
      { status: 500 },
    );
  }
}
