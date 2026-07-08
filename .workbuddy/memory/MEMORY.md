# 项目关键约定（gongwen-os-v2 为实际运行项目）

> ⛔ **最高优先级红线：所有代码改动必须发生在 `gongwen-os-v2/` 目录！**
> `../GongWen-OS/` 是**已弃用的旧上线版**（用 Prisma + Turso），**改它全部无效且会污染废弃库**。
> 2026-07-07 曾误在 GongWen-OS 改了一大轮（pen-app UI / P4-C / 画像 / Skill / Turso 加列），全部作废，且误改了 Turso 库。
> 任何功能开发、UI 改造、Bug 修复都只动 `gongwen-os-v2/src/**`。改前先确认 pwd 含 `gongwen-os-v2`。

## 导出 DOCX 的 live 代码位置（重要！）
- **真正生效的导出路由**：`src/app/api/export/route.ts`（POST /api/export）。dev 服务器跑的就是这个项目。
- `../GongWen-OS/src/lib/document/export-docx.ts` 是**死代码**，改它无效——之前多次"修复无效"都是因为改错了文件。
- 任何导出/排版相关改动都必须改 `gongwen-os-v2/src/app/api/export/route.ts`。

## 首行缩进规则（GB/T 9704 公文，必须与编辑器 editor.css 一比一）
- 必须用 `indent: { firstLineChars: 200 }`（OOXML 单位 = 1/100 字符），Word 才显示"2字符"。
- 绝不能用 `firstLine: <twips>`（如 533twips=0.94cm）——那会让 Word 显示成"厘米"而非"字符"。
- 居中元素（题 `.doc-title`/主标题参数）**不能有任何缩进**（之前 bug：把缩进套到所有段落，导致居中标题也缩进 0.94cm）。
- 各元素对照（来自 editor.css，当前生效）：
  - 题/小标宋（.doc-title、主标题参数）：居中、无缩进、**行距 32pt（已按要求从 28pt 改回）**
  - h1(黑体)/h2(楷体)/h3/h4(仿宋)：首行缩进2字符、**行距 28pt**
  - p/div 正文：首行缩进2字符、两端对齐(justified)、**行距 28pt**
  - li：左缩进 640twip(2em)，不首行缩进
  - blockquote：左缩进 960twip(3em)，不首行缩进
- ⚠️ 红头 `.red-header-text` 一直是 2.0，导出红头走 div 分支=28pt，二者不同步，按"红头保持原行距"未动（已知遗留，待确认）。

## 标题按钮映射（工具栏，公文规范）
- 题(Heading 图标) → `docTitle` 节点（小标宋居中）
- T(Type) → 正文（clearNodes）
- H1 → h1(黑体) / H2 → h2(楷体) / H3 → h3(仿宋加粗) / H4 → h4(仿宋)
- 自定义节点 `DocTitle` 在 `src/components/editor/extensions/DocTitle.ts`，渲染 `<div data-type="doc-title">`。

## AI 流式对话（P4-B，已完成）
- 接口 `POST /api/ai/chat`（Node runtime）：按 `userId+provider+isActive` 取密钥 → `decryptApiKey` → 调厂商 OpenAI 兼容 `/chat/completions`(stream) → SSE 透传。
- 密钥 AES-256-GCM 加密（`server/lib/crypto.ts`），明文永不落库；主密钥 env `AI_KEY_SECRET`。
- 客户端 `components/editor/AiAssistant.tsx`：模型选择器只读 `/api/settings/api-keys` 中**已启用**的模型；选中文字浮出操作条；输出支持插入/替换/复制。
- `prompts.ts` 无 server-only 依赖，可被 client 组件安全 import。

## 构建/验证约束
- ⚠️ 沙箱"安全删除"保护会拦截 `next build`（清理 .next 触发 SAFE_DELETE_BULK_CONFIRM_REQUIRED）。验证改用 `tsc --noEmit`（类型）+ dev 服务器热重载路由注册（未登录 307→/login 证明路由已注册且鉴权生效）。
- 路径注意：本目录是 `开发者`（中文），曾误写为 `developer` 导致文件落到错误目录，已纠正。

## UI 组件约定（2026-07-08 新增）

### CategoryFilterPills 分类筛选组件
- 路径：`src/components/ui/CategoryFilterPills.tsx`
- 复用知识库的圆角 pill 样式，已应用于：热点推送、文档管理、回收站
- 激活时背景色 = 分类色（内联 `style.backgroundColor`），"全部"按钮用 `#163f3a`
- 不使用时（未选中）显示 `bg-gray-100 text-gray-500 hover:bg-gray-200`

### 主题切换系统
- localStorage key: `gw-theme-mode`，值: `"light" | "dark" | "auto"`
- layout.tsx 内联脚本优先读 localStorage → fallback 到 `prefers-color-scheme`
- Topbar 中通过 `Sun`/`Moon`/`Monitor` 图标显示当前模式
- 下拉菜单三个选项均带图标+文字：🌞明亮 / 🌙黑暗 / 💻自动

### 黑暗模式 CSS 策略
- 全局覆盖在 `globals.css` 的 `.dark` 块中，用 `!important` 覆盖硬编码 Tailwind 类
- 模板管理、预览弹窗的专用覆盖放在 `globals.css` 末尾
