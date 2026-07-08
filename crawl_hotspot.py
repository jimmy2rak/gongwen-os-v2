#!/usr/bin/env python3
"""
公文 AI 写作 — 热点资讯爬虫
用法:
  python3 crawl_hotspot.py --name "人民日报" --url "https://www.people.com.cn/" --category "时政"
  python3 crawl_hotspot.py --name "新华社" --url "https://www.xinhuanet.com/" --category "时政" --selector-title "h3 a" --selector-summary ".summary" --selector-link "a@href"

配置:
  --name        来源名称
  --url         列表页 URL（必填）
  --category    分类标签
  --selector-title      标题 CSS 选择器（默认 h3 a）
  --selector-summary    摘要 CSS 选择器
  --selector-link       链接 CSS 选择器（默认 a@href）
  --selector-content    正文 HTML CSS 选择器
  --api-url             热点 API 地址（默认 http://localhost:3000/api/hotspots）
  --auth-token          API 认证 token（默认读取本地 cookie）
  --dry-run             仅打印结果，不写入数据库

输出:
  抓取结果写入热点数据库，HTML 全文存入 html_content 字段，支持前端原文预览。
"""

import sys
import json
import time
import argparse
import hashlib
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

def fetch_page(url, timeout=15):
    """获取页面 HTML"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    }
    resp = requests.get(url, headers=headers, timeout=timeout)
    resp.encoding = resp.apparent_encoding or "utf-8"
    return resp.text


def extract_articles(html, config):
    """
    从 HTML 中提取文章列表。
    config 可选字段: selector_title, selector_summary, selector_link
    """
    soup = BeautifulSoup(html, "html.parser")
    articles = []

    # 尝试识别常见列表结构
    # 方案1：使用配置的选择器
    title_sel = config.get("selector_title", "h3 a, h2 a, .news-title a, .title a")
    summary_sel = config.get("selector_summary", "p, .desc, .summary, .abstract")
    link_sel = config.get("selector_link", "a@href")
    content_sel = config.get("selector_content")

    # 找到所有可能的列表项
    items = soup.select(config.get("list_selector", "li, .item, .news-item, article, .list-item"))
    if not items:
        # 降级：直接找标题元素
        titles = soup.select(title_sel)
        for t in titles[:30]:
            link = ""
            if "@href" in link_sel:
                link_attr = link_sel.replace("@href", "").strip()
                if link_attr:
                    parent = t.select_one(link_attr) or t
                else:
                    parent = t
                href = parent.get("href", "")
                if href and not href.startswith("http"):
                    href = urljoin(config["url"], href)
                link = href

            title = t.get_text(strip=True)
            if not title or len(title) < 5:
                continue

            articles.append({
                "title": title,
                "summary": "",
                "url": link,
            })
    else:
        for item in items[:30]:
            title_el = item.select_one(title_sel.split(",")[0]) if title_sel else item
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            if not title or len(title) < 5:
                continue

            summary = ""
            if summary_sel:
                summary_el = item.select_one(summary_sel.split(",")[0])
                if summary_el:
                    summary = summary_el.get_text(strip=True)[:200]

            link = ""
            if "@href" in link_sel:
                link_attr = link_sel.replace("@href", "").strip()
                parent_el = title_el
                if link_attr:
                    parent_el = item.select_one(link_attr) or title_el
                href = parent_el.get("href", "")
                if href and not href.startswith("http"):
                    href = urljoin(config["url"], href)
                link = href
            else:
                link = config["url"]

            articles.append({
                "title": title,
                "summary": summary,
                "url": link,
            })

    return articles


def fetch_article_content(url, selector_content=None):
    """获取文章正文 HTML"""
    if not url:
        return ""
    try:
        html = fetch_page(url, timeout=10)
        if selector_content:
            soup = BeautifulSoup(html, "html.parser")
            content_el = soup.select_one(selector_content)
            if content_el:
                # 清理无用标签
                for tag in content_el.select("script, style, iframe, .ad, .share, .comment"):
                    tag.decompose()
                return str(content_el)
        return html  # 返回全文
    except Exception as e:
        print(f"  [WARN] 获取正文失败: {url} - {e}", file=sys.stderr)
        return ""


def push_to_api(articles, config, api_url, dry_run=False):
    """将文章写入热点数据库 API"""
    if dry_run:
        print(f"\n[Dry Run] 共 {len(articles)} 篇文章:")
        for a in articles[:5]:
            print(f"  - {a['title'][:50]} | {a['url']}")
        if len(articles) > 5:
            print(f"  ... 还有 {len(articles) - 5} 篇")
        return

    headers = {
        "Content-Type": "application/json",
        "Cookie": f"auth_token={config.get('auth_token', '')}",
    }

    success = 0
    for i, article in enumerate(articles):
        # 生成唯一 ID（基于标题哈希）
        article_id = hashlib.md5(article["title"].encode()).hexdigest()[:16]

        payload = {
            "title": article["title"],
            "summary": article.get("summary", ""),
            "source": config["name"],
            "category": config.get("category", "综合"),
            "url": article.get("url", ""),
            "htmlContent": article.get("html_content", ""),
            "heat": max(0, 30 - i),  # 越靠前热度越高
        }

        try:
            resp = requests.post(api_url, json=payload, headers=headers, timeout=10)
            if resp.status_code == 401:
                print("[ERROR] API 认证失败，请提供有效的 auth_token", file=sys.stderr)
                print("  Tip: 在浏览器登录后，从 Application > Cookies > auth_token 复制", file=sys.stderr)
                return
            if resp.ok:
                success += 1
                print(f"  ✓ {article['title'][:40]}...")
            else:
                err = resp.json().get("error", {}).get("message", resp.text)
                print(f"  ✗ {article['title'][:30]}... {err}")
        except Exception as e:
            print(f"  ✗ {article['title'][:30]}... 网络错误: {e}")

        # 获取正文（只抓前 10 篇，避免耗时过长）
        if i < 10 and article.get("url") and config.get("selector_content"):
            print(f"  ⏳ 抓取正文...")
            html_content = fetch_article_content(article["url"], config.get("selector_content"))
            if html_content:
                payload["htmlContent"] = html_content
                try:
                    requests.post(api_url, json=payload, headers=headers, timeout=10)
                except:
                    pass

    print(f"\n完成：成功写入 {success}/{len(articles)} 篇")


def main():
    parser = argparse.ArgumentParser(description="热点爬虫 - 抓取并写入公文 AI 数据库")
    parser.add_argument("--name", required=True, help="来源名称")
    parser.add_argument("--url", required=True, help="列表页 URL")
    parser.add_argument("--category", default="综合", help="分类标签")
    parser.add_argument("--selector-title", default="", help="标题 CSS 选择器")
    parser.add_argument("--selector-summary", default="", help="摘要 CSS 选择器")
    parser.add_argument("--selector-link", default="a@href", help="链接 CSS 选择器")
    parser.add_argument("--selector-content", default="", help="正文 HTML CSS 选择器")
    parser.add_argument("--api-url", default="http://localhost:3000/api/hotspots", help="热点 API 地址")
    parser.add_argument("--auth-token", default="", help="API 认证 token")
    parser.add_argument("--dry-run", action="store_true", help="仅预览不写入")
    args = parser.parse_args()

    config = {
        "name": args.name,
        "url": args.url,
        "category": args.category,
        "selector_title": args.selector_title,
        "selector_summary": args.selector_summary,
        "selector_link": args.selector_link,
        "selector_content": args.selector_content,
        "auth_token": args.auth_token,
    }

    print(f"🌐 正在抓取: {args.name} ({args.url})")
    try:
        html = fetch_page(args.url)
    except Exception as e:
        print(f"[ERROR] 抓取失败: {e}", file=sys.stderr)
        sys.exit(1)

    articles = extract_articles(html, config)
    print(f"📄 解析到 {len(articles)} 篇文章")

    if len(articles) == 0:
        print("[WARN] 未解析到文章，可能需要调整选择器配置", file=sys.stderr)
        # 打印页面部分内容供调试
        soup = BeautifulSoup(html, "html.parser")
        print(f"  页面标题: {soup.title.string if soup.title else 'N/A'}")
        print(f"  页面大小: {len(html)} bytes")
        sys.exit(0)

    # 抓取正文（仅当配置了选择器）
    if args.selector_content:
        print("📰 正在抓取文章正文...")
        for i, article in enumerate(articles[:10]):
            if article.get("url"):
                html_content = fetch_article_content(article["url"], args.selector_content)
                article["html_content"] = html_content
                print(f"  {i+1}. {article['title'][:30]}... ({len(html_content)} bytes)")

    push_to_api(articles, config, args.api_url, dry_run=args.dry_run)

    if args.dry_run:
        print("\n💡 确认无误后，移除 --dry-run 重新执行即可写入数据库")


if __name__ == "__main__":
    main()
