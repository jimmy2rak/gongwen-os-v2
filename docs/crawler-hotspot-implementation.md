# 爬虫热点推送系统 · 完整实现文档

> 超管专属热点爬虫数据源配置 + 一键生成可运行 Python 爬虫脚本 + 自动入库后端数据库 + 前端页面展示编辑预览。
>
> 项目路径：`/Users/jimmywang/多媒体/开发者/oa1/gongwen-os-v2/`

---

## 一、数据库建表（兼容 SQLite / MySQL）

### 1.1 Drizzle Schema（项目已集成）

**文件**：`src/server/db/schema/crawler.ts`

| 表 | 说明 | 标识 |
|---|---|---|
| `sys_super_admin` | 超级管理员白名单 | 无前端 CRUD，仅手动写 SQL |
| `sys_secret_config` | 爬虫入库 API 密钥 | AES-256-GCM 加密，前端绝不展示 |
| `crawler_source` | 爬虫数据源配置 | 超管前端增删改查 |
| `hot_article` | 爬虫抓取入库文章 | 公文前端调取渲染 |

### 1.2 Drizzle 导出（编辑 `src/server/db/schema/index.ts`）

```ts
export {
  sysSuperAdmin,
  sysSecretConfig,
  crawlerSource,
  hotArticle,
} from "./crawler";
```

### 1.3 原始 SQL（双语法）

**文件**：`scripts/002_crawler_system.sql`

包含 SQLite / MySQL 两套完整建表 DDL，以及示范 INSERT 语句。

**关键表结构：**

```sql
-- SQLite 语法（演示）
CREATE TABLE IF NOT EXISTS sys_super_admin (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT NOT NULL UNIQUE,
  create_time  INTEGER NOT NULL,
  remark       TEXT
);
CREATE TABLE IF NOT EXISTS crawler_source (
  id              TEXT PRIMARY KEY,
  source_name     TEXT NOT NULL,
  base_url        TEXT NOT NULL,
  target_column_id TEXT,
  category_tag    TEXT NOT NULL DEFAULT '综合',
  enable          INTEGER NOT NULL DEFAULT 1,
  create_by       TEXT,
  create_time     INTEGER NOT NULL,
  update_time     INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS hot_article (
  id           TEXT PRIMARY KEY,
  source_id    TEXT, source_name TEXT, column_id TEXT,
  title        TEXT NOT NULL,
  content_plain TEXT, content_html TEXT,
  page_name    TEXT, origin_url TEXT, crawl_date TEXT,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at   INTEGER NOT NULL
);
```

### 1.4 初始化示范插入

```sql
-- 在项目的 users 表找到你的 user_id，替换下面的占位符
INSERT INTO sys_super_admin (user_id, create_time, remark)
VALUES ('uYOUR_ADMIN_ID', strftime('%s','now'), '项目负责人');

-- 人民日报数据源示例
INSERT INTO crawler_source (id, source_name, base_url, target_column_id, category_tag, enable, create_by, create_time, update_time)
VALUES ('cs' || substr(lower(hex(randomblob(16))),1,16),
        '人民日报',
        'http://paper.people.com.cn/rmrb/pc/layout',
        '新闻', '时政', 1,
        'uYOUR_ADMIN_ID',
        strftime('%s','now'), strftime('%s','now'));
```

---

## 二、后端 API 接口

共 5 个接口（3 个为核心管理接口 + 2 个支持性接口）。

### 2.1 `GET /api/admin/crawler/list` — 超管获取数据源列表

- **鉴权**：`getServerUser()` + `isSuperAdmin()`
- **路径**：`src/app/api/admin/crawler/list/route.ts`
- 返回所有 `crawler_source` 行，普通用户返回 403

```ts
export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return new Response("未登录", { status: 401 });
  if (!(await isSuperAdmin(user.id))) return new Response("无权限", { status: 403 });
  const rows = await client.execute("SELECT * FROM crawler_source ORDER BY create_time DESC");
  return NextResponse.json({ success: true, data: rows.rows });
}
```

### 2.2 `POST|PUT|DELETE /api/admin/crawler/sources` — 数据源 CRUD

- **路径**：`src/app/api/admin/crawler/sources/route.ts`
- 超管鉴权，支持创建(CS)、编辑(UPDATE)、删除(DELETE)
- `create_by` 由后端自动设为当前超管 user_id

### 2.3 `POST /api/admin/crawler/generate-script` — 生成一键爬虫脚本

- **入参**：`{ sourceId }`
- **鉴权**：超管校验
- **逻辑**：查询 `crawler_source` → 解密 `sys_secret_config` 密钥 → 从请求源推导后端入库地址 → 注入 Python 母版
- **路径**：`src/app/api/admin/crawler/generate-script/route.ts`

```ts
// 核心注入逻辑（已脱敏）
const apiKey = await getCrawlerUploadKey();          // 从加密库解密或环境变量读取
const backendUrl = new URL("/api/public/crawler/upload", req.nextUrl.origin).toString();
const code = renderCrawlerScript({
  apiKey, backendUrl, sourceId: row.id,
  columnId: row.target_column_id || "", baseUrl: row.base_url,
  siteName: row.source_name, defaultCategory: row.category_tag || "综合",
});
return new NextResponse(code, {
  headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
});
```

### 2.4 `POST /api/public/crawler/upload` — 爬虫入库开放接口

- **请求头必须**：`X-Crawler-Auth: <有效密钥>`
- **不需要登录**，仅凭密钥鉴权（适合无头脚本调用）
- **查重**：按 `origin_url` 避免重复入库
- **路径**：`src/app/api/public/crawler/upload/route.ts`

```ts
export async function POST(req: NextRequest) {
  const incoming = req.headers.get("X-Crawler-Auth");
  const valid = await getCrawlerUploadKey();
  if (!valid || !incoming || incoming !== valid) return 401;
  // 按 originUrl 查重、清洗数据、插入 hot_article
}
```

### 2.5 `GET /api/hot-articles` — 前端展示列表（支持性接口）

- 任何已登录用户可访问
- 过滤参数：`columnId`, `sourceId`, `crawlDate`, `q`, `all`
- **路径**：`src/app/api/hot-articles/route.ts`

---

## 三、前端爬虫配置页面（Settings 超管专属）

**组件**：`src/components/settings/CrawlerAdminPanel.tsx`
**菜单挂载**：`src/app/(dashboard)/settings/page.tsx`

### 3.1 超管探测机制

```tsx
// settings/page.tsx
const [isSuper, setIsSuper] = useState(false);
useEffect(() => {
  fetch("/api/admin/crawler/list")
    .then((r) => setIsSuper(r.ok))
    .catch(() => setIsSuper(false));
}, []);
```

菜单项增加 `requiredSuper: true`，非超管完全看不到入口：

```tsx
{isSuper && (
  <button onClick={() => setActive("crawler")}>
    <Terminal className="w-4 h-4" />
    <span>爬虫热点推送配置</span>
  </button>
)}
```

### 3.2 面板三大区域

| 区域 | 说明 |
|---|---|
| **新增表单** | 数据源名称、抓取根 URL、公文栏目下拉（getAllCategories）、分类标签、启用开关 |
| **数据源列表** | 卡片式列表，每行含编辑/删除/生成脚本按钮 |
| **生成脚本弹窗** | 全屏/大弹窗，展示完整 Python 代码，带「复制全部代码」和「下载 .py 文件」 |

### 3.3 API 调用路径

| 操作 | 接口 | 方法 | 返回类型 |
|---|---|---|---|
| 拉取列表 | `/api/admin/crawler/list` | GET | JSON |
| 新增数据源 | `/api/admin/crawler/sources` | POST | JSON |
| 编辑数据源 | `/api/admin/crawler/sources` | PUT | JSON |
| 删除数据源 | `/api/admin/crawler/sources` | DELETE | JSON |
| 生成爬虫脚本 | `/api/admin/crawler/generate-script` | POST | **纯文本** (text/plain) |

---

## 四、Python 爬虫母版模板

**文件**：`src/lib/crawler-template.ts`

### 4.1 模板占位符

后端 `renderCrawlerScript()` 替换以下变量：

| 占位符 | 值来源 | 说明 |
|---|---|---|
| `{{API_KEY}}` | 解密后的 `sys_secret_config` | 爬虫鉴权，绝不外泄 |
| `{{UPLOAD_BACKEND_URL}}` | `req.nextUrl.origin + /api/public/crawler/upload` | 后端按请求源推导 |
| `{{BIND_SOURCE_ID}}` | `crawler_source.id` | 绑定数据源 |
| `{{BIND_COLUMN_ID}}` | `crawler_source.target_column_id` | 绑定公文栏目 |
| `{{BASE_URL}}` | `crawler_source.base_url` | 抓取根地址 |
| `{{SITE_NAME}}` | `crawler_source.source_name` | 站点显示名 |
| `{{DEFAULT_CATEGORY}}` | `crawler_source.category_tag` | 默认分类 |

### 4.2 模板核心逻辑（基于已验证的 crawl_rmrb.py）

```python
# ① 动态站点配置
LAYOUT_URL = BASE_URL.rstrip("/") + "/{YYYY}{MM}/{DD}/node_01.html"
SECTION_KEYWORDS = ["理论", "评论"]    # 仅抓取理论版/评论版

# ② 版面识别（与 crawl_rmrb.py 验证通过的选择器完全一致）
PAGE_ITEMS_SEL = "#pageList .right_title-name"
PAGE_TITLE_SEL = "a"
ARTICLE_LIST_SEL = "#titleList ul li"
ARTICLE_LINK_CONTAINS = "content"
CONTENT_SEL = "#ozoom"

# ③ 解析 → TipTap HTML
def parse_article(html):
    # 双结构兼容：多选择器尝试标题，移除广告/脚本噪声
    content_html = "".join(f"<p>{p}</p>" for p in paragraphs)  # TipTap 兼容格式
    content_plain = "\n".join(paragraphs)                       # 纯文本预览

# ④ 逐条上传携带 X-Crawler-Auth
def upload(article, source_url, section, crawl_date):
    payload = {
        "sourceId": BIND_SOURCE_ID, "columnId": BIND_COLUMN_ID,
        "title": article["title"], "contentPlain": article["content_plain"],
        "contentHtml": article["content_html"], "pageName": section,
        "originUrl": source_url, "crawlDate": crawl_date,
    }
    headers = {"Content-Type": "application/json", "X-Crawler-Auth": API_KEY}
    r = requests.post(UPLOAD_BACKEND_URL, json=payload, headers=headers, timeout=20)
```

### 4.3 运行方式

```bash
# 默认抓取当日理论版/评论版，自动推送入库
python3 crawler_task_csXXXX.py

# 也可指定日期、dry-run
python3 crawler_task_csXXXX.py --start 20260701 --end 20260708 --dry-run
```

---

## 五、前端热点文章展示页（Tiptap 适配）

**页面**：`src/app/(dashboard)/hotspots/page.tsx`（已重写，读取 `hot_article` 表）

### 5.1 功能对照表

| 功能 | 实现方式 |
|---|---|
| **栏目/来源筛选** | 下拉选择，调用 `/api/hot-articles?columnId=xxx` |
| **全屏 iframe 预览** | 全屏黑色背景 overlay + `<iframe srcDoc={...} />`（非弹窗模式） |
| **导出** | 复用 `ExportMenu` 组件 |
| **编辑为文档** | 调用 `POST /api/documents` 创建新文档，内容格式为 `<div data-type="doc-title">标题</div>正文HTML`，直接跳转编辑器 |
| **收藏转文档** | 弹窗选择公文类型 → 创建文档 → `toggleFavorite()` 同步到文档管理 |

### 5.2 编辑/收藏核心代码

```tsx
// 创建文档 body 格式（与 TipTap 完全兼容）
const bodyHtml = item.contentHtml || `<p>${(item.contentPlain || "").replace(/\n/g, "<br>")}</p>`;
const content = `<div data-type="doc-title">${item.title}</div>${bodyHtml}`;

// POST /api/documents 创建
const res = await fetch("/api/documents", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: item.title, category, content, format: "simple" }),
});
```

### 5.3 全屏 iframe 预览

```tsx
{preview && (
  <div className="fixed inset-0 z-[80] bg-black flex flex-col">
    <div className="flex items-center justify-between px-5 py-3 bg-white border-b">
      <h2 className="text-sm font-medium truncate">{preview.title}</h2>
      <button onClick={() => handleEditAsDoc(preview)}>创建为文档</button>
      <button onClick={() => setPreview(null)}>关闭</button>
    </div>
    <iframe title={preview.title} srcDoc={previewSrcDoc} className="flex-1 w-full bg-white" />
  </div>
)}
```

---

## 六、部署与权限初始化操作说明

### 6.1 前置条件

- Node.js 20+ / Python 3.9+（运行爬虫的机器）
- 你的公文系统项目已正常运行（`npm run dev`）
- `.env` 文件已配置 `JWT_SECRET`（已有）和可选的 `CRAWLER_MASTER_KEY`（不设则用 JWT_SECRET 派生）

### 6.2 建表

```bash
cd /你的项目路径

# 方式 A：直接运行原始 SQL（推荐，避免 drizzle-kit 交互干扰）
sqlite3 data.db < scripts/002_crawler_system.sql  # 仅 SQLite 段

# 方式 B：如果 drizzle-kit push 可用
npx drizzle-kit push   # 注意：该命令可能包含交互式确认，请按提示继续
```

验证表已创建：
```bash
sqlite3 data.db ".tables | grep -E 'sys_|crawler|hot_article'"
```

### 6.3 添加超级管理员

从 `users` 表查出你的 user_id：

```bash
sqlite3 data.db "SELECT id, email, name FROM users;"
```

将你的 user_id 插入白名单：

```bash
sqlite3 data.db "INSERT INTO sys_super_admin (user_id, create_time, remark)
  VALUES ('你的user_id见上', strftime('%s','now'), '项目负责人');"
```

> ⚠️ **安全铁则**：`sys_super_admin` 表无任何前端增删改入口。添加/移除超管只能手动操作数据库。

### 6.4 设置爬虫入库密钥

#### 方式 A：运行引导脚本（推荐）

```bash
# 先通过 SQL 插入一个有效的爬虫 API KEY（建议 32 字节强随机串）
# 然后运行种子脚本。脚本会自动加密密钥并写入 sys_secret_config。
# 同时可设置 SUPER_ADMIN_USER_ID 自动加入白名单。

SUPER_ADMIN_USER_ID="你的user_id" \
CRAWLER_API_KEY="你的强随机32字节密钥" \
  node scripts/seed-crawler-secret.mjs
```

如果不提供 `CRAWLER_API_KEY`，脚本会自动生成一个随机密钥并打印。请**立即抄录**此密钥（仅此一次展示）。

#### 方式 B：环境变量兜底（仅用于快速测试）

在 `.env` 中添加：
```env
CRAWLER_API_KEY=你的明文密钥
```

> 方式 B 在数据库中无加密记录，生产环境应当用方式 A。

### 6.5 重启服务器并验证

```bash
npm run dev
```

1. 访问 **系统设置** → **爬虫热点推送配置**（仅超管可见菜单）
2. 点击 **新增数据源**，填入：名称=人民日报、根URL=`http://paper.people.com.cn/rmrb/pc/layout`、绑定栏目=新闻、标签=时政
3. 点击新条目上的 **生成脚本** → 在弹窗中点击 **下载 .py 文件**
4. 在本地安装 Python 依赖并运行爬虫：

```bash
pip install requests beautifulsoup4
python3 crawler_task_csxxx.py
```

5. 爬取完成后，访问左侧 **热点文章** 菜单，应该看到新入库的文章
6. 点击小眼睛 → 全屏 iframe 预览；点击编辑/收藏 → 自动创建公文文档

### 6.6 安全核查清单

| 检查项 | 状态 |
|---|---|
| `sys_super_admin` 无任何前端 CRUD 入口 | ✅ |
| 爬虫密钥入库请求头 `X-Crawler-Auth` 校验 | ✅ |
| 密钥在数据库加密存储（AES-256-GCM） | ✅ |
| 后端生成脚本时推导入库地址（非前端传入） | ✅ |
| 生成脚本接口仅超管可调用 | ✅ |
| 爬虫配置菜单仅超管可见 | ✅ |
| 普通用户访问配置接口返回 403（非 401） | ✅ |

### 6.7 文件索引

```
src/server/db/schema/crawler.ts              ← Drizzle 四张表定义
scripts/002_crawler_system.sql               ← 双语法 SQL 建表 + 示范插入
scripts/seed-crawler-secret.mjs              ← 密钥加密写入引导脚本
src/server/auth/super-admin.ts               ← isSuperAdmin() / getSuperAdminUser()
src/server/auth/secret.ts                    ← encryptSecret() / decryptSecret() / getCrawlerUploadKey()
src/lib/crawler-template.ts                  ← Python 爬虫母版 + renderCrawlerScript()
src/app/api/admin/crawler/list/route.ts      ← GET 数据源列表
src/app/api/admin/crawler/sources/route.ts   ← POST/PUT/DELETE 数据源 CRUD
src/app/api/admin/crawler/generate-script/route.ts ← POST 生成爬虫脚本
src/app/api/public/crawler/upload/route.ts   ← POST 开放入库（X-Crawler-Auth）
src/app/api/hot-articles/route.ts            ← GET 前端展示列表
src/components/settings/CrawlerAdminPanel.tsx ← 超管配置面板
src/app/(dashboard)/settings/page.tsx        ← 设置页（门控菜单）
src/app/(dashboard)/hotspots/page.tsx        ← 热点文章展示页（ifream预览/编辑/收藏）
```

---

> 本系统与旧版 `hotspots` / `hotspot-sources` 表及 API 完全独立，新旧可共存。如需清理遗留原型，可安全删除 `src/app/api/hotspots/`、`src/app/api/hotspot-sources/`、`src/server/db/schema/hotspots.ts`、`src/server/db/schema/hotspot-sources.ts`、`src/components/settings/HotspotSettingsPanel.tsx` 以及 `crawl_hotspot.py`、`src/lib/crawler-generator.ts`。

---

## 七、生产环境注意事项（Vercel + Turso）

### 7.1 中间件放行

`POST /api/public/crawler/upload` 使用 `X-Crawler-Auth` 头鉴权（无 JWT Cookie），必须在 `src/middleware.ts` 的 `PUBLIC_PATHS` 数组中追加 `/api/public`，否则会被中间件拦截跳转到登录页。

### 7.2 Turso 数据库建表

在本地开发时已通过 `sqlite3 data.db < scripts/002_crawler_system.sql` 建好了爬虫表。生产环境使用 Turso 后，需针对 Turso 重新建表：

```bash
# 临时指向 Turso 运行 drizzle-kit push（会创建全部 schema 表）
DATABASE_URL="libsql://your-db-xxxx.turso.io" \
DATABASE_AUTH_TOKEN="your-token" \
  npx drizzle-kit push
```

如果 `drizzle-kit push` 有交互式确认干扰，也可直接跑原始 SQL：

```bash
# 通过 Turso CLI 进入 SQL shell 逐条执行
turso db shell gongwen-os-v2 < scripts/002_crawler_system.sql
```

### 7.3 种子脚本需在生产环境重复运行

```bash
# 需在 Vercel 本地开发/CI 环境或通过 Turso shell 执行
DATABASE_URL="libsql://your-db-xxxx.turso.io" \
DATABASE_AUTH_TOKEN="your-token" \
CRAWLER_API_KEY="your-key" \
SUPER_ADMIN_USER_ID="your-user-id" \
  node scripts/seed-crawler-secret.mjs
```

### 7.4 生成爬虫脚本时的入库地址

在本地开发时，后端生成脚本会使用 `req.nextUrl.origin`（如 `http://localhost:3000`）推导入库地址。
**Vercel 生产环境生成脚本时，入库地址会自动变成 `https://182183.xyz/api/public/crawler/upload`**，无需手动配置。

### 7.5 环境变量清单

| 变量 | 生产环境值 | 说明 |
|---|---|---|
| `DATABASE_URL` | `libsql://your-db-xxxx.turso.io` | Turso 数据库地址 |
| `DATABASE_AUTH_TOKEN` | 从 Turso CLI 生成 | Turso 鉴权 Token |
| `JWT_SECRET` | `openssl rand -hex 32` | JWT 签名密钥 |
| `NEXTAUTH_URL` | `https://182183.xyz` | 部署域名 |
| `AI_KEY_SECRET` | `openssl rand -base64 32` | AI 密钥加密 |
| `CRAWLER_MASTER_KEY` | `openssl rand -hex 32`（可选） | 爬虫密钥加密 |
| `CRAWLER_API_KEY` | 32 字节随机串（可选，仅引导用） | 爬虫入库明文密钥 |

