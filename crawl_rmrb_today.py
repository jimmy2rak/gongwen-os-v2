#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
人民日报 · 理论版+评论版 · 当日自动爬虫
======================================
无交互，默认抓取当日，直接上传到公文系统「人民日报」板块。

依赖：pip install requests beautifulsoup4
运行：
  export BACKEND_URL=https://gongwenos.182183.xyz
  export CRAWLER_API_KEY=<你的 X-Crawler-Auth 密钥>
  python3 crawl_rmrb_today.py
"""

import os
import sys
import re
import time
import json
import datetime
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

# ── 配置 ──────────────────────────────────────────
BACKEND_URL = (os.environ.get("BACKEND_URL") or "https://gongwenos.182183.xyz").rstrip("/")
API_KEY = os.environ.get("CRAWLER_API_KEY") or ""
UPLOAD_URL = f"{BACKEND_URL}/api/public/crawler/upload"
SOURCE_NAME = "人民日报"
COLUMN_ID = "人民日报"  # 前端按此板块渲染

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9",
}


def fetch_url(url, timeout=15):
    """请求页面，失败返回空串不中断。"""
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout)
        r.raise_for_status()
        r.encoding = r.apparent_encoding or "utf-8"
        return r.text
    except Exception as e:
        print(f"  ❌ 请求失败 {url} : {e}")
        return ""


def get_page_list(year, month, day):
    """获取当日版面列表，仅保留含「理论/评论」的版面。"""
    base_url = f"http://paper.people.com.cn/rmrb/pc/layout/{year}{month}/{day}/node_01.html"
    html = fetch_url(base_url)
    if not html:
        return []
    bs = BeautifulSoup(html, "html.parser")
    page_items = []
    page_list = bs.find("div", id="pageList")
    if page_list and page_list.ul:
        page_items = page_list.ul.find_all("div", class_="right_title-name")
    else:
        swiper = bs.find("div", class_="swiper-container")
        if swiper:
            page_items = swiper.find_all("div", class_="swiper-slide")

    res = []
    for item in page_items:
        a = item.find("a")
        if not a:
            continue
        p_name = a.get_text(strip=True)
        href = a.get("href", "")
        if not href:
            continue
        full_link = urljoin(base_url, href)
        print(f"  🔍 识别版面：{p_name}")
        if "评论" in p_name or "理论" in p_name:
            res.append((p_name, full_link))
            print(f"  ✅ 选中目标版面：{p_name}")
    return res


def get_article_urls(year, month, day, page_url):
    """获取某版面下的文章链接。"""
    html = fetch_url(page_url)
    if not html:
        return []
    bs = BeautifulSoup(html, "html.parser")
    li_list = []
    title_list = bs.find("div", id="titleList")
    if title_list and title_list.ul:
        li_list = title_list.ul.find_all("li")
    else:
        news_list = bs.find("ul", class_="news-list")
        if news_list:
            li_list = news_list.find_all("li")

    art_links = []
    for li in li_list:
        for a in li.find_all("a"):
            link = a.get("href", "")
            if "content" in link:
                art_url = urljoin(page_url, link)
                art_links.append(art_url)
    return art_links


def parse_article(html):
    """解析单篇：标题 + 纯文本 + TipTap 兼容 HTML。"""
    if not html:
        return None
    bs = BeautifulSoup(html, "html.parser")

    # 标题：按 h3/h1/h2 顺序拼接
    title_parts = []
    for tag in [bs.h3, bs.h1, bs.h2]:
        if tag:
            txt = tag.get_text(strip=True)
            if txt and txt not in title_parts:
                title_parts.append(txt)
    title = " ".join(title_parts)

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
        print(f"⚠️ 【{date_str}】未匹配到理论/评论版面")
        return

    total = 0
    for page_name, page_link in pages:
        urls = get_article_urls(year, month, day, page_link)
        if not urls:
            print(f"  📭 版面 {page_name} 无文章链接")
            continue
        for art_url in urls:
            html = fetch_url(art_url)
            art = parse_article(html)
            if not art or not art["title"]:
                continue
            print(f"  📝 抓取文章：{art['title'][:30]}")
            if upload_article(art, page_name, art_url, date_str):
                total += 1
            time.sleep(1)
        time.sleep(2)

    print(f"\n🎉 任务结束，共入库 {total} 篇")


if __name__ == "__main__":
    crawl_today()
