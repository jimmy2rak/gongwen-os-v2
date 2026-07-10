#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
新华网 · 理论动态 定向爬虫（公文系统自动生成 · 超管专属）
========================================================
由公文系统「爬虫热点推送配置」自动生成，仅供超级管理员使用。
抓取 https://www.news.cn/politics/xhll/index.html 理论动态栏目
所有文章，逐条推送至后端入库。
全程无需确认与手动输入；单篇失败自动跳过并休眠防封。

依赖：pip install requests beautifulsoup4
运行：python3 crawler_task_新华网.py
"""

import sys, os, io, time, json, hashlib, datetime, argparse, re
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

# ═══════════════════ 后端注入参数（请勿手动修改） ═════════════════
API_KEY = "gw_crawler_9858de6414cd6114e4ae60b07d170329"                        # X-Crawler-Auth 鉴权密钥（后端注入）
UPLOAD_BACKEND_URL = "https://gongwenos.182183.xyz/api/public/crawler/upload"  # 入库接口地址（后端注入）
BIND_SOURCE_ID = "cNewsXhll01"            # 绑定爬虫数据源 ID（后端注入）
BIND_COLUMN_ID = ""                       # 绑定公文栏目 ID（后端注入）
# ══════════════════════════════════════════════════════════════════

# ── 站点配置（后端注入）──
SITE_NAME = "新华网"
INDEX_URL = "https://www.news.cn/politics/xhll/index.html"                     # 抓取入口
SECTION_KEYWORDS = ["理论"]                                                    # 版面/栏目关键词
DEFAULT_CATEGORY = "理论动态"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Referer": "https://www.news.cn/",
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


def build_article_url(href):
    """将相对路径补全为绝对 URL。"""
    if not href:
        return ""
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        return urljoin("https://www.news.cn", href)
    return urljoin(INDEX_URL, href)


def is_article_link(href):
    """判断是否为有效文章链接（/politics/{YYYYMMDD}/{hash}/c.html 形式）。"""
    if not href or not href.endswith("c.html"):
        return False
    if not re.search(r"/politics/\d{8}/[a-f0-9]{32,}/c\.html", href):
        return False
    return True


def get_article_list():
    """
    获取理论动态栏目下的文章列表。
    新华网理论动态为单页结构（无日期分页），
    列表项位于 #content-list .item 内。
    """
    print(f"  📰 拉取栏目列表：{INDEX_URL}")
    html = fetch(INDEX_URL)
    if not html:
        print("  ⚠️ 栏目列表页为空")
        return []

    soup = BeautifulSoup(html, "html.parser")

    # 1. 首选精准选择器
    items = soup.select("#content-list .item")
    if not items:
        # 2. 兜底：所有 .item
        items = soup.select(".item")
    if not items:
        # 3. 最后兜底：按链接规则提取
        items = []
        for a in soup.find_all("a", href=True):
            if is_article_link(a["href"]):
                items.append(a.parent)

    print(f"  共找到 {len(items)} 个文章项")

    articles = []
    seen = set()
    for it in items:
        a = it.find("a", href=True)
        if not a:
            continue
        href = a["href"]
        if not is_article_link(href):
            continue
        full_url = build_article_url(href)
        if full_url in seen:
            continue
        seen.add(full_url)

        title = a.get_text(strip=True)
        if not title:
            # 兜底：取子元素的文本
            title = it.get_text(strip=True).split("\n")[0].strip()

        # 摘要（取 item 中的 p / .desc）
        summary = ""
        for sel in ["p", ".desc", ".intro"]:
            desc_el = it.select_one(sel)
            if desc_el and desc_el.get_text(strip=True) != title:
                summary = desc_el.get_text(strip=True)
                break

        # 日期（取 .date / .time / .pubtime）
        pub_date = ""
        for sel in [".date", ".time", ".pubtime", ".publish-time"]:
            dt_el = it.select_one(sel)
            if dt_el:
                pub_date = dt_el.get_text(strip=True)
                break

        articles.append({
            "title": title,
            "url": full_url,
            "summary": summary,
            "pub_date": pub_date,
        })
        print(f"  🔍 识别文章：{title[:40]}")

    return articles


def parse_article(html):
    """
    解析单篇：标题 + 纯文本正文 + TipTap 兼容 HTML。
    新华网文章结构：<h1 class="title"> + <div id="detail">...<p>...</p>...
    """
    if not html:
        return None
    soup = BeautifulSoup(html, "html.parser")

    # 标题：按优先级查找
    title = ""
    for sel in ["h1.title", "h1", ".title", ".article-title", ".main-title", "header h1"]:
        el = soup.select_one(sel)
        if el:
            txt = el.get_text(strip=True)
            if txt:
                title = txt
                break
    if not title and soup.title:
        title = soup.title.get_text(strip=True).split("_")[0].split("-")[0].strip()

    # 正文：#detail 是主容器，移除广告/脚本等噪声
    box = soup.select_one("#detail")
    if not box:
        # 兜底：.article / .TRS_Editor / div.content
        for sel in [".article", ".TRS_Editor", "div.content", "article"]:
            box = soup.select_one(sel)
            if box and box.find("p"):
                break

    paragraphs = []
    body_html = ""
    if box:
        # 清理噪声
        for tag in box.select("script, style, iframe, .ad, .share, .comment, .editor, .source, .author, .declare, .print, .pages_print"):
            tag.decompose()

        # 提取段落：同时保留 h2/h3 子标题
        for el in box.find_all(["p", "h2", "h3"], recursive=True):
            txt = el.get_text(strip=True)
            if not txt or len(txt) < 2:
                continue
            if el.name == "h2" or el.name == "h3":
                # 子标题在 TipTap 中用 <h2>
                if len(txt) < 60 and not txt.endswith("：") and not txt.endswith(":"):
                    paragraphs.append(("h", txt))
                else:
                    paragraphs.append(("p", txt))
            else:
                paragraphs.append(("p", txt))
        body_html = "".join(str(c) for c in box.children)
    else:
        # 最终兜底：全页段落
        for p in soup.find_all("p"):
            txt = p.get_text(strip=True)
            if txt and len(txt) > 5:
                paragraphs.append(("p", txt))

    if not paragraphs:
        return None

    # 构造 TipTap 兼容 HTML：子标题 → <h2>，普通段落 → <p>
    content_html = ""
    for kind, txt in paragraphs:
        if kind == "h":
            content_html += f"<h2>{txt}</h2>"
        else:
            content_html += f"<p>{txt}</p>"

    content_plain = "\n".join(t for _, t in paragraphs)
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
        "sourceName": SITE_NAME,
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
            data = r.json()
            if data.get("duplicated"):
                print(f"  ⚠️ 已存在，跳过：{article['title'][:30]}")
            else:
                print(f"  ✓ 已入库：{article['title'][:30]}")
            return True
        print(f"  ✗ 入库失败：{r.status_code} {r.text[:160]}")
    except Exception as e:
        print(f"  ✗ 网络错误：{e}")
    return False


def crawl_index():
    """
    抓取并入库理论动态首页的全部文章。
    新华网理论动态为单页列表，无日期分页功能。
    """
    today = datetime.datetime.now().strftime("%Y%m%d")
    print(f"\n======== 开始爬取 {SITE_NAME} 理论动态 ========")

    articles = get_article_list()
    if not articles:
        print(f"  ⚠️ 未匹配到目标文章，跳过")
        return 0

    count = 0
    for art_meta in articles:
        art_url = art_meta["url"]
        art_title = art_meta["title"]
        pub_date = art_meta.get("pub_date", "")
        print(f"\n  📄 抓取文章：{art_title[:40]}")
        print(f"     URL: {art_url}")

        html = fetch(art_url)
        art = parse_article(html)
        if not art or not art["title"]:
            print(f"  ⚠️ 无法解析文章：{art_url}")
            continue

        # 用文章本身的日期作为 crawlDate（若有），否则用今天
        crawl_date = pub_date or today
        crawl_date = re.sub(r"[^0-9]", "", crawl_date)[:8] or today

        if upload(art, art_url, DEFAULT_CATEGORY, crawl_date):
            count += 1
        time.sleep(1.5)  # 防封禁休眠

    print(f"\n  ✅ 理论动态爬取结束，成功入库 {count} 篇")
    return count


def main():
    ap = argparse.ArgumentParser(description=f"{SITE_NAME} 理论动态定向爬虫（自动入库）")
    ap.add_argument("--dry-run", action="store_true", help="仅抓取解析、不入库")
    ap.add_argument("--limit", type=int, default=0, help="限制抓取条数（0=全部）")
    args, _ = ap.parse_known_args()

    print(f"==== {SITE_NAME} 理论动态爬虫 [{BIND_SOURCE_ID}] ====")
    print(f"入口：{INDEX_URL} | 入库地址：{UPLOAD_BACKEND_URL}")

    if args.dry_run:
        # 预览模式：只解析不入库
        articles = get_article_list()
        total = 0
        for art_meta in articles:
            if args.limit and total >= args.limit:
                break
            html = fetch(art_meta["url"])
            art = parse_article(html)
            if art and art["title"]:
                total += 1
                print(f"  📝(预览) {art['title'][:40]}  字数={len(art['content_plain'])}")
            time.sleep(0.5)
        print(f"\n🎉 预览结束，共解析 {total} 篇")
    else:
        total = crawl_index()
        if args.limit and total > args.limit:
            print(f"  ⚠️ 命中 {total} 篇，限制为 {args.limit} 篇")
        print(f"\n🎉 任务结束，共处理 {total} 篇")


if __name__ == "__main__":
    main()
