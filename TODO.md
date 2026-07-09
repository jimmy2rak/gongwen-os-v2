# GongWen-OS v2 — 开发 TODO

> ⛔ **红线**：所有改动只在 `gongwen-os-v2/src/**`。`../GongWen-OS/` 已弃用，改它无效。
> 📌 **最近更新**：2026-07-09（Brevo 邮件修复 + 每日热点邮件推送 + 手机UI适配计划）

---

## ✅ 已完成功能

### P4-C 一键初稿 + 画像/Skill + pen-app 风格
- [x] T1 侧边栏「一键初稿」菜单 + 6 个二级页路由 + QuickDraftNav 导航
- [x] T2 画像系统（ProfilePanel 设置页 + localStorage + buildGlobalContext 注入 AI）
- [x] T3 全局 Skill 系统（GlobalSkillPanel 设置页 + localStorage + 与 DocSkill 并存注入）
- [x] T4 一键初稿业务页：工作台/出稿/大纲/任务/最近/导出
- [x] T5 pen-app UI 风格升级（暖米纸 bg #f6f4ef + 松绿 #163f3a + 圆角 14px）

### 知识库 & 文档管理
- [x] 知识库预览使用 PreviewModal（复刻文档管理预览窗口，含导出/打印/跳转编辑）
- [x] 回收站页面（恢复 / 永久删除 / 批量操作）
- [x] 文档总数统计使用 API 真实总数（修复固定 5 的 bug）
- [x] 文档收藏/星标（favorite-store.ts + 文档列表收藏按钮 + 收藏筛选）

### 编辑器
- [x] 新建文档弹窗精简为先选类型 → 再选模板（含自定义类型同步）
- [x] 全局分类同步：编辑器新建对话框 + 类型切换菜单使用 getAllCategories()
- [x] 键盘快捷键：Ctrl+S 保存、Ctrl+N 新建（含状态栏帮助提示）
- [x] 导出历史记录 + 导出页面分 tab 展示历史

### 模板 & Skill
- [x] 内置模板不再锁定默认 Skill（移除 BuiltinCard 关联内置 Skill 区域）
- [x] 切换分类时首次自动勾选内置 Skill

### 审阅 & 设置
- [x] 审阅人部门改为下拉选单 + inline 新增部门
- [x] 部门管理弹窗（查看成员 / 删除含迁移选项）
- [x] 全站浏览器 confirm() 替换为 CustomDialog 内置弹窗（5 处）

### 热点推送（已实现）
- [x] 数据库：hotspots 表扩展 + hotspot_sources 表（内置3源+自定义）
- [x] API 路由：/api/hotspots、/api/hotspot-sources（完整 CRUD）
- [x] 热点页面：来源/分类/收藏筛选 + 原文预览 + 导出 + 星标转文档 + 创建文档
- [x] 设置页：热点推送数据源管理面板（CRUD + 一键复制 Python 命令 + 导出脚本）
- [x] Python 爬虫脚本：crawl_hotspot.py（列表页模式，支持 CSS 选择器 + HTML 全文 + Dry Run）
- [x] Python 爬虫：crawl_rmrb.py（人民日报规范版，日期分页电子报模型，输出 JSON+HTML，支持 --push/--db/--dry-run）
- [x] 爬虫代码生成器：src/lib/crawler-generator.ts（generateCrawlerScript 按网站配置生成完整可运行脚本）
- [x] 设置页新增"生成专属爬虫脚本"区块：填写 URL 模板/版面关键词/选择器 → 生成/复制/下载 .py，含"载入人民日报模板"
- [x] 热点页星标转文档/创建文档：改用 htmlContent 完整正文（TipTap HTML），与爬虫输出格式端到端对齐

> **格式契约（爬虫 ↔ 公文系统）**：系统底层存储/预览格式为 TipTap HTML。
> 文档正文写法 `<div data-type="doc-title">标题</div><p>段落</p>`；热点 `htmlContent` 存正文 HTML。
> 爬虫每篇文章需输出：`title` / `summary`(纯文本) / `content_html`(TipTap `<p>`) / `body_html`(预览) / `html_raw`(落盘)
> → `POST /api/hotspots`（htmlContent=body_html）；星标转文档时把 body_html 包进 doc-title 即成为可编辑公文。

### 爬虫热点推送系统（生产版 · 超管闭环）
- [x] `sys_super_admin` 白名单表 + `sys_secret_config` 加密密钥表（AES-256-GCM）
- [x] `crawler_source` 数据源配置表 + `hot_article` 文章主表（Drizzle + 双语法 SQL）
- [x] `isSuperAdmin()` + `getCrawlerUploadKey()` 鉴权与加密解密工具
- [x] `scripts/seed-crawler-secret.mjs` 密钥加密引导脚本
- [x] `GET /api/admin/crawler/list` / `sources` CRUD — 超管数据源管理
- [x] `POST /api/admin/crawler/generate-script` — 服务端注入密钥/地址生成 .py
- [x] `POST /api/public/crawler/upload` — 开放入库（X-Crawler-Auth + originUrl 查重）
- [x] `GET /api/hot-articles` — 前端展示列表
- [x] `src/lib/crawler-template.ts` — Python 母版（仅网络入库，无本地文件）
- [x] `CrawlerAdminPanel.tsx` — Settings 超管专属面板（表单+列表+生成弹窗）
- [x] `/hotspots` 展示页重写：iframe 全屏预览 / 编辑 / 收藏转文档
- [x] `docs/crawler-hotspot-implementation.md` 六板块完整文档

### 上线部署
- [x] GitHub 仓库推送到 Vercel 自动部署
- [x] Turso 数据库创建 + `drizzle-kit push` schema 迁移
- [x] 本地 data.db 已有数据迁移至 Turso
- [x] Vercel 环境变量全部配置完毕
- [x] 域名 `gongwenos.182183.xyz` 解析并绑定 Vercel（CNAME）
- [x] `next build` 生产构建通过
- [x] SSL/HTTPS 自动生效
- [x] 爬虫密钥加密写入 Turso（`sys_secret_config`）
- [ ] 登录 / 创建文档全流程验证
- [ ] AI 对话功能在生产环境验证
- [ ] 爬虫配置页面（超管）测试
- [x] 爬虫上传接口 401 鉴权校验
- [x] 热点推送全闭环测试完成（创建数据源 → 爬虫入库 → /hotspots 展示）

### 验证码 / Magic Link 登录系统
- [x] `POST /api/auth/send-code` — 发送 6 位验证码 + Magic Link 到邮箱
- [x] `POST /api/auth/verify-code` — 验证 6 位数字码，通过后直接签发 JWT 登录
- [x] `POST /api/auth/magic-login` — 验证 Magic Link token，通过后直接签发 JWT 登录
- [x] `/auth/magic-link` — Magic Link 自动登录回调页
- [x] 登录页新增"验证码"tab：邮箱 + 发送按钮 + 60s 倒计时 + 6 位数字输入框
- [x] 复用 `verification_tokens` 表（`otp` / `magic_link` 类型），10 分钟过期
- [x] 验证码/自动创建用户（邮箱首次登录自动注册）
- [x] 删除 GitHub/Google OAuth 前端 UI 和后端代码

### Brevo 邮件修复
- [x] SMTP 认证失败（535）→ 改为 Brevo v3 Transactional Email REST API
- [x] 发送验证码/Magic Link 邮件可用

### 每日热点邮件推送
- [x] `POST /api/cron/daily-hotspot` — 密钥保护端点，查询最新热点文章，生成 HTML 邮件，通过 Brevo 发送
- [x] 邮件模板含来源标签/栏目/摘要/一键跳转链接
- [x] 环境变量 `CRON_SECRET` / `EMAIL_TO` 配置
- [ ] 设置 cron-job.org / GitHub Actions 定时触发（每天早上 9 点）

---

## 🚧 开发中 / 已暂停 / 已放弃

| 条目 | 状态 | 说明 |
|------|------|------|
| 🔴 **公文格式校验器** | ⏸️ **已暂停** | 保存/提交时检查必填字段（主送机关、成文日期等），当前优先其他功能 |
| ❌ **体验优化（画像状态/菜单可见性/自动保存）** | 🗑️ **已放弃** | 用户明确要求跳过 |
| 🔴 **GitHub/Google OAuth 登录** | 🚫 **已暂停** | 验证码/Magic Link 已替代社交登录 |
| ✅ **Brevo 邮件发送** | ✅ **已修复** | SMTP→REST API，正常运行 |
| ✅ **热点推送全闭环** | ✅ **已完成** | 从爬虫到展示全流程可用 |

---

## 📋 下一阶段计划

### ✅ 当前重点（C — Brevo 每日热点邮件推送）
- [x] `POST /api/cron/daily-hotspot` 端点已创建（密钥保护）
- [ ] 配置 cron-job.org / GitHub Actions 每天早上 9 点触发推送
- [ ] 在设置页增加「每日推送」开关（开启/关闭 / 修改推送邮箱）
- [ ] 推送模板增加摘要 AI 摘要（而非纯截取前 150 字）

### ⏸️ B — 公文格式校验器（已暂停）
- [ ] 设计校验规则引擎：必填字段（主送机关/发文机关/成文日期/文号/印章/签发人）
- [ ] 保存/提交时触发表单级校验
- [ ] 缺失项标红 + 弹窗提示（参考 WPS 公文助手）
- [ ] 可配置：按文种设置不同的必填规则

### 📱 手机端 UI 适配（分阶段推进）

#### Phase 1：基础响应式布局 ✅ 已完成
- [x] 登录页响应式：`px-4 mx-auto` + 手机端 padding 缩放
- [x] Dashboard 容器统一改为 `p-4 md:p-6`（documents/hotspots/knowledge/home/trash/settings/quick-draft）
- [x] 编辑器纸张宽度响应式：`max-w-full md:max-w-[210mm]`

#### Phase 2：移动端导航与交互 ✅ 已完成
- [x] 侧边栏在手机端改为全屏覆盖 Drawer（`fixed inset-0` + 半透明遮罩 + 关闭按钮）
- [x] 桌面端侧边栏隐藏：`hidden md:flex`
- [x] 文档管理表格在手机端改为卡片列表（`sm:hidden` 卡片 + `hidden sm:block` 表格）
- [x] Topbar 菜单按钮在手机端切换侧栏覆盖层

#### Phase 3：触控优化与测试（1 天）
- [ ] 按钮最小触摸区域 44px
- [ ] 下拉菜单/选择器/日期选择器等控件触控友好化
- [ ] 手势支持：左滑返回、下拉刷新等（按需）
- [ ] 在 Chrome DevTools 移动端模拟器和真机测试（iOS Safari / Android Chrome）

### 高价值新功能（待定）
- [ ] AI 写作建议浮窗：编辑器选中文字后 inline 建议气泡（续写/润色一键应用）
- [ ] 一键初稿智能填充 MetaBar：生成后自动识别并填入文号、发文机关等元信息
- [ ] 文档批量操作增强：批量分类更改、批量删除等
- [ ] 搜索结果高亮：知识库搜索时高亮匹配文字
- [ ] 协同编辑基础：多人查看同一文档并添加批注

### 远期规划
- [ ] 一键初稿步骤引导模式（分步填写文种、主题、正文要素）
- [ ] 多语言支持（韩语 TOPIK-6：中韩双语公文互译）
- [ ] 模板市场：用户可分享/下载自定义模板
- [ ] WebDAV 更深集成：模板/Skill 同步到云盘

---

## 🔐 身份认证与登录系统（待规划 · 可选方案）

> 按用户要求：先不直接开发，仅根据当前部署实际情况拟一个可选的开发计划方案。

### 当前现状
- 已有自定义 JWT Cookie 认证：`/api/auth/login` / `/api/auth/logout` / `/api/auth/me`
- 数据库已有 `users` 表（id/email/passwordHash/role/departmentId 等）
- 登录页为 `/login`（邮箱+密码），注册逻辑在代码里分散，无独立 `/register` 页面
- 生产环境：Vercel + Turso，无 Redis/无自建邮件服务器，发送邮件需借助第三方 SMTP 或邮件服务

### 推荐技术路线

**方案 A：保持现有自定义 JWT 体系，逐步扩展（推荐，改动最小）**
- 继续用现有 `users` 表 + JWT Cookie
- 新增邮箱验证码/密码重置/Magic Link 通过外部邮件服务（Resend / SendGrid / 阿里云邮件推送）
- 社交登录通过 OAuth 2.0 手动接入 GitHub / Google，登录成功后写入/关联 `users` 表
- 优点：不引入 NextAuth.js 依赖，数据库 schema 改动小，完全可控
- 缺点：需要自写 OAuth 流程和邮件发送逻辑

**方案 B：引入 NextAuth.js v5 (Auth.js)**
- 支持 Credentials + OAuth + Magic Link 开箱即用
- 缺点：需要适配 Turso/Drizzle 适配器；Vercel 环境下 Credentials provider 需关闭默认 CSRF 保护或 careful 配置；和现有自定义 JWT Cookie 体系需要整合/迁移
- 适合：如果以后还要加 SAML、企业微信、飞书等大量 provider

> 建议：当前项目用方案 A，避免引入 Auth.js 的适配器和迁移成本。

### 开发阶段（可选，由用户选择）

#### 阶段 1：现有登录/注册基础补齐（工作量：小）
- [ ] 拆分 `/login` 页面为视觉统一的多态页（登录 / 注册 / 找回密码）
- [ ] 新建 `/register` 页面（邮箱 + 密码 + 确认密码）
- [ ] 服务端注册 API：`POST /api/auth/register`（邮箱唯一性校验、密码强度、bcrypt 哈希写入 users 表）
- [ ] 注册后自动签发 JWT 登录态
- [ ] 登录页圆形图标位置预留给 GitHub / Google（UI 占位）

#### 阶段 2：找回密码 / 重置密码（工作量：中）
- [ ] 新增 `password_reset_tokens` 表（userId/token/expiredAt/used）
- [ ] `POST /api/auth/forgot-password`：校验邮箱 → 生成 token → 发送重置链接邮件
- [ ] 新增 `/reset-password` 页面：带 token 参数，校验后允许输入新密码
- [ ] `POST /api/auth/reset-password`：校验 token → 更新 passwordHash → 标记 token 已使用
- [ ] 需先配置邮件服务：Resend（推荐，免费 100 封/天）或 SendGrid / 阿里云

#### 阶段 3：Magic Link 免密登录（工作量：中）
- [ ] 新增 `magic_links` 表（email/token/expiredAt/used）
- [ ] `POST /api/auth/magic-link`：发送一次性登录链接到邮箱
- [ ] 新增 `/auth/magic-link` 页面：接收 token → 校验 → 直接签发 JWT 登录态
- [ ] 安全：token 一次性、过期、绑定邮箱、可撤销

#### 阶段 4：邮箱 / 手机验证码登录（工作量：中）
- [ ] 二选一：邮箱验证码或手机短信验证码
- [ ] 推荐先做邮箱验证码（复用阶段 2 的邮件服务）
- [ ] 新增 `verification_codes` 表（email/code/expiredAt）
- [ ] `POST /api/auth/send-code`：发送 6 位验证码
- [ ] `POST /api/auth/login-code`：验证码校验 → 签发 JWT
- [ ] 手机验证码：需要接入短信服务商（阿里云/腾讯云），成本较高，可放到后期

#### 阶段 5：第三方社交登录（工作量：中）
- [ ] 登录页以圆形图标显示 GitHub / Google 快捷登录按钮
- [ ] **GitHub OAuth**：
  - 在 GitHub Settings → Developer settings → OAuth Apps 创建应用
  - 配置 Authorization callback URL：`https://gongwenos.182183.xyz/api/auth/callback/github`
  - 新增 `POST /api/auth/oauth/github`：用 code 换 access_token → 获取用户 email/name → 查找/创建用户 → 签发 JWT
- [ ] **Google OAuth**：
  - 在 Google Cloud Console → APIs & Services → Credentials 创建 OAuth 2.0 Client
  - 配置 Authorized redirect URI：`https://gongwenos.182183.xyz/api/auth/callback/google`
  - 新增 `POST /api/auth/oauth/google`：用 code 换 id_token → 验证 → 查找/创建用户 → 签发 JWT
- [ ] `users` 表需扩展字段：`oauthProvider` / `oauthProviderId`（或单独 `oauth_accounts` 表）
- [ ] 社交登录用户默认无密码，后续可在设置里补充密码

### 需要新增/改动的表
- `password_reset_tokens`（id/userId/token/expiredAt/used/createdAt）
- `magic_links`（id/email/token/expiredAt/used/createdAt）
- `verification_codes`（id/email/code/expiredAt/createdAt）
- `oauth_accounts`（id/userId/provider/providerAccountId/accessToken/createdAt）
- `users` 表：可选加 `emailVerified` / `image`（头像）

### 环境变量需求
- `RESEND_API_KEY`（或 `SENDGRID_API_KEY`）— 发邮件
- `EMAIL_FROM` — 发件人地址
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- 现有 `JWT_SECRET` 等保持不变

### 推荐执行顺序（如果决定做）
1. 阶段 1（注册/登录页统一）→ 2. 阶段 2（找回密码）→ 3. 阶段 3（Magic Link）→ 4. 阶段 5（GitHub/Google 登录）→ 5. 阶段 4（验证码登录，可选）

### 成本/依赖提醒
- Resend 免费 100 封/天，生产环境需付费或切换到自有 SMTP
- Google OAuth 需要验证应用才能发布到生产（OAuth 同意屏验证）
- GitHub OAuth 无验证门槛， easiest
- 手机短信验证码有固定成本，且需实名认证
