// ─── 爬虫代码生成器 ──────────────────────────────
// 根据用户在设置页填写的网站配置，生成一份完整、可独立运行的
// Python 爬虫脚本（日期分页式电子报模型，与 crawl_rmrb.py 同构）。
//
// 生成的脚本输出格式与公文系统完全对接：
//   - title / summary / content_html(TipTap) / body_html(预览) / html_raw(落盘)
//   - 支持 --push(API) / --db(SQLite直写) / --dry-run 三种同步方式

export interface CrawlerConfig {
  siteName: string;            // 站点名称，如「人民日报」
  layoutUrl: string;           // 版面导航页 URL 模板，含 {YYYY}{MM}{DD} 占位符
  sectionKeywords: string[];   // 仅抓取名称含这些关键词的版面，如 ["理论","评论"]
  pageItemsSel: string;        // 版面列表条目 CSS 选择器
  pageTitleSel: string;        // 版面标题元素（条目内的 a 标签）
  articleListSel: string;      // 文章列表容器 CSS 选择器
  articleLinkContains: string; // 文章链接过滤关键词，如 "content"
  contentSel: string;          // 正文容器 CSS 选择器
  titleSels: string;           // 标题候选选择器，逗号分隔，如 "h1, h2, h3"
  defaultCategory: string;     // 默认分类标签
  apiUrl: string;              // 公文系统热点 API 地址
}

export const RMRB_PRESET: CrawlerConfig = {
  siteName: "人民日报",
  layoutUrl: "http://paper.people.com.cn/rmrb/pc/layout/{YYYY}{MM}/{DD}/node_01.html",
  sectionKeywords: ["理论", "评论"],
  pageItemsSel: "#pageList .right_title-name",
  pageTitleSel: "a",
  articleListSel: "#titleList ul li",
  articleLinkContains: "content",
  contentSel: "#ozoom",
  titleSels: "h1, h2, h3",
  defaultCategory: "时政",
  apiUrl: "http://localhost:3000/api/hotspots",
};

const TEMPLATE = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
__SITE_NAME__ · 定向爬虫（公文系统自动生成）
===========================================
生成时间：__GEN_DATE__
用途：爬取 __SITE_NAME__ 指定版面文章，输出结构化 JSON + 原始 HTML，并同步到公文 AI 系统。

输出字段：title / summary / content_html(TipTap) / body_html(预览) / html_raw(落盘)
同步方式：
  1. 默认      仅本地 JSON + HTML 文件
  2. --push     POST 到公文系统 /api/hotspots（需 --token 或环境变量 AUTH_TOKEN）
  3. --db PATH 直接写入 SQLite（无需鉴权，适合每日定时任务）

依赖：pip install requests beautifulsoup4
示例：
  python3 crawl___SAFE_NAME__.py --start 20260701 --end 20260708
  python3 crawl___SAFE_NAME__.py --start 20260708 --end 20260708 --db ./data.db
"""

import sys, os, json, time, hashlib, datetime, argparse
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

# ══════════════════ 站点配置（自动生成） ══════════════════
SITE_NAME = "__SITE_NAME__"
LAYOUT_URL = "__LAYOUT_URL__"
SECTION_KEYWORDS = __SECTION_KEYWORDS__
PAGE_ITEMS_SEL = "__PAGE_ITEMS_SEL__"
PAGE_TITLE_SEL = "__PAGE_TITLE_SEL__"
ARTICLE_LIST_SEL = "__ARTICLE_LIST_SEL__"
ARTICLE_LINK_CONTAINS = "__ARTICLE_LINK_CONTAINS__"
CONTENT_SEL = "__CONTENT_SEL__"
TITLE_SELS = "__TITLE_SELS__"
DEFAULT_CATEGORY = "__DEFAULT_CATEGORY__"
API_URL = "__API_URL__"
# ═════════════════════════════════════════════════════════

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9",
}


def fetch(url, timeout=15):
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout)
        r.raise_for_status()
        r.encoding = r.apparent_encoding or "utf-8"
        return r.text
    except Exception as e:
        print(f"  [ERROR] 请求失败 {url}: {e}")
        return ""


def get_page_list(year, month, day):
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
    if not html:
        return None
    soup = BeautifulSoup(html, "html.parser")
    title = ""
    for sel in [s.strip() for s in TITLE_SELS.split(",")]:
        t = soup.select_one(sel)
        if t:
            title = t.get_text(strip=True)
            break
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
    content_html = "".join(f"<p>{p}</p>" for p in paragraphs)
    summary = paragraphs[0][:200] if paragraphs else ""
    return {
        "title": title,
        "summary": summary,
        "content_html": content_html,
        "body_html": body_html,
        "html_raw": html,
    }


def push_to_api(article, source_url, section, api_url, token, heat):
    payload = {
        "title": article["title"], "summary": article["summary"],
        "source": SITE_NAME, "category": section or DEFAULT_CATEGORY,
        "url": source_url, "htmlContent": article["body_html"], "heat": heat,
    }
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Cookie"] = f"auth_token={token}"
    try:
        r = requests.post(api_url, json=payload, headers=headers, timeout=10)
        if r.ok:
            print(f"  ✓ 已入库：{article['title'][:30]}")
            return True
        print(f"  ✗ 入库失败：{r.status_code} {r.text[:120]}")
    except Exception as e:
        print(f"  ✗ 网络错误：{e}")
    return False


def push_to_db(article, source_url, section, db_path):
    import sqlite3
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        hid = "hot" + hashlib.md5((article["title"] + source_url).encode()).hexdigest()[:16]
        now = int(time.time())
        cur.execute(
            "INSERT OR IGNORE INTO hotspots "
            "(id, title, summary, source, source_id, category, url, html_content, heat, starred, created_at) "
            "VALUES (?, ?, ?, ?, NULL, ?, ?, ?, 0, 0, ?)",
            (hid, article["title"], article["summary"], SITE_NAME,
             section or DEFAULT_CATEGORY, source_url, article["body_html"], now),
        )
        conn.commit(); conn.close()
        print(f"  ✓ 已入库(DB)：{article['title'][:30]}")
        return True
    except Exception as e:
        print(f"  ✗ 数据库写入失败：{e}")
        return False


def crawl_day(year, month, day, out_dir, mode, api_url, token, db_path, dry_run):
    date_str = f"{year}{month}{day}"
    pages = get_page_list(year, month, day)
    day_data = {"date": date_str, "articles": []}
    if not pages:
        print(f"  ⚠️ 【{date_str}】未匹配到目标版面，生成空 JSON")
        if not dry_run:
            os.makedirs(out_dir, exist_ok=True)
            with open(os.path.join(out_dir, f"{date_str}.json"), "w", encoding="utf-8") as f:
                json.dump(day_data, f, ensure_ascii=False, indent=2)
        return
    for pname, plink in pages:
        for art_url in get_article_urls(year, month, day, plink):
            art = parse_article(fetch(art_url))
            if not art or not art["title"]:
                continue
            art["source_url"] = art_url
            art["section"] = pname
            day_data["articles"].append(art)
            print(f"  📝 抓取文章：{art['title'][:30]}")
            if dry_run:
                continue
            if mode == "api":
                push_to_api(art, art_url, pname, api_url, token, max(0, 30 - len(day_data["articles"])))
            elif mode == "db":
                push_to_db(art, art_url, pname, db_path)
            time.sleep(1)
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, f"{date_str}.json"), "w", encoding="utf-8") as f:
        json.dump(day_data, f, ensure_ascii=False, indent=2)
    html_dir = os.path.join(out_dir, "html", date_str)
    os.makedirs(html_dir, exist_ok=True)
    for i, art in enumerate(day_data["articles"]):
        safe = hashlib.md5(art["title"].encode()).hexdigest()[:8]
        with open(os.path.join(html_dir, f"{i:02d}_{safe}.html"), "w", encoding="utf-8") as f:
            f.write(art["html_raw"])
    print(f"  ✅ {date_str} 爬取结束，共 {len(day_data['articles'])} 篇")


def daterange(start, end):
    a = datetime.datetime.strptime(start, "%Y%m%d")
    b = datetime.datetime.strptime(end, "%Y%m%d")
    while a <= b:
        yield a
        a += datetime.timedelta(days=1)


def main():
    ap = argparse.ArgumentParser(description=f"{SITE_NAME} 热点爬虫")
    ap.add_argument("--start", required=True, help="起始日期 YYYYMMDD")
    ap.add_argument("--end", required=True, help="结束日期 YYYYMMDD")
    ap.add_argument("--out", default="./__SAFE_NAME___json", help="输出目录")
    ap.add_argument("--push", action="store_true", help="推送到公文系统 API")
    ap.add_argument("--db", default="", help="直接写入 SQLite 数据库路径")
    ap.add_argument("--api-url", default=API_URL, help="热点 API 地址")
    ap.add_argument("--token", default=os.environ.get("AUTH_TOKEN", ""), help="API 认证 token")
    ap.add_argument("--dry-run", action="store_true", help="仅预览不写入")
    args = ap.parse_args()
    mode = "local"
    if args.db:
        mode = "db"
    elif args.push:
        mode = "api"
    print(f"==== {SITE_NAME} 爬虫 ====")
    print(f"模式：{'预览' if args.dry_run else mode} | 区间：{args.start}~{args.end}")
    for d in daterange(args.start, args.end):
        y, m, dy = str(d.year), f"{d.month:02d}", f"{d.day:02d}"
        print(f"\\n======== 开始爬取 {y}{m}{dy} ========")
        crawl_day(y, m, dy, args.out, mode, args.api_url, args.token, args.db, args.dry_run)
        time.sleep(2)
    print("\\n🎉 全部日期爬取任务结束！")


if __name__ == "__main__":
    main()
`;

export function generateCrawlerScript(cfg: CrawlerConfig): string {
  const safe = (cfg.siteName || "site").replace(/[^\w\u4e00-\u9fa5]/g, "_").replace(/_+/g, "_");
  const genDate = new Date().toISOString().slice(0, 10);
  let code = TEMPLATE;
  code = code.replace(/__SITE_NAME__/g, cfg.siteName || "未命名站点");
  code = code.replace(/__GEN_DATE__/g, genDate);
  code = code.replace(/__SAFE_NAME__/g, safe || "site");
  code = code.replace(/__LAYOUT_URL__/g, cfg.layoutUrl || "");
  code = code.replace(
    /__SECTION_KEYWORDS__/g,
    JSON.stringify(cfg.sectionKeywords && cfg.sectionKeywords.length ? cfg.sectionKeywords : [""])
  );
  code = code.replace(/__PAGE_ITEMS_SEL__/g, cfg.pageItemsSel || "");
  code = code.replace(/__PAGE_TITLE_SEL__/g, cfg.pageTitleSel || "a");
  code = code.replace(/__ARTICLE_LIST_SEL__/g, cfg.articleListSel || "");
  code = code.replace(/__ARTICLE_LINK_CONTAINS__/g, cfg.articleLinkContains || "");
  code = code.replace(/__CONTENT_SEL__/g, cfg.contentSel || "");
  code = code.replace(/__TITLE_SELS__/g, cfg.titleSels || "h1, h2, h3");
  code = code.replace(/__DEFAULT_CATEGORY__/g, cfg.defaultCategory || "综合");
  code = code.replace(/__API_URL__/g, cfg.apiUrl || "http://localhost:3000/api/hotspots");
  return code;
}
