<p align="center">
  <a href="./README.md">🇨🇳 中文</a> &nbsp;·&nbsp;
  <a href="./README_EN.md"><strong>🇺🇸 English</strong></a>
</p>

<h1 align="center">GongWen-OS v2 · AI Official-Document Writing System</h1>

<p align="center">
  An AI-assisted writing system for Chinese government / official documents,<br/>
  strictly following the <strong>GB/T 9704-2012</strong> official-document format standard.<br/>
  Bundles a TipTap rich-text editor, streaming AI chat, one-click drafting / outlines, a knowledge base, a quotation library, crawled hot-topic feeds, templates & writing-spec Skills, and a user memory system.
</p>

> ⚠️ **License: Non-Commercial.** This project is released under a **Non-Commercial License** (see the [License](#license) section and the `LICENSE` file). Any commercial use (incl. SaaS resale, paid repackaging, or profit-driven internal commercial deployment) requires the author's written permission.

---

## Table of Contents

- [1. Overview](#1-overview)
- [2. Tech Stack](#2-tech-stack)
- [3. System Architecture](#3-system-architecture)
  - [3.1 Layered Design](#31-layered-design)
  - [3.2 Request Lifecycle](#32-request-lifecycle)
  - [3.3 Data Model (Tables)](#33-data-model-tables)
- [4. Directory Structure](#4-directory-structure)
- [5. Core Modules & Implementation](#5-core-modules--implementation)
  - [5.1 Authentication & Authorization](#51-authentication--authorization)
  - [5.2 Data Layer](#52-data-layer)
  - [5.3 Official-Document Editor](#53-official-document-editor)
  - [5.4 AI Chat & Content Generation](#54-ai-chat--content-generation)
  - [5.5 One-Click Draft / Outline (Dual-Reference Upload)](#55-one-click-draft--outline-dual-reference-upload)
  - [5.6 Knowledge Base & Document Management](#56-knowledge-base--document-management)
  - [5.7 Quotation Library](#57-quotation-library)
  - [5.8 Hot-Topic Feed (Crawler System)](#58-hot-topic-feed-crawler-system)
  - [5.9 Templates & Writing-Spec Skills](#59-templates--writing-spec-skills)
  - [5.10 User Memory System](#510-user-memory-system)
  - [5.11 Review & Approval](#511-review--approval)
  - [5.12 Settings Center](#512-settings-center)
- [6. Security Notes (incl. Secret-Leak Scan)](#6-security-notes-incl-secret-leak-scan)
- [7. Environment Variables](#7-environment-variables)
- [8. Local Dev & Deployment](#8-local-dev--deployment)
- [9. License](#license)

---

## 1. Overview

GongWen-OS v2 is a **full-stack official-document writing platform**. It lets document authors complete, within one system:

- **Writing**: a WYSIWYG editor conforming to the standard official format (FangSong / KaiTi / HeiTi / Founder XiaoBiaoSong, laid out per GB/T 9704-2012).
- **AI assistance**: multi-vendor streaming LLM chat, inline text polishing, writing-spec (Skill) injection per document type, and referencing of the knowledge base / quotation library / user memory.
- **Asset management**: knowledge base (reviewed docs), quotation library, document management (versions / trash), and crawled hot-topic feeds.
- **Batch generation**: one-click draft and smart outline, with optional upload of two reference sets — *event materials* + *language/structure style references* — which the AI parses and reuses for real.
- **Collaboration**: reviewer management, review workflow, super-admin permissions, and crawler source configuration.

Frontend and backend live in one repo (Next.js App Router); APIs are Route Handlers colocated with pages and deployed as a single Vercel service.

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router) + React 19 + TypeScript | Pages & API Routes in one repo |
| Styling | Tailwind CSS v4 + [Lucide Icons](https://lucide.dev) + shadcn/ui | Sober gov-OA look (blue/gray) |
| Editor | [TipTap 3](https://tiptap.dev) (ProseMirror) + custom extensions | DocTitle / RedHeader / Seal / DocNumber nodes |
| Database | [Drizzle ORM](https://orm.drizzle.team) + [libSQL / Turso](https://turso.tech) | Local SQLite file / production Turso |
| Auth | JWT ([jose](https://github.com/panva/jose)) + bcryptjs | HTTP-only Cookie, not NextAuth |
| AI channel | SSE streaming (`/api/ai/chat`) + OpenAI-compatible protocol | User key (AES-256-GCM) or system MiniCPM fallback |
| Doc parsing | mammoth (docx) / pdfjs-dist (pdf) / tesseract.js (jpg·png OCR) | In-browser, zero server cost |
| Export | `docx` library (DOCX export) | Server-side generation |
| Email | nodemailer + Brevo API | OTP / password reset / hot-topic push |
| Crawler | Python (requests + BeautifulSoup) | Super-admin generates runnable scripts |
| Deploy | Vercel Serverless + Cloudflare DNS + Turso DB | Push-to-deploy |

---

## 3. System Architecture

### 3.1 Layered Design

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (client)                                             │
│  · Next.js App Router pages ((dashboard) / (auth))          │
│  · TipTap editor / AI chat / upload parsing (pdfjs·mammoth·OCR)│
│  · Zustand state (editor.store) + localStorage draft cache    │
└───────────────┬───────────────────────────┬─────────────────┘
                │  HTTPS (pages + API same-origin) │
┌───────────────▼───────────────────────────▼─────────────────┐
│  Next.js (Vercel Edge + Node Runtime)                         │
│  · middleware.ts: JWT route guard (allow / redirect /login)   │
│  · app/api/* Route Handlers: business entry points           │
│  · server/auth: getServerUser / permission / super-admin      │
│  · server/db: Drizzle queries + libSQL raw SQL                │
└───────────────┬───────────────────────────┬─────────────────┘
                │                           │
        ┌───────▼────────┐          ┌───────▼──────────────┐
        │ Turso / SQLite │          │ LLM service / Brevo  │
        │ (libSQL remote)│          │ (AI key / email API) │
        └────────────────┘          └───────────────────────┘
```

Key points:

- **Same-origin unity**: pages and APIs belong to one Next.js app, avoiding CORS complexity; APIs read/verify the JWT from the Cookie via `getServerUser()`.
- **Data isolation**: every business table carries a `user_id`; queries always filter by the current user (documents, quotations, templates, skills, memory, knowledge base, …).
- **Secrets never leave the backend**: user AI keys and crawler keys are AES-256-GCM encrypted at rest; plaintext is decrypted only on the backend when generating a script or calling a model, and never reaches the frontend.

### 3.2 Request Lifecycle

1. Any page request → `middleware.ts` checks the `auth_token` Cookie:
   - Hits `PUBLIC_PATHS` (`/login`, `/register`, `/api/auth/*`, `/api/public/*`, …) → allowed directly;
   - Otherwise verifies the JWT; on failure clears the Cookie and 307-redirects to `/login?redirect=...`.
2. Inside an API Route, `getServerUser()` returns `{ id, email, name }`; unauthenticated → 401.
3. Business logic: Drizzle / libSQL read-write (with `user_id` filter); AI calls assemble `systemExtra` and stream back via SSE.
4. Super-admin / permission-gated endpoints additionally call `requireSuperAdmin()` / `requirePermission()`.

### 3.3 Data Model (Tables)

Defined in `src/server/db/schema/*.ts`, ~26 tables:

| Group | Tables |
|---|---|
| User & auth | `users`, `sessions`, `verificationTokens`, `oauthAccounts`, `userProfiles` |
| Permission | `userPermission`, `adminPermission`, `sysSuperAdmin` |
| Documents | `documents`, `versions` (snapshots), `reviews`, `reviewers` |
| AI | `apiKeys` (encrypted), `aiChatLog`, `userMemory`, `skills`, `templates` |
| Assets | `quotations`, `hotspots`, `hotspotSources`, `hotArticle`, `crawlerSource` |
| System | `sysSecretConfig` (encrypted key vault), `userPreference` |

---

## 4. Directory Structure

```
gongwen-os-v2/
├── src/
│   ├── app/
│   │   ├── api/                     # REST API Route Handlers
│   │   │   ├── auth/                # register/login/logout/refresh/reset/magic-link
│   │   │   ├── ai/                  # chat (streaming), generate-from-sources
│   │   │   ├── documents/           # CRUD, versions, batch, soft-delete/restore
│   │   │   ├── export/              # DOCX export
│   │   │   ├── templates/ skills/   # template & writing-spec Skill management
│   │   │   ├── quotations/          # quotation library (collection + [id] routes)
│   │   │   ├── hotspots/ hot-articles/ hotspot-sources/   # hot-topic feeds
│   │   │   ├── admin/crawler/       # crawler sources (super-admin API)
│   │   │   ├── public/crawler/      # crawler ingestion (open, X-Crawler-Auth)
│   │   │   ├── user/memory/         # user memory read / refresh
│   │   │   ├── settings/api-keys/   # AI key encrypted storage
│   │   │   ├── reviewers/ reviews/  # reviewers & review workflow
│   │   │   └── cron/daily-hotspot/  # scheduled hot-topic push
│   │   ├── (dashboard)/             # authed route group
│   │   │   ├── home/                # home (editor entry)
│   │   │   ├── documents/           # document management
│   │   │   ├── hotspots/            # hot-topic view (iframe + add-quote)
│   │   │   ├── knowledge/           # knowledge base
│   │   │   ├── quick-draft/         # one-click draft / outline / export / tasks
│   │   │   ├── templates/           # template management
│   │   │   ├── settings/            # system settings
│   │   │   └── account/ trash/      # account / trash
│   │   ├── (auth)/                  # login / register pages
│   │   └── page.tsx                 # official-document editor (home)
│   ├── components/
│   │   ├── editor/                  # TipTap editor + toolbar + footer + extensions
│   │   ├── layout/                  # sidebar / topbar
│   │   ├── settings/                # settings panels
│   │   ├── quick-draft/             # one-click draft components (incl. dual uploader)
│   │   └── ui/                      # shared UI (Dialog / buttons …)
│   ├── server/
│   │   ├── auth/                    # JWT sign/verify, guard, password, permission, super-admin
│   │   ├── db/                      # DB connection + Drizzle schema
│   │   └── lib/                     # AI call, memory extraction utils
│   ├── lib/                         # client utils (markdown, parsing, AI hook …)
│   ├── types/                       # TS types & document-category defs
│   └── middleware.ts                # JWT route guard
├── scripts/                         # SQL init + crawler-key seed script
├── public/fonts/gov/                # embedded official fonts (FangSong/KaiTi/Founder)
├── docs/                            # dev docs
├── crawl_*.py                       # standalone crawler scripts (People's Daily …)
├── .env.example                     # env template (ignored by .gitignore)
└── LICENSE                          # Non-Commercial License
```

---

## 5. Core Modules & Implementation

### 5.1 Authentication & Authorization

- **Session**: after register/login, the server signs a JWT (HS256, key `JWT_SECRET`) via `jose` and writes it into the **HTTP-only Cookie `auth_token`**.
- **Route guard**: `middleware.ts` verifies the Cookie in the Edge Runtime; pages outside `PUBLIC_PATHS` redirect to `/login` when unauthenticated.
- **Server user**: `getServerUser()` reads the token from the Cookie → `verifyToken` → returns `{ id, email, name }`; prints a diagnostic when `JWT_SECRET` is missing (avoids silent "dashboard stuck loading" issues).
- **Password**: `bcryptjs` hashing; email OTP and magic-link (`/auth/magic-link`) supported.
- **Permission model**:
  - `sysSuperAdmin`: super-admin whitelist (written manually or via `seed-crawler-secret.mjs`); gates crawler config, user management, etc.
  - `userPermission` / `adminPermission`: fine-grained feature permissions.
  - Super-admin endpoints use `requireSuperAdmin()`; gated endpoints use `requirePermission()`.

### 5.2 Data Layer

- `src/server/db/index.ts`: `createClient({ url, authToken })` builds the libSQL client; `drizzle(client, { schema })` exposes `db`; the raw `client` is also exported for native SQL (`client.execute({ sql, args })`).
- **Local / prod switch**: only `DATABASE_URL` changes (`file:./data.db` ↔ `libsql://...`); `authToken` is prod-only.
- **Migrations**: `drizzle-kit push` syncs the schema; crawler tables are initialized from `scripts/*.sql`.
- **Multi-tenant isolation**: all business queries carry `WHERE user_id = ?` to prevent cross-user reads.

### 5.3 Official-Document Editor

- **Core**: TipTap 3 (ProseMirror). Custom node extensions (`extensions/`): `DocTitle` (main title), `RedHeader` (red header), `OfficialSeal` (seal), `DocNumber` (doc number), plus footer/signature blocks, rendered as semantically classed block elements.
- **Standard formatting**:
  - `public/fonts/gov/` embeds three standard official fonts (FangSong_GB2312 / KaiTi_GB2312 / Founder XiaoBiaoSong). `editor.css` declares them via `@font-face` with **family names identical to the CSS variables**, so the existing fallback chain hits the embedded font on its first entry — consistent across platforms, independent of whether the OS installed the font.
  - Mapping: body = FangSong; main title = Founder XiaoBiaoSong; H1 = HeiTi; H2 = KaiTi; footnote = FangSong.
- **"Force Render" button**: reads `editor.getHTML()` → `sanitizeGovHtml()` (strips inline `style` / Word junk classes but **preserves a whitelist of official semantic classes** `doc-title` / `doc-number` / `red-header` / `official-seal` …) → `setContent` again, so content truly returns to the CSS standard format.
- **External-content sanitization**: HTML entering from one-click draft / outline, Word import, or paste is all run through `sanitizeGovHtml()` first, preventing inline styles from overriding the official layout.
- **Footer status bar** (`EditorFooterBar`): word count, save state (saved / unsaved + save time), page zoom, shortcut help (device-aware Mac / Windows).

### 5.4 AI Chat & Content Generation

- **Streaming**: `/api/ai/chat` streams via SSE; client `stream-client.ts` + `use-generate.ts` handle connection and token-by-token rendering.
- **systemExtra assembly (core)**:
  - Client side: `userProfile` + `globalSkills` + `categorySkills` + selected `skill` + `referenceContext` (see 5.5).
  - Server side adds: `userMemoryPrompt` (user memory) + `quotationContext` (quotation library, LIMIT 40) + `articleContext` (only when `articleIds` passed).
  - Final `systemExtra = [client block] + userMemory + quotationContext + articleContext`, injected in one place covering editor / knowledge chat / quick draft.
- **Model resolution (resolveModel)**: if the user enabled their own AI key (encrypted, see 5.12) → use it; otherwise fall back to the system MiniCPM.
- **Quotation reference**: every AI chat auto-injects the quotation library; all 11 "Ten-Dimension Writing" built-in Skills append a "quotation reference" note so the AI cites the user's best lines appropriately.

### 5.5 One-Click Draft / Outline (Dual-Reference Upload)

- **Dual dashed upload zones**: below the prompt box on the draft / outline pages, two independent dashed cards (border `#ccc`):
  - Zone 1 【Event Reference】: event materials / notices / raw files / reports / background.
  - Zone 2 【Language & Structure Style Reference】: unit exemplars / templates / standard docs / similar drafts.
- **Real client-side parsing** (`src/lib/ai/parse-reference.ts`, zero server cost):
  - `pdf` → pdfjs-dist; `docx` → mammoth; `jpg/png` → tesseract.js Chinese OCR; `txt/md` → direct read.
  - Heavy deps are **lazy-loaded** (only imported when that format is uploaded), so first paint stays fast; single-file cap 20MB / 6000 chars; legacy `.doc` unsupported (prompt to convert to `.docx`).
- **System-level fixed analysis logic (permanent)**: `src/lib/ai/reference-rules.ts` hard-codes the user-supplied three-stage mandatory rules (event → facts / exemplar → style / fused output) as `REFERENCE_ANALYSIS_RULES`, injected as systemExtra at generation time and not disableable from the UI.
- **Context assembly**: `buildReferenceContext({ eventItems, styleItems, knowledgeText? })` merges 【fixed rules】+【event material text】+【style material text】+ optional 【knowledge base】; also carries Skill / prompt / quotation library / user memory.
- **Source generation**: `/api/ai/generate-from-sources` lets users tick knowledge base / documents / quotations / hot topics, aggregates the material, and asks the LLM to produce a template (JSON) or Skill (Markdown) that can be previewed and saved.

### 5.6 Knowledge Base & Document Management

- **Knowledge base**: `/api/documents?reviewed=true` returns "reviewed" documents as knowledge corpus; AI chat / dual-reference generation can opt to "also cite the knowledge base".
- **Document management**: categorized by document type; `versions` stores a full snapshot per save, enabling diff / rollback; favorites / filter; trash with soft-delete + restore (`documents/[id]/restore` …).
- **Local draft**: auto-saved to localStorage every 30s (with `savedAt`); on cloud conflict a dialog lets the user choose local or cloud.

### 5.7 Quotation Library

- `quotations` table, `sourceType` ∈ {document / knowledge / hotspot / editor / manual}, isolated by `user_id`.
- Deletion goes through `DELETE /api/quotations?id=` (collection route has a DELETE handler) or `/api/quotations/[id]` (path/query compatible).
- On the hot-topic full-text page, selecting text → iframe bubble `postMessage` (`gw-add-quote`) → stored; `onmousedown preventDefault` fixes the selection-collapse issue that made clicks do nothing.

### 5.8 Hot-Topic Feed (Crawler System)

- **Config (super-admin only)**: `admin/crawler/sources` manages sources; `admin/crawler/generate-script` one-click generates a runnable Python crawler (target site, section, ingest URL).
- **Ingestion (open endpoint)**: `public/crawler/upload` authenticates via the `X-Crawler-Auth` header → writes `hotArticle`.
- **Key management**: the crawler ingest key plaintext **never appears in the frontend**; the super-admin configures it on the backend and it is AES-256-GCM encrypted into `sysSecretConfig` (`key_name='crawler_upload'`); `seed-crawler-secret.mjs` seeds it on first run.
- **Frontend**: hot-topic page shows the original article in an iframe preview, editable, "favorite → document", and "select → add quotation".
- **Scheduled push**: `cron/daily-hotspot`, protected by `CRON_SECRET`, emails hot topics to `EMAIL_TO`.

### 5.9 Templates & Writing-Spec Skills

- **Built-in Skills**: `src/lib/builtin-templates.ts` maintains 11 "Ten-Dimension Writing" built-in Skills (notice / report / request / letter / minutes / decision / circular / reply / plan / speech / news), each with structure specs and a quotation-reference note.
- **User templates / Skills**: `templates` / `skills` tables isolated per user; UI supports CRUD; new items can be AI-generated from selected sources.
- **Preference**: `templates/preferred` records the active template & Skill.

### 5.10 User Memory System

- `user/memory` reads / saves the user's AI writing memory (per account).
- `user/memory/refresh` triggers `gatherMemorySources`: aggregates the document library / knowledge base / chat history / **quotation library**, then an LLM extraction prompt (`extract-memory.ts`) summarizes the user's preferred expression style, rhetoric, and argumentation; the result can be reviewed and saved.

### 5.11 Review & Approval

- `reviewers` manages reviewers; `reviews` records the review workflow; the editor's "submit for review" sends the current document for approval.

### 5.12 Settings Center

- **AI Key management** (`settings/api-keys`): user-supplied vendor keys are **AES-256-GCM encrypted** (master key `AI_KEY_SECRET`) before storage; decrypted only on the backend when calling the model; the UI shows only a mask.
- **Profile / preference / crawler / reviewer / user** panels persist to `userProfiles` / `userPreference` / `crawlerSource` / `reviewers` / `users`.

---

## 6. Security Notes (incl. Secret-Leak Scan)

A full security scan of the repository — **including git history** — was performed. Findings:

### ✅ No leak found for

- **Env files not committed**: `.env` / `.env.production` / `.env.example` are all ignored by the `.env*` rule in `.gitignore` and never entered any commit.
- **No hardcoded cloud keys**: AWS Access Keys (`AKIA…`), OpenAI / Anthropic keys (`sk-…` / `sk-ant-…`), GitHub tokens (`ghp_…`), Slack, Firebase, JWT strings, or credentialed DB connection strings — none found in tracked files or history.
- **No private-key files**: no `.pem` / `id_rsa` / `*.key` files in the repo.
- **Correct crypto implementation**: `src/server/auth/secret.ts` and `scripts/seed-crawler-secret.mjs` read the master key only from env vars and AES-256-GCM encrypt/decrypt the crawler key — no hardcoded plaintext.
- **No DB creds in source**: `drizzle.config.ts` and `db/index.ts` both read `process.env.DATABASE_URL`.

### ⚠️ Found & fixed

- **Crawler ingest key was once hard-coded**: in early commits, `crawl_rmrb_today.py` and `scripts/crawler_task_新华网.py` hard-coded the crawler ingest key as a source constant. The value has been **removed in the latest version** and is now read **only from the `CRAWLER_API_KEY` environment variable** (the script errors out if missing).
- **But the value still exists in git history** (~73 historical matches). Since the old value cannot be retracted, you **must rotate the key**:
  1. Generate a brand-new random key (`openssl rand -hex 32`);
  2. Re-seed the encrypted vault:
     ```bash
     CRAWLER_API_KEY="<new-key>" node scripts/seed-crawler-secret.mjs
     ```
  3. Ensure the production `CRAWLER_API_KEY` env var matches the new key; treat the old key as compromised and revoke it immediately.
- (Optional) To fully purge the old value from history, use `git filter-repo` / BFG to rewrite history and force-push — this is destructive; back up and confirm ownership before doing so.

### 🔐 Security best practices (pre-deploy checklist)

- Inject all secrets via env vars / encrypted vault — **never** write them in source or commit them.
- Use strong random values for production `JWT_SECRET` / `AI_KEY_SECRET` / `CRAWLER_MASTER_KEY` (`openssl rand -hex 32` / `openssl rand -base64 32`).
- Consider a pre-commit secret scanner (gitleaks / trufflehog) to prevent future leaks.
- `data.db` (local SQLite with real docs / user data) is git-ignored — do not commit it manually.

---

## 7. Environment Variables

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | DB URL (`file:./data.db` or `libsql://...`) | ✅ |
| `DATABASE_AUTH_TOKEN` | Turso auth token (not needed locally) | Prod ✅ |
| `JWT_SECRET` | JWT signing key (HS256) | ✅ |
| `NEXTAUTH_URL` | Deployment domain | ✅ |
| `AI_KEY_SECRET` | AI key encryption master key (AES-256-GCM) | ✅ |
| `CRAWLER_MASTER_KEY` | Crawler key encryption master (defaults to `JWT_SECRET`) | ❌ |
| `CRAWLER_API_KEY` | Crawler ingest plaintext key (seed only) | ❌ |
| `BREVO_API_KEY` | Brevo email API key (hot-topic push) | ❌ |
| `EMAIL_FROM` / `EMAIL_FROM_NAME` | Sender address / name | ❌ |
| `CRON_SECRET` / `EMAIL_TO` | Cron secret / default recipient | ❌ |

> Copy `.env.example` to `.env` and fill in the table; the defaults in `.env.example` are local-dev placeholders — **replace with strong random values in production**.

---

## 8. Local Dev & Deployment

### Local development

```bash
git clone <your-repo-url>
cd gongwen-os-v2
npm install
cp .env.example .env          # edit as needed
npm run dev                    # http://localhost:3000
```

Initialize the database (full Drizzle sync):

```bash
npx drizzle-kit push
```

Register an account and promote to super-admin:

```bash
sqlite3 data.db "SELECT id, email FROM users;"
sqlite3 data.db "INSERT INTO sys_super_admin (user_id, create_time, remark) VALUES ('your-user-id', strftime('%s','now'), 'project owner');"
```

Configure the crawler key (optional):

```bash
CRAWLER_API_KEY="your-strong-32-byte-key" node scripts/seed-crawler-secret.mjs
```

### Production (Vercel + Turso + Cloudflare)

1. Push to GitHub → import into Vercel (Framework: Next.js, auto-detected).
2. Set all variables from section 7 in Vercel **Environment Variables**.
3. Create a Turso DB → `drizzle-kit push` → run the seed script.
4. Cloudflare domain → Nameserver → CNAME to `cname.vercel-dns.com`; bind in Vercel Domains → auto SSL.
5. Every `git push` triggers an automatic build & deploy.

---

## License

This project is released under a **Non-Commercial License**. Core terms:

- ✅ Permitted: personal learning, research, internal non-profit use, reading and modifying the source.
- ❌ Prohibited: any commercial use (including but not limited to SaaS resale, API resale, paid repackaging, profit-driven internal commercial deployment, or offering this system as part of a commercial product or service).
- Copyright and attribution are retained; commercial licensing requires the author's **written permission**.

Full terms are in the [`LICENSE`](./LICENSE) file at the repo root (Chinese & English).

---

<p align="center">
  <a href="./README.md">🇨🇳 中文</a> &nbsp;·&nbsp;
  <a href="./README_EN.md"><strong>🇺🇸 English</strong></a>
</p>
