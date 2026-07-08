# 公文 AI 写作系统 · 本地开发指南

> 完整指南：从零搭建本地开发环境、数据库配置、超管权限、爬虫测试到构建验证。
>
> **项目路径**：`/Users/jimmywang/多媒体/开发者/oa1/gongwen-os-v2/`

---

## 1. 环境要求

| 工具 | 最低版本 | 验证命令 |
|---|---|---|
| Node.js | 20+ | `node -v` |
| npm | 10+ | `npm -v` |
| Python（可选，爬虫用） | 3.9+ | `python3 --version` |
| sqlite3（可选，手动操作数据库） | — | `sqlite3 --version` |

---

## 2. 安装依赖

```bash
cd /你的项目路径/gongwen-os-v2
npm install
```

如果首次安装或遇到锁冲突，可删除 `node_modules` 和 `package-lock.json` 后重试。

---

## 3. 环境变量

```bash
# 复制示例文件
cp .env.example .env
```

默认 `.env.example` 中的内容就是本地开发配置，直接可用：

```
DATABASE_URL="file:./data.db"         # 本地 SQLite 文件
JWT_SECRET="gwos-dev-..."             # JWT 签名密钥
NEXTAUTH_URL="http://localhost:3000"  # 本地地址
AI_KEY_SECRET="M0+zeRpU..."           # AI 密钥加密
```

> ⚠️ **不要**将 `.env` 提交到 Git（已加入 `.gitignore`）。

---

## 4. 数据库初始化

项目使用 Drizzle ORM + SQLite，数据库文件为 `data.db`（在项目根目录）。

### 4.1 首次初始化（创建所有表）

```bash
# 方式 A：全量 Drizzle 迁移（推荐）
npx drizzle-kit push
# 注意：该命令可能有交互式确认，按提示继续即可

# 方式 B：如果有交互问题，或只需爬虫相关表
sqlite3 data.db < scripts/002_crawler_system.sql
```

> **注意**：`drizzle-kit push` 在检测到与现有表结构差异时会弹出确认提示，属于正常行为。

### 4.2 验证表已创建

```bash
sqlite3 data.db ".tables"
```

预期输出应包含：`documents`、`users`、`sessions`、`skills`、`templates`、`reviews`、`versions`、`hotspots`、`hotspot_sources`、`sys_super_admin`、`sys_secret_config`、`crawler_source`、`hot_article` 等。

### 4.3 重新初始化（重置数据库）

> ⚠️ 操作会清除所有数据！

```bash
rm data.db
npx drizzle-kit push
sqlite3 data.db < scripts/002_crawler_system.sql
```

---

## 5. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

- 首次运行会自动生成 `data.db` 并创建 Drizzle schema（如果不存在）
- 热重载会自动生效
- 默认跳转到登录页

---

## 6. 注册与登录

1. 访问 http://localhost:3000/register
2. 填写邮箱、姓名、密码（密码长度 ≥ 6）
3. 注册成功后自动跳转到登录页
4. 输入邮箱和密码登录

---

## 7. 添加超级管理员

爬虫热点推送配置是超管专属功能，必须手动将你的用户加入白名单。

### 7.1 查找你的 user_id

```bash
sqlite3 data.db "SELECT id, email, name FROM users;"
```

示例输出：
```
uGgX4bC2mF9kL3pQ|admin@example.com|张三
```

### 7.2 写入白名单

```bash
sqlite3 data.db "INSERT INTO sys_super_admin (user_id, create_time, remark)
  VALUES ('你的user_id', strftime('%s','now'), '项目负责人');"
```

### 7.3 验证

重新登录后，进入 **系统设置**，应该能看到 **爬虫热点推送配置** 菜单项（普通用户看不到）。

---

## 8. AI 对话配置

### 8.1 添加 AI 厂商密钥

1. 进入 **系统设置 → API 配置**
2. 点击 **新增密钥**
3. 选择厂商（OpenAI / DeepSeek / 通义千问 等）
4. 填入 API Key 和模型名称
5. 启用该配置

### 8.2 使用 AI 助手

- 在编辑器中选中文字 → 出现 AI 操作浮窗
- 右侧 **AI 公文助手** 侧栏：选择模型和场景后提问
- 一键初稿：选择文种 → 输入主题 → 自动生成初稿

---

## 9. 爬虫热点推送配置（本地测试）

### 9.1 初始化爬虫密钥

```bash
# 生成一个强随机密钥（也可自己指定）
# 运行种子脚本，会自动加密并写入数据库
CRAWLER_API_KEY="你的32字节强随机密钥" \
SUPER_ADMIN_USER_ID="你的user_id" \
  node scripts/seed-crawler-secret.mjs
```

如果省略 `CRAWLER_API_KEY`，脚本会自动生成并打印密钥（请抄录）。

### 9.2 添加人民日报数据源

1. 登录超管账号
2. **系统设置 → 爬虫热点推送配置**
3. 点击 **新增数据源**
4. 填写：
   - 数据源名称：`人民日报`
   - 抓取根地址：`http://paper.people.com.cn/rmrb/pc/layout`
   - 绑定公文栏目：`新闻`
   - 分类标签：`时政`
5. 保存

### 9.3 生成并运行爬虫脚本

1. 在数据源列表中点击 **生成脚本**
2. 弹窗中点击 **下载** 保存为 `.py` 文件
3. 安装 Python 依赖并运行：

```bash
pip install requests beautifulsoup4
python3 crawler_task_csXXX.py
```

爬虫会自动抓取当日的「理论版」「评论版」文章并推送到本地后端入库。

### 9.4 查看结果

1. 访问 **热点文章** 菜单
2. 应该能看到新入库的文章
3. 点击小眼睛 → 全屏 iframe 预览
4. 点击编辑/收藏 → 自动创建公文文档

---

## 10. 架构概览

### 10.1 目录结构

```
src/
├── app/
│   ├── api/               # 全部后端 API（~15 个路由文件）
│   ├── (dashboard)/       # 登录后页面（~8 个路由）
│   ├── (auth)/            # 登录/注册页面
│   └── page.tsx           # 首页（公文编辑器）
├── components/
│   ├── editor/            # TipTap 编辑器（核心）
│   ├── layout/            # 侧边栏/顶栏
│   ├── settings/          # 设置面板
│   └── ui/                # 通用组件（Modal/Dialog 等）
├── server/
│   ├── auth/              # JWT + 超管鉴权
│   ├── db/                # 数据库连接 + schema
│   └── lib/               # 服务端工具（加解密/AI/导出）
├── lib/                   # 客户端工具（favorite/export-history）
├── stores/                # Zustand 状态管理
└── types/                 # TypeScript 类型
```

### 10.2 数据流

```
浏览器 (Client)                    服务器 (Next.js App Router)
─────────────                    ──────────────────────────
页面请求 ──→ middleware.ts ──→ JWT 校验 ──→ 放行/重定向
                ↓
API 请求 ──→ Route Handler ──→ getServerUser() ──→ 数据库操作
                ↓
AI 对话 ──→ /api/ai/chat ──→ 解密密钥 → 调厂商 API → SSE 流式返回
                ↓
爬虫入库 ──→ /api/public/crawler/upload ──→ X-Crawler-Auth 鉴权 → hot_article INSERT
                ↑
Python 脚本 ──→ POST + X-Crawler-Auth ──→ 爬虫自行调用
```

---

## 11. 构建验证

### 类型检查

```bash
npx tsc --noEmit
```

应零错误退出。

### 生产构建

```bash
npm run build
```

验证点：
- `.next` 目录被正确生成
- 无运行时错误
- 注意：构建过程不依赖于 `data.db`（数据库在运行时连接）

### 常见构建问题

| 问题 | 原因 | 解决 |
|---|---|---|
| `SyntaxError: Unexpected token 'export'` | Node 版本过低 | 确保 Node ≥ 20 |
| `Module not found: Can't resolve 'node:crypto'` | Edge Runtime 不兼容 | 确认 API 路由未声明 `runtime = 'edge'` |
| `Error: EACCES: permission denied` | 沙箱保护 | 以 sudo 运行或更换目录 |

---

## 12. 常见问题

### Q: 登录后一直重定向到 /login？

A: 浏览器 Cookie 中 `auth_token` 可能无效。清除 Cookie 或打开无痕窗口重新登录。

### Q: 编辑器保存文档失败？

A：检查 `data.db` 是否可写，以及 JWT 是否在有效期内（7 天）。

### Q: 爬虫脚本提示连接被拒绝？

A：确认本地开发服务器正在运行（`npm run dev`），且端口为 3000。

### Q: 怎么在 Vercel 上运行种子脚本？

A：本地运行 Turso CLI 登录后执行 `turso db shell gongwen-os-v2` 直接操作远程数据库，或通过 Vercel 本地开发环境（`vercel dev`）运行 node 脚本。

---

## 13. 相关文档

| 文档 | 说明 |
|---|---|
| [README.md](../README.md) | 项目概览 + 部署指南 |
| [crawler-hotspot-implementation.md](crawler-hotspot-implementation.md) | 爬虫热点推送系统完整实现说明 |
| [scripts/002_crawler_system.sql](../scripts/002_crawler_system.sql) | 爬虫表双语法建表 SQL |
| [scripts/seed-crawler-secret.mjs](../scripts/seed-crawler-secret.mjs) | 爬虫密钥加密引导脚本 |
