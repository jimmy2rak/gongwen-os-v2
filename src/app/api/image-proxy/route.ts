// ─── GET /api/image-proxy?url=xxx ─────────────────
// 服务端图片代理：拉取外链图片并原样转发，用于头像等用户填的外链图片，
// 绕过图床防盗链（Referer 校验）与混合内容限制。
// 安全：必须登录；仅允许 http/https；拒绝解析到私有/保留地址的主机（SSRF 防护）；
// 仅放行 image/* 响应；限制 5MB、8s 超时。

import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/server/auth/guard";
import dns from "node:dns/promises";

const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 8000;

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

export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  }

  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("missing url", { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse("invalid url", { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return new NextResponse("unsupported protocol", { status: 400 });
  }

  // SSRF 防护：解析主机并拒绝私有/保留地址
  try {
    const { address } = await dns.lookup(parsed.hostname);
    if (isPrivateIp(address)) return new NextResponse("blocked host", { status: 403 });
  } catch {
    return new NextResponse("dns error", { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GongWenOS-ImageProxy/1.0)",
        Accept: "image/*",
      },
    });
    if (!upstream.ok || !upstream.body) {
      return new NextResponse("upstream error", { status: 502 });
    }
    const ct = upstream.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) {
      return new NextResponse("not an image", { status: 415 });
    }

    // 边读边限制大小
    const reader = upstream.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        reader.cancel();
        return new NextResponse("too large", { status: 413 });
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
  } catch {
    return new NextResponse("fetch failed", { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
