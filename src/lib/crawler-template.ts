// ─── 爬虫 Python 母版（后端渲染用）─────────────────
// 基于已验证的 crawl_rmrb.py 核心逻辑（理论版/评论版定向抓取）。
// 顶部预留 4 个由后端动态注入的变量位：
//   {{API_KEY}}             X-Crawler-Auth 鉴权密钥（加密库解密后注入）
//   {{UPLOAD_BACKEND_URL}}  入库接口完整地址（后端按请求源推导，前端不接触）
//   {{BIND_SOURCE_ID}}      绑定 crawler_source.id
//   {{BIND_COLUMN_ID}}      绑定公文栏目（分类名）
// 另注入 {{BASE_URL}} / {{SITE_NAME}} / {{DEFAULT_CATEGORY}} 站点配置。
//
// 安全约束：
//   - 脚本不含任何明文后端地址/密钥外泄；全部由后端渲染。
//   - 默认抓取【当日】理论版+评论版，无需手动输入；失败自动跳过+休眠防封。
//   - 仅向 {{UPLOAD_BACKEND_URL}} 网络入库，本地不落 JSON/TXT 文件。

export interface CrawlerRenderInput {
  apiKey: string;          // 解密后的明文密钥
  backendUrl: string;      // 入库接口地址（含 /api/public/crawler/upload）
  sourceId: string;        // crawler_source.id
  columnId: string;        // 绑定栏目（公文分类名）
  baseUrl: string;         // 抓取根地址
  siteName: string;        // 数据源名称
  defaultCategory: string; // 默认分类标签
}

// 使用 String.raw：Python f-string 中的 {var} 不会被 JS 模板插值误伤，
// 同时保留所有反斜杠原样。占位符统一用 {{XXX}}。
const TEMPLATE = String.raw`#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
{{SITE_NAME}} · 定向爬虫（公文系统自动生成 · 超管专属）
========================================================
由公文系统「爬虫热点推送配置」自动生成，仅供超级管理员使用。
默认抓取【当日】的「理论版 / 评论版」文章，逐条推送至后端入库。
全程无需确认与手动输入；单篇失败自动跳过并休眠防封。

依赖：pip install requests beautifulsoup4
运行：python3 crawler_task_{{SOURCE_ID_SAFE}}.py
"""

import sys, os, io, time, json, hashlib, datetime, argparse
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

# ═══════════════════ 后端注入参数（请勿手动修改） ═════════════════
API_KEY = "{{API_KEY}}"                        # X-Crawler-Auth 鉴权密钥（后端注入）
UPLOAD_BACKEND_URL = "{{UPLOAD_BACKEND_URL}}"  # 入库接口地址（后端注入）
BIND_SOURCE_ID = "{{BIND_SOURCE_ID}}"          # 绑定爬虫数据源 ID（后端注入）
BIND_COLUMN_ID = "{{BIND_COLUMN_ID}}"          # 绑定公文栏目 ID（后端注入）
# ══════════════════════════════════════════════════════════════════

# ── 站点配置（后端注入）──
SITE_NAME = "{{SITE_NAME}}"
BASE_URL = "{{BASE_URL}}"                       # 抓取根地址
LAYOUT_URL = BASE_URL.rstrip("/") + "/{YYYY}{MM}/{DD}/node_01.html"
SECTION_KEYWORDS = ["理论", "评论"]
PAGE_ITEMS_SEL = "#pageList .right_title-name"
PAGE_TITLE_SEL = "a"
ARTICLE_LIST_SEL = "#titleList ul li"
ARTICLE_LINK_CONTAINS = "content"
CONTENT_SEL = "#ozoom"
TITLE_SELS = "h1, h2, h3"
DEFAULT_CATEGORY = "{{DEFAULT_CATEGORY}}"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9",
}


def fetch(url, timeout=15):
    """请求页面，带超时与异常捕获；失败返回空串不中断流程。"""
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout)
        r.raise_for_status()
        r.encoding = r.apparent_encoding or "utf-8"
        return r.text
    except Exception as e:
        print(f"  [ERROR] 请求失败 {url}: {e}")
        return ""


def get_page_list(year, month, day):
    """获取当日版面列表，仅保留含关键词（理论/评论）的目标版面。"""
    url = LAYOUT_URL.format(YYYY=year, MM=month, DD=day)
    html = fetch(url)
    if not html:
        return []
    soup = BeautifulSoup(html, "html.parser")
    items = soup.select(PAGE_ITEMS_SEL)
    res = []
    for it in items:
        a = it.select_one(PAGE_TITLE_SEL) if PAGE_TITLE_SEL else it
        if not a:
            continue
        pname = a.get_text(strip=True)
        href = a.get("href", "")
        if not href:
            continue
        full = href if href.startswith("http") else urljoin(url, href)
        print(f"  🔍 识别版面：{pname}")
        if any(k in pname for k in SECTION_KEYWORDS):
            res.append((pname, full))
            print(f"  ✅ 选中目标版面：{pname}")
    return res


def get_article_urls(year, month, day, page_url):
    """获取某版面下的文章链接，按关键词过滤。"""
    html = fetch(page_url)
    if not html:
        return []
    soup = BeautifulSoup(html, "html.parser")
    links = []
    for li in soup.select(ARTICLE_LIST_SEL):
        for a in li.find_all("a"):
            href = a.get("href", "")
            if ARTICLE_LINK_CONTAINS and ARTICLE_LINK_CONTAINS not in href:
                continue
            if not href:
                continue
            full = href if href.startswith("http") else urljoin(page_url, href)
            links.append(full)
    return links


def parse_article(html):
    """解析单篇：标题 + 纯文本正文 + TipTap 兼容 HTML。双结构兼容。"""
    if not html:
        return None
    soup = BeautifulSoup(html, "html.parser")

    # 标题：按顺序尝试多个候选选择器
    title = ""
    for sel in [s.strip() for s in TITLE_SELS.split(",")]:
        t = soup.select_one(sel)
        if t:
            title = t.get_text(strip=True)
            break

    # 正文：移除广告/脚本等噪声，提取段落
    box = soup.select_one(CONTENT_SEL)
    paragraphs = []
    body_html = ""
    if box:
        for tag in box.select("script, style, iframe, .ad, .share, .comment"):
            tag.decompose()
        for p in box.find_all("p"):
            txt = p.get_text(strip=True)
            if txt:
                paragraphs.append(txt)
        body_html = "".join(str(c) for c in box.children)

    content_html = "".join(f"<p>{p}</p>" for p in paragraphs)  # TipTap 兼容
    content_plain = "\n".join(paragraphs)
    return {
        "title": title,
        "content_plain": content_plain,
        "content_html": content_html,
        "body_html": body_html,
    }


def upload(article, source_url, section, crawl_date):
    """推送到公文系统入库接口（携带 X-Crawler-Auth 请求头）。"""
    payload = {
        "sourceId": BIND_SOURCE_ID,
        "columnId": BIND_COLUMN_ID,
        "title": article["title"],
        "contentPlain": article["content_plain"],
        "contentHtml": article["content_html"],
        "pageName": section or DEFAULT_CATEGORY,
        "originUrl": source_url,
        "crawlDate": crawl_date,
    }
    headers = {
        "Content-Type": "application/json",
        "X-Crawler-Auth": API_KEY,
    }
    try:
        r = requests.post(UPLOAD_BACKEND_URL, json=payload, headers=headers, timeout=20)
        if r.ok:
            print(f"  ✓ 已入库：{article['title'][:30]}")
            return True
        print(f"  ✗ 入库失败：{r.status_code} {r.text[:160]}")
    except Exception as e:
        print(f"  ✗ 网络错误：{e}")
    return False


def crawl_day(year, month, day):
    """抓取并入库某一天的目标版面文章。"""
    date_str = f"{year}{month}{day}"
    pages = get_page_list(year, month, day)
    if not pages:
        print(f"  ⚠️ 【{date_str}】未匹配到目标版面，跳过")
        return 0
    count = 0
    for pname, plink in pages:
        for art_url in get_article_urls(year, month, day, plink):
            art = parse_article(fetch(art_url))
            if not art or not art["title"]:
                continue
            print(f"  📝 抓取文章：{art['title'][:30]}")
            if upload(art, art_url, pname, date_str):
                count += 1
            time.sleep(1.5)  # 防封禁休眠
    print(f"  ✅ {date_str} 爬取结束，成功入库 {count} 篇")
    return count


def daterange(start, end):
    a = datetime.datetime.strptime(start, "%Y%m%d")
    b = datetime.datetime.strptime(end, "%Y%m%d")
    while a <= b:
        yield a
        a += datetime.timedelta(days=1)


def main():
    ap = argparse.ArgumentParser(description=f"{SITE_NAME} 定向爬虫（自动入库）")
    ap.add_argument("--start", help="起始日期 YYYYMMDD（默认：当日）")
    ap.add_argument("--end", help="结束日期 YYYYMMDD（默认：当日）")
    ap.add_argument("--dry-run", action="store_true", help="仅抓取解析、不入库")
    args, _ = ap.parse_known_args()

    today = datetime.datetime.now()
    start = args.start or today.strftime("%Y%m%d")
    end = args.end or start

    print(f"==== {SITE_NAME} 爬虫 [{BIND_SOURCE_ID}] ====")
    print(f"区间：{start}~{end} | 入库地址：{UPLOAD_BACKEND_URL}")
    total = 0
    for d in daterange(start, end):
        y, m, dy = str(d.year), f"{d.month:02d}", f"{d.day:02d}"
        print(f"\n======== 开始爬取 {y}{m}{dy} ========")
        if args.dry_run:
            pages = get_page_list(y, m, dy)
            for pname, plink in pages:
                for art_url in get_article_urls(y, m, dy, plink):
                    art = parse_article(fetch(art_url))
                    if art and art["title"]:
                        total += 1
                        print(f"  📝(预览) {art['title'][:30]}")
                    time.sleep(0.5)
        else:
            total += crawl_day(y, m, dy)
        time.sleep(2)
    print(f"\n🎉 任务结束，共处理 {total} 篇")


if __name__ == "__main__":
    main()
`;

/** 渲染完整可运行 Python 脚本 */
export function renderCrawlerScript(input: CrawlerRenderInput): string {
  const safe = (input.siteName || "site")
    .replace(/[^\w\u4e00-\u9fa5]/g, "_")
    .replace(/_+/g, "_");
  let code = TEMPLATE;
  code = code.replace(/\{\{API_KEY\}\}/g, input.apiKey);
  code = code.replace(/\{\{UPLOAD_BACKEND_URL\}\}/g, input.backendUrl);
  code = code.replace(/\{\{BIND_SOURCE_ID\}\}/g, input.sourceId);
  code = code.replace(/\{\{BIND_COLUMN_ID\}\}/g, input.columnId || "");
  code = code.replace(/\{\{BASE_URL\}\}/g, input.baseUrl);
  code = code.replace(/\{\{SITE_NAME\}\}/g, input.siteName || "未命名站点");
  code = code.replace(/\{\{DEFAULT_CATEGORY\}\}/g, input.defaultCategory || "综合");
  code = code.replace(/\{\{SOURCE_ID_SAFE\}\}/g, safe || "site");
  return code;
}
