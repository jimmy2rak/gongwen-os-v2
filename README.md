<p align="center">
  <a href="./README.md"><strong>🇨🇳 中文</strong></a> &nbsp;·&nbsp;
  <a href="./README_EN.md">🇺🇸 English</a>
</p>

<h1 align="center">公文 AI 写作系统 · GongWen-OS v2</h1>

<p align="center">
  面向党政机关公文写作的 AI 辅助系统，严格遵循 <strong>GB/T 9704-2012</strong> 公文格式标准。<br/>
  集成 TipTap 富文本编辑器、AI 流式对话、一键初稿 / 智能大纲、知识库、金句库、爬虫热点推送、模板与写作规范 Skill、用户记忆等模块。
</p>

> ⚠️ **许可证：禁止商用。** 本项目采用**非商业性许可**（见文末 [许可证](#许可证) 与 `LICENSE` 文件）。任何商业用途（含 SaaS 售卖、二次封装收费、企业内部商业化部署牟利）均需获得作者书面授权。

---

## 目录

- [一、项目概述](#一项目概述)
- [二、技术栈](#二技术栈)
- [三、系统架构](#三系统架构)
  - [3.1 整体分层](#31-整体分层)
  - [3.2 请求生命周期](#32-请求生命周期)
  - [3.3 数据模型（表清单）](#33-数据模型表清单)
- [四、目录结构](#四目录结构)
- [五、核心模块与实现方式](#五核心模块与实现方式)
  - [5.1 认证与权限](#51-认证与权限)
  - [5.2 数据库层](#52-数据库层)
  - [5.3 公文编辑器](#53-公文编辑器)
  - [5.4 AI 对话与内容生成](#54-ai-对话与内容生成)
  - [5.5 一键初稿 / 智能大纲（双资料上传增强）](#55-一键初稿--智能大纲双资料上传增强)
  - [5.6 知识库与文档管理](#56-知识库与文档管理)
  - [5.7 金句库](#57-金句库)
  - [5.8 热点推送（爬虫系统）](#58-热点推送爬虫系统)
  - [5.9 模板与写作规范 Skill](#59-模板与写作规范-skill)
  - [5.10 用户记忆系统](#510-用户记忆系统)
  - [5.11 审阅与评稿](#511-审阅与评稿)
  - [5.12 设置中心](#512-设置中心)
- [六、安全说明（含密钥泄露扫描结论）](#六安全说明含密钥泄露扫描结论)
- [七、环境变量](#七环境变量)
- [八、本地开发与部署](#八本地开发与部署)
- [九、许可证](#许可证)

---

## 一、项目概述

GongWen-OS v2 是一个**全栈公文写作平台**，目标是让公文写作者在一个系统内完成：

- **写作**：基于标准公文格式的所见即所得编辑器（仿宋 / 楷体 / 黑体 / 方正小标宋，按 GB/T 9704-2012 排版）；
- **AI 辅助**：多厂商大模型流式对话、选中文字即时润色、按文章类型注入写作规范（Skill）、引用知识库 / 金句库 / 用户记忆；
- **素材管理**：知识库（已审阅文档）、金句库、文档管理（版本 / 回收站）、爬虫热点推送；
- **批量生成**：一键初稿、智能大纲，并支持上传「事件参考资料 + 语言结构文风参考资料」双资料，由 AI 真实解析并复用；
- **协作**：审阅人管理、评稿流转、超管权限与爬虫数据源配置。

前后端同仓（Next.js App Router），API 以 Route Handlers 形式与页面同处一个项目，部署为单一 Vercel 服务。

---

## 二、技术栈

| 层 | 技术选型 | 说明 |
|---|---|---|
| 框架 | [Next.js 16](https://nextjs.org)（App Router）+ React 19 + TypeScript | 前端页面与 API Route 同仓 |
| 样式 | Tailwind CSS v4 + [Lucide Icons](https://lucide.dev) + shadcn/ui | 政务 OA 沉稳风格（蓝灰主调） |
| 编辑器 | [TipTap 3](https://tiptap.dev)（ProseMirror）+ 自定义扩展 | 题 / 红头 / 印章 / 文号等公文语义节点 |
| 数据库 | [Drizzle ORM](https://orm.drizzle.team) + [libSQL / Turso](https://turso.tech) | 本地 SQLite 文件 / 生产 Turso（libSQL 远程） |
| 认证 | JWT（[jose](https://github.com/panva/jose)）+ bcryptjs | HTTP-only Cookie，非 NextAuth |
| AI 通道 | SSE 流式（`/api/ai/chat`）+ OpenAI 兼容协议 | 用户自有 Key（AES-256-GCM 加密）或系统 MiniCPM 兜底 |
| 文档解析 | mammoth（docx）/ pdfjs-dist（pdf）/ tesseract.js（jpg·png OCR） | 客户端浏览器内解析，零服务端负担 |
| 导出 | `docx` 库（DOCX 导出） | 服务端生成 |
| 邮件 | nodemailer + Brevo API | 验证码 / 密码重置 / 热点推送 |
| 爬虫 | Python（requests + BeautifulSoup） | 超管后台一键生成可运行脚本 |
| 部署 | Vercel Serverless + Cloudflare DNS + Turso DB | 自动部署（push 即上线） |

---

## 三、系统架构

### 3.1 整体分层

```
┌─────────────────────────────────────────────────────────────┐
│  浏览器（客户端）                                              │
│  · Next.js App Router 页面（(dashboard) / (auth)）           │
│  · TipTap 编辑器 / AI 对话组件 / 上传解析（pdfjs·mammoth·OCR） │
│  · Zustand 状态（editor.store）、localStorage 草稿缓存         │
└───────────────┬───────────────────────────┬─────────────────┘
                │  HTTPS（页面 + API 同源）   │
┌───────────────▼───────────────────────────▼─────────────────┐
│  Next.js（Vercel Edge + Node Runtime）                        │
│  · middleware.ts：JWT 路由守卫（放行 / 重定向 /login）         │
│  · app/api/* Route Handlers：业务逻辑入口                     │
│  · server/auth：getServerUser / 权限 / 超管校验                │
│  · server/db：Drizzle 查询 + libSQL 原生 SQL                  │
└───────────────┬───────────────────────────┬─────────────────┘
                │                           │
        ┌───────▼────────┐          ┌───────▼──────────────┐
        │ Turso / SQLite │          │ 大模型服务 / Brevo    │
        │（libSQL 远程） │          │（AI Key / 邮件 API）  │
        └────────────────┘          └───────────────────────┘
```

要点：

- **同源一体化**：页面与 API 同属一个 Next.js 应用，避免跨域复杂度；API 通过 `getServerUser()` 从 Cookie 读取并校验 JWT。
- **数据隔离**：所有业务表均带 `user_id` 字段，查询时强制按当前登录用户过滤（文档、金句、模板、Skill、记忆、知识库等）。
- **密钥不出后端**：用户 AI Key、爬虫密钥均经 AES-256-GCM 加密后入库；明文仅在「生成脚本 / 调用模型」时由后端解密，绝不出现在前端。

### 3.2 请求生命周期

1. 浏览器请求任意页面 → `middleware.ts` 检查 `auth_token` Cookie：
   - 命中 `PUBLIC_PATHS`（`/login`、`/register`、`/api/auth/*`、`/api/public/*` 等）直接放行；
   - 其他路径校验 JWT，无效则清除 Cookie 并 307 重定向 `/login?redirect=...`。
2. API Route 内调用 `getServerUser()` 取出 `{ id, email, name }`；未登录返回 401。
3. 业务处理：Drizzle / libSQL 读写（带 `user_id` 过滤）；涉 AI 时组装 `systemExtra` 后调用模型（SSE 流式返回）。
4. 涉及超管 / 权限的接口额外走 `requireSuperAdmin()` / `requirePermission()`。

### 3.3 数据模型（表清单）

`src/server/db/schema/*.ts` 定义，约 26 张表：

| 分类 | 表 |
|---|---|
| 用户与认证 | `users`、`sessions`、`verificationTokens`、`oauthAccounts`、`userProfiles` |
| 权限 | `userPermission`、`adminPermission`、`sysSuperAdmin` |
| 文档 | `documents`、`versions`（版本快照）、`reviews`、`reviewers` |
| AI | `apiKeys`（加密存储）、`aiChatLog`、`userMemory`、`skills`、`templates` |
| 素材 | `quotations`（金句）、`hotspots`、`hotspotSources`、`hotArticle`、`crawlerSource` |
| 系统 | `sysSecretConfig`（加密密钥库）、`userPreference` |

---

## 四、目录结构

```
gongwen-os-v2/
├── src/
│   ├── app/
│   │   ├── api/                     # REST API 路由（Route Handlers）
│   │   │   ├── auth/                # 注册/登录/登出/刷新/找回密码/魔法链接
│   │   │   ├── ai/                  # chat（流式对话）、generate-from-sources（来源生成）
│   │   │   ├── documents/           # 文档 CRUD、版本、批量、软删/恢复
│   │   │   ├── export/              # DOCX 导出
│   │   │   ├── templates/ skills/   # 模板与写作规范 Skill 管理
│   │   │   ├── quotations/          # 金句库（集合路由 + [id] 路由）
│   │   │   ├── hotspots/ hot-articles/ hotspot-sources/   # 热点推送
│   │   │   ├── admin/crawler/       # 爬虫数据源（超管 API）
│   │   │   ├── public/crawler/      # 爬虫入库（开放接口，X-Crawler-Auth 鉴权）
│   │   │   ├── user/memory/         # 用户记忆读取 / 刷新
│   │   │   ├── settings/api-keys/   # AI Key 加密存储
│   │   │   ├── reviewers/ reviews/  # 审阅人与评稿
│   │   │   └── cron/daily-hotspot/  # 定时热点推送
│   │   ├── (dashboard)/             # 登录后路由组
│   │   │   ├── home/                # 首页（含编辑器入口）
│   │   │   ├── documents/           # 文档管理
│   │   │   ├── hotspots/            # 热点文章展示（iframe 预览 + 加金句）
│   │   │   ├── knowledge/           # 公文知识库
│   │   │   ├── quick-draft/         # 一键初稿 / 大纲 / 导出 / 任务 / 最近
│   │   │   ├── templates/           # 模板管理
│   │   │   ├── settings/            # 系统设置
│   │   │   └── account/ trash/      # 账号 / 回收站
│   │   ├── (auth)/                  # 登录 / 注册页
│   │   └── page.tsx                 # 公文编辑器（首页）
│   ├── components/
│   │   ├── editor/                  # TipTap 编辑器 + 工具栏 + 页脚状态栏 + 自定义扩展
│   │   ├── layout/                  # 侧边栏 / 顶栏
│   │   ├── settings/                # 设置面板
│   │   ├── quick-draft/             # 一键初稿相关组件（含双资料上传区）
│   │   └── ui/                      # 通用 UI（Dialog / 按钮等）
│   ├── server/
│   │   ├── auth/                    # JWT 签发/验证、守卫、密码、权限、超管
│   │   ├── db/                      # 数据库连接 + Drizzle schema
│   │   └── lib/                     # AI 调用、记忆抽取等工具
│   ├── lib/                         # 客户端工具（markdown、解析、AI 生成 hook 等）
│   ├── types/                       # TypeScript 类型与公文分类定义
│   └── middleware.ts                # JWT 路由守卫
├── scripts/                         # SQL 初始化脚本 + 爬虫密钥种子脚本
├── public/fonts/gov/                # 内嵌公文字体（仿宋/楷体/方正小标宋）
├── docs/                            # 开发文档
├── crawl_*.py                       # 独立爬虫脚本（人民日报等）
├── .env.example                     # 环境变量模板（默认被 .gitignore 忽略）
└── LICENSE                          # 非商业许可证
```

---

## 五、核心模块与实现方式

### 5.1 认证与权限

- **登录态**：注册 / 登录成功后，服务端用 `jose` 签发 JWT（HS256，密钥 `JWT_SECRET`），写入 **HTTP-only Cookie `auth_token`**。
- **路由守卫**：`middleware.ts` 在 Edge Runtime 校验该 Cookie；`PUBLIC_PATHS` 外的页面未登录即重定向 `/login`。
- **服务端取用户**：API 内 `getServerUser()` 从 Cookie 读 token → `verifyToken` → 返回 `{ id, email, name }`；缺 `JWT_SECRET` 时打印诊断错误（避免“dashboard 一直加载中”类问题难以排查）。
- **密码**：`bcryptjs` 哈希存储，登录时比对；支持邮箱验证码、魔法链接（`/auth/magic-link`）。
- **权限模型**：
  - `sysSuperAdmin`：超管白名单（手工写库或 `seed-crawler-secret.mjs` 注入），可访问爬虫配置、用户管理等。
  - `userPermission` / `adminPermission`：细粒度功能权限。
  - 超管接口用 `requireSuperAdmin()`，权限接口用 `requirePermission()`。

### 5.2 数据库层

- `src/server/db/index.ts`：`createClient({ url, authToken })` 创建 libSQL 客户端，`drizzle(client, { schema })` 暴露 `db` 实例；同时导出原生 `client` 供原生 SQL 使用（如 `client.execute({ sql, args })`）。
- **本地 / 生产切换**：仅改 `DATABASE_URL`（`file:./data.db` ↔ `libsql://...`），`authToken` 仅生产需要。
- **迁移**：`drizzle-kit push` 同步 schema；爬虫相关新表由 `scripts/*.sql` 初始化。
- **多租户隔离**：业务查询一律带 `WHERE user_id = ?`，杜绝越权读取。

### 5.3 公文编辑器

- **内核**：TipTap 3（ProseMirror）。自定义节点扩展（`extensions/`）：`DocTitle`（主标题）、`RedHeader`（红头）、`OfficialSeal`（印章）、`DocNumber`（文号）、版记 / 落款等，渲染为带语义 `class` 的块级元素。
- **标准格式**：
  - `public/fonts/gov/` 内嵌三个标准公文字体（仿宋_GB2312 / 楷体_GB2312 / 方正小标宋），`editor.css` 顶部 `@font-face` 声明，**家族名与 CSS 变量完全一致**，现有回退栈第一行即命中内嵌字体——跨平台一致显示，不依赖系统是否安装。
  - 字体映射：正文=仿宋、主标题=方正小标宋、一级标题=黑体、二级标题=楷体、版记=仿宋。
- **「强制渲染」按钮**：取 `editor.getHTML()` → `sanitizeGovHtml()` 清洗（剥离行内 `style` / Word 垃圾类，但**白名单保留公文语义类** `doc-title` / `doc-number` / `red-header` / `official-seal` 等）→ 重新 `setContent`，让内容真正回归 CSS 标准格式。
- **外部内容清洗**：从一键初稿 / 大纲输出、Word 导入、粘贴进入编辑器的 HTML，均先经 `sanitizeGovHtml()`，避免行内样式覆盖公文排版。
- **页脚状态栏**（`EditorFooterBar`）：字数统计、保存状态（已保存 / 未保存 + 保存时间）、纸面缩放、快捷键说明（按设备识别 Mac / Windows）。

### 5.4 AI 对话与内容生成

- **流式通道**：`/api/ai/chat` 以 SSE 返回；客户端 `stream-client.ts` + `use-generate.ts` 负责连接与逐字渲染。
- **systemExtra 组装（核心）**：
  - 客户端组装：`userProfile`（身份背景）+ `globalSkills`（全局 Skill）+ `categorySkills`（分类 Skill）+ 用户选中的 `skill` + `referenceContext`（见 5.5 双资料）。
  - 服务端追加：`userMemoryPrompt`（用户记忆）+ `quotationContext`（金句库，LIMIT 40）+ `articleContext`（仅当传入 `articleIds` 时）。
  - 最终 `systemExtra = [客户端块] + userMemory + quotationContext + articleContext`，一处注入覆盖编辑器 / 知识库问答 / 快速起草全部入口。
- **模型解析（resolveModel）**：用户启用自有 AI Key（见 5.12 加密存储）→ 优先使用；否则回退系统 MiniCPM。
- **金句引用**：所有 AI 对话自动注入金句库；11 类「十维写作」内置 Skill 均追加「金句引用」说明，AI 写作时恰当引用用户佳句。

### 5.5 一键初稿 / 智能大纲（双资料上传增强）

- **双虚线上传区**：在出稿 / 大纲页输入框下方，两个独立虚线卡片（边框 `#ccc`）：
  - 区域一【事件参考资料】：事件素材 / 通知 / 原始文件 / 汇报材料 / 背景资料；
  - 区域二【语言结构文风参考资料】：单位范文 / 模板 / 标准公文 / 同类稿件。
- **客户端真实解析**（`src/lib/ai/parse-reference.ts`，零服务端负担）：
  - `pdf` → pdfjs-dist；`docx` → mammoth；`jpg/png` → tesseract.js 中文 OCR；`txt/md` → 直接读。
  - 重依赖**动态加载**（仅上传对应格式才 import），不拖慢首屏；单文件超 20MB 或 6000 字截断；旧版 `.doc` 不支持，提示转 `.docx`。
- **系统级固定分析逻辑（永久生效）**：`src/lib/ai/reference-rules.ts` 固化用户给定的「事件资料→事实层 / 范文资料→风格层 / 融合输出」三段强制规则（`REFERENCE_ANALYSIS_RULES`），生成时作为 systemExtra 注入，界面不可关。
- **上下文组装**：`buildReferenceContext({ eventItems, styleItems, knowledgeText? })` 将【固定规则】+【事件资料真实内容】+【文风资料真实内容】+ 可选【知识库】合并；同步带入 Skill / 输入框需求 / 金句库 / 用户记忆。
- **来源生成**：`/api/ai/generate-from-sources` 支持勾选知识库 / 文档管理 / 金句库 / 热点推送，聚合材料后由 LLM 生成模板（JSON）或 Skill（Markdown），前端可预览修改后保存。

### 5.6 知识库与文档管理

- **知识库**：`/api/documents?reviewed=true` 取「已审阅」文档作为知识库语料；AI 对话 / 双资料生成时可勾选「同时引用知识库」。
- **文档管理**：按公文类型分类；`versions` 表保存每次保存的完整快照，支持版本对比 / 回滚；收藏 / 筛选；回收站软删除 + 恢复（`documents/[id]/restore` 等）。
- **本地草稿**：每 30 秒自动保存到 localStorage（含 `savedAt`），与云端冲突时弹窗让用户选择恢复本地或云端。

### 5.7 金句库

- `quotations` 表，按 `sourceType`（document / knowledge / hotspot / editor / manual）区分来源，`user_id` 隔离。
- 删除走 `DELETE /api/quotations?id=`（集合路由已实现 DELETE handler）或 `/api/quotations/[id]`（兼容路径 / query 参数）。
- 热点全文页圈选文字 → iframe 气泡 `postMessage`（`gw-add-quote`）→ 入库；气泡 `onmousedown preventDefault` 修复选区折叠导致点击无反应的问题。

### 5.8 热点推送（爬虫系统）

- **配置（超管专属）**：`admin/crawler/sources` 管理数据源；`admin/crawler/generate-script` 一键生成可运行的 Python 爬虫脚本（写入目标站点、栏目、入库地址）。
- **入库（开放接口）**：`public/crawler/upload` 接收 `X-Crawler-Auth` 头鉴权 → 写入 `hotArticle` 表。
- **密钥管理**：爬虫入库密钥明文**不出现于前端**，由超管在后端配置，经 AES-256-GCM 加密存入 `sysSecretConfig`（`key_name='crawler_upload'`）；`seed-crawler-secret.mjs` 用于首次引导写入。
- **前端展示**：热点页 iframe 全屏预览原文、可编辑、可「收藏转文档」、可圈选「添加金句」。
- **定时推送**：`cron/daily-hotspot` 由 `CRON_SECRET` 保护的定时器触发，将热点邮件推送到 `EMAIL_TO`。

### 5.9 模板与写作规范 Skill

- **内置 Skill**：`src/lib/builtin-templates.ts` 维护 11 类「十维写作」内置 Skill（通知 / 报告 / 请示 / 函 / 纪要 / 决定 / 通报 / 批复 / 方案 / 讲话稿 / 新闻），均含结构规范与金句引用说明。
- **用户模板 / Skill**：`templates` / `skills` 表按用户隔离，前端可增删改；新增时可勾选来源由 AI 生成默认内容。
- **偏好**：`templates/preferred` 记录当前使用的模板与 Skill。

### 5.10 用户记忆系统

- `user/memory` 读取 / 保存用户 AI 写作记忆（按账号）。
- `user/memory/refresh` 触发 `gatherMemorySources`：聚合文档库 / 知识库 / 聊天历史 / **金句库**，经 `extract-memory.ts` 的 LLM 抽取提示词归纳用户偏好的表达风格、修辞、论证方式，结果可检查后保存。

### 5.11 审阅与评稿

- `reviewers` 管理审阅人；`reviews` 记录评稿流转；编辑器「提交审阅」将当前文档送审。

### 5.12 设置中心

- **AI Key 管理**（`settings/api-keys`）：用户输入的厂商 Key 经 **AES-256-GCM 加密**（`AI_KEY_SECRET` 主密钥）后入库，服务端调用时解密，界面仅展示掩码。
- **画像 / 偏好 / 爬虫管理 / 审阅人 / 用户管理** 等面板，分别落地到 `userProfiles` / `userPreference` / `crawlerSource` / `reviewers` / `users`。

---

## 六、安全说明（含密钥泄露扫描结论）

本项目对仓库（含 **git 历史**）做了完整安全扫描，结论如下：

### ✅ 未发现泄露的项

- **环境变量文件未被提交**：`.env` / `.env.production` / `.env.example` 均被 `.gitignore` 的 `.env*` 规则忽略，未进入任何提交。
- **无硬编码云密钥**：AWS Access Key（`AKIA…`）、OpenAI / Anthropic Key（`sk-…` / `sk-ant-…`）、GitHub Token（`ghp_…`）、Slack、Firebase、JWT 字符串、带凭证的数据库连接串等，在跟踪文件与历史中均未发现。
- **无私钥文件**：仓库内不存在 `.pem` / `id_rsa` / `*.key` 等私钥文件。
- **密钥加解密实现正确**：`src/server/auth/secret.ts` 与 `scripts/seed-crawler-secret.mjs` 仅从环境变量读取主密钥，对爬虫密钥做 AES-256-GCM 加解密，未硬编码明文。
- **数据库凭证不落地源码**：`drizzle.config.ts` 与 `db/index.ts` 均从 `process.env.DATABASE_URL` 读取。

### ⚠️ 已发现并修复的问题

- **爬虫入库密钥曾被硬编码**：早期提交中，`crawl_rmrb_today.py` 与 `scripts/crawler_task_新华网.py` 曾将爬虫入库密钥**硬编码为源码常量**。该值已在本仓库最新版本中移除，改为**仅从环境变量 `CRAWLER_API_KEY` 读取**（缺失即报错退出）。
- **但历史提交中仍包含该值**（约 73 处历史匹配）。由于旧值已不可收回，请务必执行 **密钥轮换**：
  1. 生成一个全新的随机密钥（`openssl rand -hex 32`）；
  2. 重新运行引导脚本写入加密库：
     ```bash
     CRAWLER_API_KEY="<新密钥>" node scripts/seed-crawler-secret.mjs
     ```
  3. 确保生产环境的 `CRAWLER_API_KEY` 环境变量与新密钥一致；旧密钥视为已泄露，立即失效。
- （可选）如需彻底从 git 历史清除旧值，可使用 `git filter-repo` / BFG 重写历史后强制推送——此操作破坏性较强，请在执行前备份并确认为本人仓库。

### 🔐 安全最佳实践（部署前自查）

- 所有密钥通过环境变量 / 加密库注入，**绝不写入源码或提交**。
- 生产 `JWT_SECRET` / `AI_KEY_SECRET` / `CRAWLER_MASTER_KEY` 使用强随机值（`openssl rand -hex 32` / `openssl rand -base64 32`）。
- 建议接入 pre-commit 密钥扫描（如 gitleaks / trufflehog）防止再次泄露。
- `data.db`（本地 SQLite，含真实文档 / 用户数据）已被 `.gitignore` 忽略，请勿手动提交。

---

## 七、环境变量

| 变量 | 说明 | 必需 |
|---|---|---|
| `DATABASE_URL` | 数据库地址（`file:./data.db` 或 `libsql://...`） | ✅ |
| `DATABASE_AUTH_TOKEN` | Turso 鉴权 Token（本地不需要） | 生产✅ |
| `JWT_SECRET` | JWT 签名密钥（HS256） | ✅ |
| `NEXTAUTH_URL` | 部署域名 | ✅ |
| `AI_KEY_SECRET` | AI Key 加密主密钥（AES-256-GCM） | ✅ |
| `CRAWLER_MASTER_KEY` | 爬虫密钥加密主密钥（缺省用 `JWT_SECRET`） | ❌ |
| `CRAWLER_API_KEY` | 爬虫入库明文密钥（仅首次引导写入加密库） | ❌ |
| `BREVO_API_KEY` | Brevo 邮件 API Key（热点推送邮件） | ❌ |
| `EMAIL_FROM` / `EMAIL_FROM_NAME` | 发件地址 / 名称 | ❌ |
| `CRON_SECRET` / `EMAIL_TO` | 定时任务密钥 / 默认收件人 | ❌ |

> 复制 `.env.example` 为 `.env` 后按上表填写；`.env.example` 中的默认值为本地开发占位，**生产务必替换为强随机值**。

---

## 八、本地开发与部署

### 本地开发

```bash
git clone <你的仓库URL>
cd gongwen-os-v2
npm install
cp .env.example .env          # 按需修改
npm run dev                    # http://localhost:3000
```

初始化数据库（Drizzle 全量同步）：

```bash
npx drizzle-kit push
```

注册账号并设为超管：

```bash
sqlite3 data.db "SELECT id, email FROM users;"
sqlite3 data.db "INSERT INTO sys_super_admin (user_id, create_time, remark) VALUES ('你的user_id', strftime('%s','now'), '项目负责人');"
```

配置爬虫密钥（可选）：

```bash
CRAWLER_API_KEY="你的强随机32字节密钥" node scripts/seed-crawler-secret.mjs
```

### 生产部署（Vercel + Turso + Cloudflare）

1. 推送代码到 GitHub → Vercel 导入（Framework: Next.js，自动检测）。
2. Vercel **Environment Variables** 填入第七节全部变量。
3. Turso 建库 → `drizzle-kit push` → 运行种子脚本。
4. Cloudflare 域名 → Nameserver → CNAME 指向 `cname.vercel-dns.com`；Vercel Domains 绑定 → 自动 SSL。
5. 每次 `git push` 触发自动构建与部署。

---

## 许可证

本项目采用 **非商业性许可证（Non-Commercial License）**。核心条款：

- ✅ 允许：个人学习、研究、内部非盈利使用、阅读与修改源码。
- ❌ 禁止：任何商业用途（包括但不限于 SaaS 售卖、API 转售、二次封装收费、企业内部为营利目的的商业部署、将本系统作为商品或服务的一部分提供）。
- 保留著作权与署名；如需商业授权，须获得作者**书面许可**。

完整条款见仓库根目录 [`LICENSE`](./LICENSE) 文件（含中文与英文版本）。

---

<p align="center">
  <a href="./README.md"><strong>🇨🇳 中文</strong></a> &nbsp;·&nbsp;
  <a href="./README_EN.md">🇺🇸 English</a>
</p>