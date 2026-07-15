// ─── GET /api/image-proxy?url=xxx ─────────────────
// 服务端图片代理：拉取外链图片并原样转发，用于头像等用户填的外链图片，
// 绕过图床防盗链（Referer 校验）与混合内容限制。
// 安全：必须登录；仅允许 http/https；拒绝解析到私有/保留地址的主机（SSRF 防护）；
// 仅放行 image/* 响应；限制体积、超时。
// 增强：若源是网页（如 Unsplash 图片页），自动抽取 og:image / twitter:image
//       再递归拉取真实图片（最多 1 跳），让"粘贴图片页链接也能显示"生效。

import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/server/auth/guard";
import dns from "node:dns/promises";

const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 2 * 1024 * 1024; // 抽取 og:image 前不下载超大网页

function isPrivateIp(ip: string): boolean {
  if (ip === "::1" || ip === "::" || ip === "0.0.0.0") return true;
  if (ip.startsWith("::1") || ip.startsWith("fe80") || ip.startsWith("fc") || ip.startsWith("fd")) return true;
  if (ip.startsWith("127.")) return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true;
  const m = ip.match(/^172\.(\d+)\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  return false;
}

function jsonError(message: string, status: number): NextResponse {
  return new NextResponse(JSON.stringify({ success: false, error: { message } }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

// 从 HTML 中抽取可用图片地址（优先 og:image / twitter:image / link[image_src]）
function extractImageFromHtml(html: string, baseUrl: string): string | null {
  const push = (u?: string | null): string | null => {
    if (!u) return null;
    try {
      const abs = new URL(u, baseUrl).toString();
      return /^https?:\/\//i.test(abs) ? abs : null;
    } catch {
      return null;
    }
  };
  const meta = (prop: string): string | null => {
    let m =
      html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i")) ||
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, "i"));
    return m ? push(m[1]) : null;
  };
  const link = (rel: string): string | null => {
    let m =
      html.match(new RegExp(`<link[^>]+rel=["']${rel}["'][^>]+href=["']([^"']+)["']`, "i")) ||
      html.match(new RegExp(`<link[^>]+href=["']([^"']+)["'][^>]+rel=["']${rel}["']`, "i"));
    return m ? push(m[1]) : null;
  };
  return meta("og:image") || meta("twitter:image") || link("image_src");
}

// 解析 + SSRF 校验（每个被拉取的地址都要过一遍）
async function safeLookup(hostname: string): Promise<string | null> {
  try {
    const { address } = await dns.lookup(hostname);
    if (isPrivateIp(address)) return null;
    return address;
  } catch {
    return null;
  }
}

// 递归拉取：depth 0 拉原始地址；若返回 HTML 且 depth<1，抽取图片再拉一次
async function proxyUrl(target: URL, depth: number): Promise<NextResponse> {
  const addr = await safeLookup(target.hostname);
  if (!addr) return jsonError("blocked host", 403);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GongWenOS-ImageProxy/1.0)",
        Accept: "*/*",
        Referer: "",
      },
    });
    if (!upstream.ok || !upstream.body) return jsonError("图片源暂不可用", 502);

    const ct = (upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();

    // 直接是图片 → 流式转发
    if (ct.startsWith("image/")) {
      const reader = upstream.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) {
          reader.cancel();
          return jsonError("图片过大（超过 8MB）", 413);
        }
        chunks.push(value);
      }
      const body = Buffer.concat(chunks.map((c) => Buffer.from(c)));
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": ct,
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    // 是网页 → 尝试抽取 og:image 再拉一次（最多 1 跳）
    if (ct.startsWith("text/html") && depth < 1) {
      const len = Number(upstream.headers.get("content-length") || 0);
      if (len > MAX_HTML_BYTES) return jsonError("请粘贴图片直链（如以 .jpg/.png 结尾的地址）", 415);
      const html = await upstream.text();
      const img = extractImageFromHtml(html, target.toString());
      if (img) {
        let next: URL;
        try {
          next = new URL(img);
        } catch {
          return jsonError("图片地址无效", 400);
        }
        if (next.protocol !== "http:" && next.protocol !== "https:") {
          return jsonError("不支持的协议", 400);
        }
        return proxyUrl(next, depth + 1);
      }
      return jsonError("该网页无法提取图片，请粘贴图片直链（复制图片「地址」而非网页地址）", 415);
    }

    return jsonError("该地址不是图片", 415);
  } catch {
    return jsonError("图片获取失败（网络或超时）", 502);
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return jsonError("未登录", 401);
  }

  const url = req.nextUrl.searchParams.get("url");
  if (!url) return jsonError("缺少 url 参数", 400);

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return jsonError("url 格式非法", 400);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return jsonError("不支持的协议", 400);
  }

  // 已知「图片页」域名：其网页地址无法被服务端代理抓取，必须粘贴图片直链。
  // 提前给出明确指引，避免无意义的抓取与 502。
  const host = parsed.hostname.toLowerCase();
  if (host.endsWith("unsplash.com") && parsed.pathname.startsWith("/photos/")) {
    return jsonError(
      "Unsplash 图片页需使用图片直链：在图片上右键 →「复制图片地址」（形如 https://images.unsplash.com/photo-xxxx?...），再粘贴到这里",
      422,
    );
  }

  return proxyUrl(parsed, 0);
}
