#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
┌────────────────────────────────────────────────────────────┐
│  人民日报理论/评论版 → GongWen-OS 公文系统 自动化抓取工具   │
│                                                           │
│  爬取 → 解析 → 转换为 TipTap HTML → 写入数据库(Turso/SQLite) │
└────────────────────────────────────────────────────────────┘

用法:
  # 本地 SQLite（开发环境）
  python rmrb_to_gongwenos.py --start 20260701 --end 20260708 --mode local

  # Turso 远程（生产环境）
  python rmrb_to_gongwenos.py --start 20260701 --end 20260708 --mode turso

  # 仅生成 JSON 文件（不写库）
  python rmrb_to_gongwenos.py --start 20260701 --end 20260708 --mode json-only

依赖:
  pip install requests beautifulsoup4 lxml

作者: 基于 caspiakkexin 的人民日报爬虫改造
"""

import argparse
import datetime
import html
import json
import os
import secrets
import sqlite3
import sys
import time
import traceback
from typing import Any, Optional

import bs4
import requests

# ═══════════════════════════════════════════════════════════
# [配置区] 根据你的系统修改以下参数
# ═══════════════════════════════════════════════════════════

CONFIG = {
    # ── 数据库 ────────────────────────────────────
    # 本地 SQLite 文件路径（mode=local 时使用）
    "local_db_path": os.path.join(os.path.dirname(os.path.dirname(__file__)), "data.db"),

    # Turso 连接信息（mode=turso 时使用）
    "turso_url": os.environ.get("TURSO_URL", "libsql://your-db.turso.io"),
    "turso_token": os.environ.get("TURSO_TOKEN", ""),

    # ── 用户 ──────────────────────────────────────
    # 文档归属的 user_id（从 users 表中查）
    # 已有用户: uLPEO6kprm7b48x4e (fktest), u4upBUGRyz8ShCX2p (mindsoya)
    "user_id": os.environ.get("GW_USER_ID", "u4upBUGRyz8ShCX2p"),

    # ── 文档默认值 ──────────────────────────────
    "category": "新闻",       # 公文分类
    "format": "simple",       # simple | gb | official
    "doc_mode": "simple",     # DocMetaInfo 中的排版模式

    # ── 爬虫 ──────────────────────────────────────
    "request_delay": 1.0,     # 每篇文章间隔（秒）
    "page_delay": 3.0,        # 每天版面间隔（秒）
    "timeout": 15,            # 请求超时
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",

    # ── 输出 ──────────────────────────────────────
    "json_dir": os.path.join(os.path.dirname(__file__), "rmrb_output"),
}


# ═══════════════════════════════════════════════════════════
# [ID 生成] 匹配系统 nanoid 格式
# ═══════════════════════════════════════════════════════════

NANOID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-"


def nanoid(size: int = 16) -> str:
    """生成与系统一致的 nanoid 字符串"""
    return "".join(secrets.choice(NANOID_ALPHABET) for _ in range(size))


# ═══════════════════════════════════════════════════════════
# [HTML 转义]
# ═══════════════════════════════════════════════════════════

def esc(text: str) -> str:
    """HTML 转义"""
    return html.escape(str(text), quote=True)


# ═══════════════════════════════════════════════════════════
# [核心] 新闻正文 → TipTap HTML 转换
# ═══════════════════════════════════════════════════════════

def news_to_tiptap_html(title: str, paragraphs: list[str]) -> str:
    """
    将新闻正文转换为 GongWen-OS 编辑器可识别的 TipTap HTML。

    转换规则:
      - 标题 → <div data-type="doc-title" class="doc-title">
      - 短行（<30字且无句号）→ <h2> 子标题
      - 长段落 → <p> 段落
      - 空白行 → 跳过
      - 来源/记者行 → <p class="doc-source">
    """
    parts: list[str] = []
    parts.append(f'<div data-type="doc-title" class="doc-title">{esc(title)}</div>')

    for p in paragraphs:
        p = p.strip()
        if not p:
            continue

        # 来源行（"来源：XXX" 或 "本报记者 XXX"）
        if p.startswith("来源") or p.startswith("本报") or p.startswith("作者"):
            parts.append(f'<p class="doc-source">{esc(p)}</p>')
            continue

        # 子标题：字数少且不以句号/问号/叹号结尾
        if len(p) < 35 and not any(p.endswith(c) for c in "。？！；"):
            parts.append(f'<h2>{esc(p)}</h2>')
            continue

        # 普通段落
        parts.append(f'<p>{esc(p)}</p>')

    return "\n".join(parts)


def build_meta() -> str:
    """构建 DocMetaInfo JSON"""
    today = datetime.date.today().strftime("%Y-%m-%d")
    meta = {
        "docMode": CONFIG["doc_mode"],
        "submitUnit": "",
        "submitDate": today,
        "docNumber": "",
        "drawer": "",
        "level": "",
        "secrecy": "",
        "redHeader": "",
        "issuingAuthority": "",
        "recipient": "",
        "printDate": "",
    }
    return json.dumps(meta, ensure_ascii=False)


def build_document_json(
    title: str,
    content_html: str,
    meta_str: str,
) -> dict[str, Any]:
    """构建完整的文档 JSON（直接匹配 API/db 结构）"""
    return {
        "title": title,
        "category": CONFIG["category"],
        "format": CONFIG["format"],
        "content": content_html,
        "meta": meta_str,
    }


# ═══════════════════════════════════════════════════════════
# [爬虫] 人民日报理论/评论版
# ═══════════════════════════════════════════════════════════

def fetch_url(url: str) -> str:
    """通用请求函数"""
    headers = {
        "user-agent": CONFIG["user_agent"],
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    try:
        r = requests.get(url, headers=headers, timeout=CONFIG["timeout"])
        r.raise_for_status()
        r.encoding = r.apparent_encoding
        return r.text
    except Exception as e:
        print(f"  ❌ 请求失败 {url} : {e}")
        return ""


def get_page_list(year: str, month: str, day: str) -> list[tuple[str, str]]:
    """获取当天所有版面，过滤出理论版和评论版"""
    base_url = f"http://paper.people.com.cn/rmrb/pc/layout/{year}{month}/{day}/node_01.html"
    html = fetch_url(base_url)
    if not html:
        return []

    bs = bs4.BeautifulSoup(html, "html.parser")
    page_items: list = []

    if bs.find("div", id="pageList"):
        container = bs.find("div", id="pageList").ul
        if container:
            page_items = container.find_all("div", class_="right_title-name")
    elif bs.find("div", class_="swiper-container"):
        page_items = bs.find("div", class_="swiper-container").find_all("div", class_="swiper-slide")

    results: list[tuple[str, str]] = []
    for item in page_items:
        a = item.a
        if not a:
            continue
        p_name = a.get_text(strip=True)
        href = a["href"]
        full_link = f"http://paper.people.com.cn/rmrb/pc/layout/{year}{month}/{day}/{href}"
        print(f"  📰 识别版面：{p_name}")

        if "理论" in p_name or "评论" in p_name:
            results.append((p_name, full_link))
            print(f"  ✅ 选中目标版面：{p_name}")

    return results


def get_article_urls(year: str, month: str, day: str, page_url: str) -> list[str]:
    """获取版面下的文章链接"""
    html = fetch_url(page_url)
    if not html:
        return []

    bs = bs4.BeautifulSoup(html, "html.parser")
    link_list: list = []
    if bs.find("div", id="titleList"):
        container = bs.find("div", id="titleList").ul
        if container:
            link_list = container.find_all("li")

    urls: list[str] = []
    for li in link_list:
        for a in li.find_all("a"):
            link = a.get("href", "")
            if "content" in link and link not in urls:
                art_url = f"http://paper.people.com.cn/rmrb/pc/content/{year}{month}/{day}/{link}"
                urls.append(art_url)

    return urls


def parse_article(html_text: str) -> Optional[dict[str, Any]]:
    """解析文章内容"""
    if not html_text:
        return None

    bs = bs4.BeautifulSoup(html_text, "html.parser")

    # 提取标题
    title_parts: list[str] = []
    for tag in [bs.h3, bs.h1, bs.h2]:
        if tag:
            title_parts.append(tag.get_text(strip=True))
    title = " ".join(title_parts)

    # 提取正文段落
    content_box = bs.find("div", id="ozoom")
    if not content_box:
        content_box = bs.find("div", class_="article-content")
    if not content_box:
        content_box = bs.find("div", class_="content")

    paragraphs: list[str] = []
    if content_box:
        for p in content_box.find_all("p"):
            text = p.get_text(strip=True)
            if text and len(text) > 2:
                paragraphs.append(text)

    if not title and not paragraphs:
        return None

    return {
        "title": title,
        "paragraphs": paragraphs,
        "html_raw": html_text,
    }


def crawl_single_day(
    year: str,
    month: str,
    day: str,
) -> list[dict[str, Any]]:
    """
    爬取指定日期的理论/评论版文章，返回文档列表。
    每个文档已转换为 TipTap HTML 格式。
    """
    date_str = f"{year}{month}{day}"
    print(f"\n{'=' * 55}")
    print(f"  开始爬取 {date_str}")
    print(f"{'=' * 55}")

    page_info = get_page_list(year, month, day)
    if not page_info:
        print(f"  ⚠️  未匹配到理论/评论版面")
        return []

    documents: list[dict[str, Any]] = []

    for page_name, page_link in page_info:
        urls = get_article_urls(year, month, day, page_link)
        if not urls:
            print(f"  📭 版面 {page_name} 无文章链接")
            continue

        print(f"  📑 版面 {page_name} → {len(urls)} 篇文章")

        for art_url in urls:
            html_text = fetch_url(art_url)
            art_data = parse_article(html_text)
            if not art_data:
                continue

            # ── 转换为 TipTap HTML ──
            content_html = news_to_tiptap_html(art_data["title"], art_data["paragraphs"])
            meta_str = build_meta()
            doc_json = build_document_json(art_data["title"], content_html, meta_str)

            # 附加原始爬取信息（不会写入数据库）
            doc_json["_crawl_info"] = {
                "page": page_name,
                "source_url": art_url,
                "crawl_date": datetime.datetime.now().isoformat(),
            }

            documents.append(doc_json)

            preview = art_data["title"][:40]
            print(f"  📝 已转换：{preview}")

            time.sleep(CONFIG["request_delay"])

    print(f"  ✅ {date_str} 共转换 {len(documents)} 篇新闻")
    return documents


# ═══════════════════════════════════════════════════════════
# [保存] JSON 文件输出
# ═══════════════════════════════════════════════════════════

def save_to_json(
    documents: list[dict[str, Any]],
    date_str: str,
    save_dir: str,
) -> str:
    """保存当天文章为 JSON 文件"""
    os.makedirs(save_dir, exist_ok=True)
    file_path = os.path.join(save_dir, f"{date_str}.json")

    # 写库时去掉 _crawl_info（太冗余），但保留在 JSON 输出中作为参考
    output_data = {
        "date": date_str,
        "total": len(documents),
        "articles": documents,
    }

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"  💾 已保存 JSON：{file_path}")
    return file_path


# ═══════════════════════════════════════════════════════════
# [写入] 本地 SQLite（直接操作 data.db）
# ═══════════════════════════════════════════════════════════

def insert_into_local_sqlite(
    documents: list[dict[str, Any]],
    db_path: str,
) -> int:
    """插入文档到本地 SQLite 数据库"""
    if not os.path.isfile(db_path):
        print(f"  ❌ 数据库文件不存在：{db_path}")
        return 0

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    now_ts = int(time.time())
    inserted = 0

    for doc in documents:
        doc_id = f"doc{nanoid(16)}"
        ver_id = f"ver{nanoid(16)}"

        title = doc["title"]
        content = doc["content"]
        meta_str = doc["meta"]
        category = doc["category"]
        fmt = doc["format"]
        uid = CONFIG["user_id"]

        try:
            # 插入 documents 表
            cursor.execute(
                """INSERT INTO documents
                   (id, title, category, format, content, meta,
                    user_id, reviewed, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (doc_id, title, category, fmt, content, meta_str,
                 uid, 0, now_ts, now_ts),
            )

            # 插入 versions 表（初始版本 v0）
            version_data = json.dumps({
                "title": title,
                "category": category,
                "content": content,
                "format": fmt,
                "meta": meta_str,
            }, ensure_ascii=False)
            cursor.execute(
                """INSERT INTO versions
                   (id, document_id, content, data, type, version_number, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (ver_id, doc_id, content, version_data, "初始", 0, now_ts),
            )

            inserted += 1
            print(f"  ✅ 入库：{title[:30]}")

        except sqlite3.IntegrityError as e:
            print(f"  ⚠️  写入失败（{title[:30]}）：{e}")
            conn.rollback()
            continue

    conn.commit()
    conn.close()
    return inserted


# ═══════════════════════════════════════════════════════════
# [写入] Turso 远程（通过 Turso REST API）
# ═══════════════════════════════════════════════════════════

def _turso_request(sql: str, args: list) -> dict:
    """发送单条 SQL 到 Turso REST API"""
    url = CONFIG["turso_url"].rstrip("/")
    if not url.endswith("/v2/pipeline"):
        # 如果用户给的是 libsql:// 地址，提示需要 REST 端点
        url = url.replace("libsql://", "https://")
        url = f"{url}/v2/pipeline"

    headers = {
        "Authorization": f"Bearer {CONFIG['turso_token']}",
        "Content-Type": "application/json",
    }
    payload = {
        "requests": [
            {
                "type": "execute",
                "stmt": {"sql": sql, "args": [{"type": "text", "value": str(a)} for a in args]},
            }
        ]
    }

    resp = requests.post(url, json=payload, headers=headers, timeout=15)
    if resp.status_code != 200:
        raise RuntimeError(f"Turso API 返回 {resp.status_code}: {resp.text}")
    return resp.json()


def insert_into_turso(documents: list[dict[str, Any]]) -> int:
    """插入文档到 Turso 远程数据库"""
    if not CONFIG["turso_token"]:
        print("  ❌ 未设置 TURSO_TOKEN 环境变量")
        return 0

    now_ts = int(time.time())
    inserted = 0

    for doc in documents:
        doc_id = f"doc{nanoid(16)}"
        ver_id = f"ver{nanoid(16)}"

        title = doc["title"]
        content = doc["content"]
        meta_str = doc["meta"]
        category = doc["category"]
        fmt = doc["format"]
        uid = CONFIG["user_id"]
        version_data = json.dumps({
            "title": title,
            "category": category,
            "content": content,
            "format": fmt,
            "meta": meta_str,
        }, ensure_ascii=False)

        try:
            # 在一条 pipeline 中执行两条 SQL（原子操作）
            payload = {
                "requests": [
                    {
                        "type": "execute",
                        "stmt": {
                            "sql": """INSERT INTO documents
                                      (id, title, category, format, content, meta,
                                       user_id, reviewed, created_at, updated_at)
                                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                            "args": [
                                {"type": "text", "value": doc_id},
                                {"type": "text", "value": title},
                                {"type": "text", "value": category},
                                {"type": "text", "value": fmt},
                                {"type": "text", "value": content},
                                {"type": "text", "value": meta_str},
                                {"type": "text", "value": uid},
                                {"type": "integer", "value": "0"},
                                {"type": "integer", "value": str(now_ts)},
                                {"type": "integer", "value": str(now_ts)},
                            ],
                        },
                    },
                    {
                        "type": "execute",
                        "stmt": {
                            "sql": """INSERT INTO versions
                                      (id, document_id, content, data, type, version_number, created_at)
                                      VALUES (?, ?, ?, ?, ?, ?, ?)""",
                            "args": [
                                {"type": "text", "value": ver_id},
                                {"type": "text", "value": doc_id},
                                {"type": "text", "value": content},
                                {"type": "text", "value": version_data},
                                {"type": "text", "value": "初始"},
                                {"type": "integer", "value": "0"},
                                {"type": "integer", "value": str(now_ts)},
                            ],
                        },
                    },
                ]
            }

            url = CONFIG["turso_url"].rstrip("/")
            if not url.endswith("/v2/pipeline"):
                url = url.replace("libsql://", "https://") + "/v2/pipeline"

            headers = {
                "Authorization": f"Bearer {CONFIG['turso_token']}",
                "Content-Type": "application/json",
            }
            resp = requests.post(url, json=payload, headers=headers, timeout=15)
            if resp.status_code != 200:
                print(f"  ⚠️  Turso 写入失败（{title[:30]}）：{resp.status_code} {resp.text[:200]}")
                continue

            inserted += 1
            print(f"  ✅ 入库 Turso：{title[:30]}")

        except Exception as e:
            print(f"  ⚠️  写入异常（{title[:30]}）：{e}")
            continue

    return inserted


# ═══════════════════════════════════════════════════════════
# [工具] 日期列表生成
# ═══════════════════════════════════════════════════════════

def get_date_list(start_date: str, end_date: str) -> list[datetime.datetime]:
    """生成日期范围列表"""
    start = datetime.datetime.strptime(start_date, "%Y%m%d")
    end = datetime.datetime.strptime(end_date, "%Y%m%d")
    dates: list[datetime.datetime] = []
    current = start
    while current <= end:
        dates.append(current)
        current += datetime.timedelta(days=1)
    return dates


# ═══════════════════════════════════════════════════════════
# [主流程]
# ═══════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="人民日报理论/评论版 → GongWen-OS 公文系统 自动抓取工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 本地 SQLite（开发环境）
  python rmrb_to_gongwenos.py --start 20260701 --end 20260708 --mode local

  # Turso 远程（生产环境）
  TURSO_TOKEN=xxx python rmrb_to_gongwenos.py --start 20260701 --end 20260708 --mode turso

  # 仅生成 JSON 文件
  python rmrb_to_gongwenos.py --start 20260701 --end 20260708 --mode json-only
        """,
    )
    parser.add_argument("--start", required=True, help="起始日期 YYYYMMDD")
    parser.add_argument("--end", required=True, help="结束日期 YYYYMMDD")
    parser.add_argument(
        "--mode",
        choices=["local", "turso", "json-only"],
        default="json-only",
        help="写入模式: local=本地SQLite, turso=Turso远程, json-only=仅生成JSON文件",
    )
    parser.add_argument("--user-id", help="文档归属的 user_id（覆盖 CONFIG）")
    parser.add_argument("--delay", type=float, help="文章请求间隔秒数（覆盖 CONFIG）")
    parser.add_argument("--json-dir", help="JSON 输出目录（覆盖 CONFIG）")
    args = parser.parse_args()

    # 参数覆盖
    if args.user_id:
        CONFIG["user_id"] = args.user_id
    if args.delay:
        CONFIG["request_delay"] = args.delay
    if args.json_dir:
        CONFIG["json_dir"] = args.json_dir

    # ── 验证 ──
    date_arr = get_date_list(args.start, args.end)
    print(f"\n🚀 人民日报 → GongWen-OS 自动抓取工具")
    print(f"   日期范围: {args.start} ~ {args.end} ({len(date_arr)} 天)")
    print(f"   写入模式: {args.mode}")
    print(f"   user_id:  {CONFIG['user_id']}")
    print(f"   分类:     {CONFIG['category']}")
    print(f"   格式:     {CONFIG['format']}")
    print()

    total_docs = 0
    total_inserted = 0

    for dt in date_arr:
        y = str(dt.year)
        m = f"{dt.month:02d}"
        d = f"{dt.day:02d}"
        date_str = f"{y}{m}{d}"

        # ── 爬取 ──
        documents = crawl_single_day(y, m, d)
        if not documents:
            # 仍然生成一个空 JSON 以标记该日期已处理
            save_to_json([], date_str, CONFIG["json_dir"])
            time.sleep(CONFIG["page_delay"])
            continue

        total_docs += len(documents)

        # ── 保存 JSON ──
        save_to_json(documents, date_str, CONFIG["json_dir"])

        # ── 写入数据库 ──
        if args.mode == "local":
            inserted = insert_into_local_sqlite(documents, CONFIG["local_db_path"])
            total_inserted += inserted
        elif args.mode == "turso":
            inserted = insert_into_turso(documents)
            total_inserted += inserted
        else:
            inserted = 0

        time.sleep(CONFIG["page_delay"])

    # ── 汇总 ──
    print(f"\n{'=' * 55}")
    print(f"  ✅ 全部完成！")
    print(f"     爬取天数:  {len(date_arr)}")
    print(f"     转换文档:  {total_docs}")
    if args.mode != "json-only":
        print(f"     入库数量:  {total_inserted}")
    print(f"     JSON目录:  {os.path.abspath(CONFIG['json_dir'])}")
    print(f"{'=' * 55}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ 异常: {e}")
        traceback.print_exc()
        sys.exit(1)
