#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
人民日报 · 理论版+评论版 · 当日自动爬虫（第二版）
=================================================
需通过环境变量提供爬虫入库密钥后运行（密钥不再硬编码于源码）。

依赖：pip install requests beautifulsoup4
运行：
  export CRAWLER_API_KEY=your_key
  export BACKEND_URL=https://your-domain.xyz   # 可选，默认生产域名
  python3 crawl_rmrb_today.py             # 直接爬取并入库
  python3 crawl_rmrb_today.py --dry-run   # 仅预览不写入

安全说明：CRAWLER_API_KEY 用于 X-Crawler-Auth 鉴权，请通过环境变量注入，
切勿将真实密钥写入源码或提交到仓库（本文件已移除内置密钥）。
"""

import os
import sys
import time
import json
import datetime
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

# ── 内置配置（后端地址可环境变量覆盖；密钥仅来自环境变量）────
_BACKEND_URL = "https://gongwenos.182183.xyz"

BACKEND_URL = (os.environ.get("BACKEND_URL") or _BACKEND_URL).rstrip("/")
API_KEY = os.environ.get("CRAWLER_API_KEY", "")
if not API_KEY:
    raise SystemExit("❌ 未设置环境变量 CRAWLER_API_KEY，请先 export 后再运行（密钥不内置）")
UPLOAD_URL = f"{BACKEND_URL}/api/public/crawler/upload"
SOURCE_NAME = "人民日报"
COLUMN_ID = "人民日报"  # 前端板块名

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9",
}


def fetch(url, timeout=15):
    """请求页面，失败返回空串。"""
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout)
        r.raise_for_status()
        r.encoding = r.apparent_encoding or "utf-8"
        return r.text
    except Exception as e:
        print(f"  ❌ 请求失败 {url} : {e}")
        return ""


def build_layout_url(year, month, day):
    return f"http://paper.people.com.cn/rmrb/pc/layout/{year}{month}/{day}/node_01.html"


def build_page_url(year, month, day, href):
    """版面页链接：href 如 node_05.html。"""
    if href.startswith("http"):
        return href
    base = f"http://paper.people.com.cn/rmrb/pc/layout/{year}{month}/{day}/"
    return urljoin(base, href)


def build_article_url(year, month, day, href):
    """文章详情页链接：href 通常包含 content。"""
    if href.startswith("http"):
        return href
    base = f"http://paper.people.com.cn/rmrb/pc/content/{year}{month}/{day}/"
    return urljoin(base, href)


def get_page_list(year, month, day):
    """获取版面列表，仅保留含「理论」或「评论」的版面。"""
    layout_url = build_layout_url(year, month, day)
    print(f"\n📰 拉取版面列表页：{layout_url}")
    html = fetch(layout_url)
    if not html:
        print("  ⚠️ 版面列表页为空，可能日期尚未发布或网络错误")
        return []

    bs = BeautifulSoup(html, "html.parser")

    # 多种版面容器兜底
    page_items = []
    page_list = bs.find("div", id="pageList")
    if page_list:
        if page_list.ul:
            page_items = page_list.ul.find_all("div", class_="right_title-name")
        else:
            page_items = page_list.find_all("div", class_="right_title-name")
    if not page_items:
        swiper = bs.find("div", class_="swiper-container")
        if swiper:
            page_items = swiper.find_all("div", class_="swiper-slide")
    if not page_items:
        page_items = bs.select("#pageList .right_title-name")

    print(f"  共找到 {len(page_items)} 个版面候选")

    res = []
    for item in page_items:
        a = item.find("a")
        if not a:
            continue
        p_name = a.get_text(strip=True)
        href = a.get("href", "")
        if not href:
            continue
        full_link = build_page_url(year, month, day, href)
        print(f"  🔍 识别版面：{p_name}")
        if "理论" in p_name or "评论" in p_name:
            res.append((p_name, full_link))
            print(f"  ✅ 选中目标版面：{p_name}")
    return res


def get_article_urls(year, month, day, page_url):
    """获取某版面页下的文章详情链接。"""
    html = fetch(page_url)
    if not html:
        print(f"  ⚠️ 版面页为空：{page_url}")
        return []

    bs = BeautifulSoup(html, "html.parser")

    li_list = []
    title_list = bs.find("div", id="titleList")
    if title_list and title_list.ul:
        li_list = title_list.ul.find_all("li")
    if not li_list:
        news_list = bs.find("ul", class_="news-list")
        if news_list:
            li_list = news_list.find_all("li")
    if not li_list:
        li_list = bs.select("#titleList ul li")

    print(f"  版面页找到 {len(li_list)} 个 li 候选")

    art_links = []
    for li in li_list:
        for a in li.find_all("a"):
            href = a.get("href", "")
            if not href or "content" not in href:
                continue
            art_url = build_article_url(year, month, day, href)
            if art_url not in art_links:
                art_links.append(art_url)
    print(f"  提取到 {len(art_links)} 篇文章链接")
    return art_links


def parse_article(html):
    """解析文章标题与正文。"""
    if not html:
        return None
    bs = BeautifulSoup(html, "html.parser")

    # 标题：按 h3/h1/h2 顺序尝试
    title = ""
    for tag in [bs.h3, bs.h1, bs.h2]:
        if tag:
            txt = tag.get_text(strip=True)
            if txt:
                title = txt
                break

    if not title:
        # 兜底：尝试 title 标签
        if bs.title:
            title = bs.title.get_text(strip=True)

    # 正文
    content_box = bs.find("div", id="ozoom")
    paragraphs = []
    body_html = ""
    if content_box:
        for t in content_box.select("script, style, iframe, .ad, .share, .comment"):
            t.decompose()
        for p in content_box.find_all("p"):
            txt = p.get_text(strip=True)
            if txt:
                paragraphs.append(txt)
        body_html = "".join(str(c) for c in content_box.children)
    else:
        # 兜底：取 body 内所有 p
        for p in bs.find_all("p"):
            txt = p.get_text(strip=True)
            if txt:
                paragraphs.append(txt)

    content_plain = "\n".join(paragraphs)
    content_html = "".join(f"<p>{p}</p>" for p in paragraphs)

    return {
        "title": title,
        "content_plain": content_plain,
        "content_html": content_html,
        "body_html": body_html,
        "html_raw": html,
    }


def upload_article(article, page_name, art_url, crawl_date):
    """上传到公文系统 hot_article。"""
    payload = {
        "sourceId": None,
        "sourceName": SOURCE_NAME,
        "columnId": COLUMN_ID,
        "title": article["title"],
        "contentPlain": article["content_plain"],
        "contentHtml": article["content_html"],
        "pageName": page_name,
        "originUrl": art_url,
        "crawlDate": crawl_date,
    }
    headers = {
        "Content-Type": "application/json",
        "X-Crawler-Auth": API_KEY,
    }
    try:
        r = requests.post(UPLOAD_URL, json=payload, headers=headers, timeout=20)
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


def crawl_today():
    if not API_KEY:
        print("❌ 请设置环境变量 CRAWLER_API_KEY（X-Crawler-Auth 密钥）")
        print("   获取方式：系统设置 → 爬虫热点推送配置 → 生成脚本 → 复制密钥")
        sys.exit(1)

    today = datetime.datetime.now()
    year = str(today.year)
    month = f"{today.month:02d}"
    day = f"{today.day:02d}"
    date_str = f"{year}{month}{day}"

    print(f"==== 人民日报自动爬虫 [{date_str}] ====")
    print(f"入库地址：{UPLOAD_URL}")

    pages = get_page_list(year, month, day)
    if not pages:
        print(f"\n⚠️ 【{date_str}】未匹配到理论/评论版面，可能原因：")
        print("   1. 当日报纸尚未上线（通常清晨 6~8 点后）")
        print("   2. 网络或页面结构变化")
        print("   3. 日期格式或 URL 模板已过期")
        return

    total = 0
    for page_name, page_link in pages:
        print(f"\n📄 进入版面：{page_name}")
        urls = get_article_urls(year, month, day, page_link)
        if not urls:
            print(f"  📭 该版面无文章链接")
            continue
        for art_url in urls:
            html = fetch(art_url)
            art = parse_article(html)
            if not art or not art["title"]:
                print(f"  ⚠️ 无法解析文章：{art_url}")
                continue
            print(f"  📝 抓取文章：{art['title'][:40]}")
            if upload_article(art, page_name, art_url, date_str):
                total += 1
            time.sleep(1)
        time.sleep(2)

    print(f"\n🎉 任务结束，共入库 {total} 篇")


if __name__ == "__main__":
    crawl_today()
