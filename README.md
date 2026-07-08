# 公文 AI 写作系统 · GongWen-OS v2

> 一个面向党政机关公文写作的 AI 辅助系统，严格遵循 **GB/T 9704-2012** 公文格式标准。
> 集成 TipTap 编辑器、AI 对话、爬虫热点、知识库、文档管理等模块。

---

## 技术栈

| 层 | 技术选型 |
|---|---|
| 框架 | [Next.js 16](https://nextjs.org) (App Router) + TypeScript |
| 编辑器 | [TipTap](https://tiptap.dev) (ProseMirror) — 自定义 DocTitle / 印章等 5 个扩展 |
| 数据库 | [Drizzle ORM](https://orm.drizzle.team) + [libSQL/Turso](https://turso.tech)（本地 SQLite / 生产 Turso） |
| 认证 | JWT (jose) — HTTP-only Cookie，非 NextAuth |
| AI | 流式 SSE / OpenAI 兼容接口 |
| UI | Tailwind CSS v4 + [Lucide Icons](https://lucide.dev) |
| 爬虫 | Python（requests + BeautifulSoup）— 自动生成可运行脚本 |
| 部署 | Vercel Serverless + Cloudflare DNS + Turso DB |

---

## 快速开始

### 环境要求

- **Node.js** 20+
- **npm** （项目使用 npm 包管理）
- **Python 3.9+**（可选，仅运行爬虫时需要）

### 1. 克隆并安装

```bash
git clone <你的仓库URL>
cd gongwen-os-v2
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

默认 `.env.example` 已包含本地开发用的 SQLite 配置，直接可用。
生产环境需切换到 Turso 数据库（详见 [部署指南](#deploy)）。

### 3. 初始化数据库

> 项目使用 Drizzle ORM + SQLite（本地）。首次运行会自动建普通表。
> 爬虫系统所需的新表需手动建：

```bash
# 创建爬虫系统 4 张表（sqlite3 需已安装）
sqlite3 data.db < scripts/002_crawler_system.sql
```

或者使用 drizzle-kit 全量同步：
```bash
npx drizzle-kit push
```

### 4. 启动开发服务器

```bash
npm run dev
```

打开 http://localhost:3000

### 5. 注册账号并添加超级管理员

1. 访问 http://localhost:3000/register 注册一个账号
2. 查询你的 user_id：
   ```bash
   sqlite3 data.db "SELECT id, email, name FROM users;"
   ```
3. 将你设为超级管理员（手工写库，无前端入口）：
   ```bash
   sqlite3 data.db "INSERT INTO sys_super_admin (user_id, create_time, remark) VALUES ('你的user_id', strftime('%s','now'), '项目负责人');"
   ```

### 6. 配置爬虫密钥（可选）

```bash
CRAWLER_API_KEY="你的强随机32字节密钥" node scripts/seed-crawler-secret.mjs
```

详见 [爬虫热点推送配置文档](docs/crawler-hotspot-implementation.md)。

---

## 项目结构

```
gongwen-os-v2/
├── src/
│   ├── app/
│   │   ├── api/                     # REST API 路由
│   │   │   ├── auth/                # 注册/登录/刷新 JWT
│   │   │   ├── documents/           # 文档 CRUD
│   │   │   ├── export/              # DOCX 导出
│   │   │   ├── ai/                  # AI 流式对话
│   │   │   ├── templates/           # 公文模板管理
│   │   │   ├── skills/              # 写作规范 Skill
│   │   │   ├── reviews/             # 审阅人管理
│   │   │   ├── settings/            # API Key 管理
│   │   │   ├── hotspot-sources/     # 旧版热点源（兼容）
│   │   │   ├── hotspots/            # 旧版热点（兼容）
│   │   │   ├── admin/crawler/       # 爬虫数据源（超管 API）
│   │   │   ├── public/crawler/      # 爬虫入库（开放接口）
│   │   │   └── hot-articles/        # 热点文章展示列表
│   │   ├── (dashboard)/             # 登录后路由组
│   │   │   ├── home/                # 首页
│   │   │   ├── documents/           # 文档管理
│   │   │   ├── hotspots/            # 热点文章展示
│   │   │   ├── templates/           # 模板管理
│   │   │   ├── knowledge/           # 公文知识库
│   │   │   ├── quick-draft/         # 一键初稿
│   │   │   ├── trash/               # 回收站
│   │   │   └── settings/            # 系统设置
│   │   ├── (auth)/                  # 登录/注册页面
│   │   └── page.tsx                 # 公文编辑器（首页）
│   ├── components/
│   │   ├── editor/                  # TipTap 编辑器组件
│   │   ├── layout/                  # 侧边栏/顶栏布局
│   │   ├── settings/                # 设置面板组件
│   │   └── ui/                      # 通用 UI 组件
│   ├── server/
│   │   ├── auth/                    # JWT 签发/验证/超管鉴权
│   │   ├── db/
│   │   │   ├── index.ts             # 数据库连接
│   │   │   └── schema/              # Drizzle 表定义（~12 张）
│   │   └── lib/                     # 工具函数
│   ├── lib/                         # 客户端工具
│   └── types/                       # TypeScript 类型定义
├── scripts/                         # SQL 脚本 + 种子脚本
└── docs/                            # 开发文档
```

---

## 核心功能

### 📝 公文编辑器
- 基于 TipTap 的 WYSIWYG 编辑器，支持 GB/T 9704-2012 公文格式
- 自定义节点：题/红头/印章/文号等
- 实时排版预览、导出为 DOCX/MD

### 🤖 AI 写作助手
- 多厂商 AI 对话（OpenAI / DeepSeek / 通义千问等）
- 选中文字 inline 操作
- 一键初稿生成
- 写作规范 Skill 注入

### 📂 文档管理
- 按公文类型分类
- 版本对比 / 回滚
- 收藏 / 收藏筛选
- 回收站（软删除+恢复）

### 🕷️ 爬虫热点推送
- **超管专属**：数据源配置 → 一键生成 Python 爬虫
- **自动入库**：爬虫 → X-Crawler-Auth 鉴权 → hot_article 表
- **前端展示**：iframe 全屏预览 / 编辑 / 收藏转文档
- 详细文档见 [docs/crawler-hotspot-implementation.md](docs/crawler-hotspot-implementation.md)

---

## <a name="deploy"></a>部署指南

该项目设计为部署到 Vercel，使用 Turso 作为生产数据库，Cloudflare 管理域名。

### 准备工作

| 项目 | 说明 |
|---|---|
| [Turso](https://turso.tech) | 注册并创建数据库（免费额度 >10GB） |
| [Vercel](https://vercel.com) | 关联 GitHub 账号 |
| [Cloudflare](https://cloudflare.com) | 添加你的 .xyz 域名 |
| GitHub | 推送代码仓库 |

### 部署步骤

1. **推送代码到 GitHub**
2. **Vercel 导入项目** → Framework: Next.js → 自动检测
3. **Vercel 环境变量**：在 Settings → Environment Variables 设置全部变量
4. **Turso 数据库**：`drizzle-kit push` 到 Turso URL + 运行种子脚本
5. **Cloudflare**：添加域名 → 改 Nameserver → CNAME 指向 `cname.vercel-dns.com`
6. **Vercel Domains**：绑定 `182183.xyz` → 自动 SSL

> 详细部署步骤参考计划文件 `plans/blazing-vortex-turing.md` 或直接咨询 AI。

### 环境变量清单

| 变量 | 说明 | 必需 |
|---|---|---|
| `DATABASE_URL` | Turso 数据库地址（libsql://...） | ✅ |
| `DATABASE_AUTH_TOKEN` | Turso 鉴权 Token | ✅ |
| `JWT_SECRET` | JWT 签名密钥 | ✅ |
| `NEXTAUTH_URL` | 部署域名 | ✅ |
| `AI_KEY_SECRET` | AI 密钥加密主密钥 | ✅ |
| `CRAWLER_MASTER_KEY` | 爬虫密钥加密（可选，缺省用 JWT_SECRET） | ❌ |
| `CRAWLER_API_KEY` | 爬虫入库明文密钥（可选，仅引导用） | ❌ |

---

## 开发指南

详见 [docs/development-guide.md](docs/development-guide.md)，涵盖：
- 本地开发环境完整搭建流程
- 数据库初始化与迁移
- 超管添加与爬虫配置
- AI 对话配置
- 构建验证

---

## 许可

MIT License
