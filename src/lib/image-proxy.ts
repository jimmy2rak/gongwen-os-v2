// ─── 头像/外链图片代理工具 ───────────────────────
// 把用户填写的外链图片 URL 改写为同源的 /api/image-proxy?url= 地址，
// 由服务端拉取后转发，绕过图床防盗链（Referer 校验）与浏览器混合内容限制，
// 让"插入链接即可显示图片"稳定生效。非 http(s) 或非法 URL 时原样返回。

export function proxyImageUrl(url?: string | null): string | undefined {
  if (!url || !url.trim()) return undefined;
  const raw = url.trim();
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return raw;
    return `/api/image-proxy?url=${encodeURIComponent(raw)}`;
  } catch {
    return raw;
  }
}
