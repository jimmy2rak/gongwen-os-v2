-- ═══════════════════════════════════════════════════════════════════
-- 爬虫热点推送系统 · 建表 SQL（兼容 SQLite / MySQL 双语法）
-- 说明：
--   1) 本文件分两段：【SQLite】与【MySQL】，按你的数据库类型选用对应段。
--   2) sys_super_admin 白名单与 sys_secret_config 密钥无任何前端入口，
--      只能由项目负责人在数据库手动执行 SQL（或运行 seed 脚本）写入。
--   3) sys_secret_config.encrypted_value 为 AES-256-GCM 密文，明文密钥
--      通过 scripts/seed-crawler-secret.mjs 生成后写入（见文件末尾注释）。
-- ═══════════════════════════════════════════════════════════════════

-- ┌───────────────────────────【SQLite】───────────────────────────┐
-- 表1：超级管理员白名单
CREATE TABLE IF NOT EXISTS sys_super_admin (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT NOT NULL UNIQUE,
  create_time  INTEGER NOT NULL,
  remark       TEXT
);

-- 表2：爬虫入库 API 密钥（加密存储）
CREATE TABLE IF NOT EXISTS sys_secret_config (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  key_name        TEXT NOT NULL UNIQUE,
  encrypted_value TEXT NOT NULL,
  algorithm       TEXT NOT NULL DEFAULT 'aes-256-gcm',
  create_time     INTEGER NOT NULL,
  update_time     INTEGER NOT NULL
);

-- 表3：爬虫数据源配置
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

-- 表4：爬虫抓取入库后的文章主表
CREATE TABLE IF NOT EXISTS hot_article (
  id           TEXT PRIMARY KEY,
  source_id    TEXT,
  source_name  TEXT,
  column_id    TEXT,
  title        TEXT NOT NULL,
  content_plain TEXT,
  content_html  TEXT,
  page_name    TEXT,
  origin_url   TEXT,
  crawl_date   TEXT,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at   INTEGER NOT NULL
);

-- 索引（提升展示页查询性能）
CREATE INDEX IF NOT EXISTS idx_hot_article_col   ON hot_article(column_id);
CREATE INDEX IF NOT EXISTS idx_hot_article_src   ON hot_article(source_id);
CREATE INDEX IF NOT EXISTS idx_hot_article_date  ON hot_article(crawl_date);
CREATE INDEX IF NOT EXISTS idx_hot_article_pub   ON hot_article(is_published);
CREATE INDEX IF NOT EXISTS idx_crawler_src_en    ON crawler_source(enable);
-- └────────────────────────────────────────────────────────────────┘


-- ┌───────────────────────────【MySQL】────────────────────────────┐
-- 表1：超级管理员白名单
CREATE TABLE IF NOT EXISTS sys_super_admin (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  user_id      VARCHAR(64) NOT NULL UNIQUE,
  create_time  DATETIME NOT NULL,
  remark       VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 表2：爬虫入库 API 密钥（加密存储）
CREATE TABLE IF NOT EXISTS sys_secret_config (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  key_name        VARCHAR(64) NOT NULL UNIQUE,
  encrypted_value TEXT NOT NULL,
  algorithm       VARCHAR(32) NOT NULL DEFAULT 'aes-256-gcm',
  create_time     DATETIME NOT NULL,
  update_time     DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 表3：爬虫数据源配置
CREATE TABLE IF NOT EXISTS crawler_source (
  id              VARCHAR(64) PRIMARY KEY,
  source_name     VARCHAR(128) NOT NULL,
  base_url        VARCHAR(512) NOT NULL,
  target_column_id VARCHAR(64),
  category_tag    VARCHAR(64) NOT NULL DEFAULT '综合',
  enable          TINYINT(1) NOT NULL DEFAULT 1,
  create_by       VARCHAR(64),
  create_time     DATETIME NOT NULL,
  update_time     DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 表4：爬虫抓取入库后的文章主表
CREATE TABLE IF NOT EXISTS hot_article (
  id           VARCHAR(64) PRIMARY KEY,
  source_id    VARCHAR(64),
  source_name  VARCHAR(128),
  column_id    VARCHAR(64),
  title        VARCHAR(512) NOT NULL,
  content_plain MEDIUMTEXT,
  content_html  MEDIUMTEXT,
  page_name    VARCHAR(128),
  origin_url   VARCHAR(512),
  crawl_date   VARCHAR(8),
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  created_at   DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_hot_article_col  ON hot_article(column_id);
CREATE INDEX idx_hot_article_src  ON hot_article(source_id);
CREATE INDEX idx_hot_article_date ON hot_article(crawl_date);
CREATE INDEX idx_hot_article_pub  ON hot_article(is_published);
CREATE INDEX idx_crawler_src_en   ON crawler_source(enable);
-- └────────────────────────────────────────────────────────────────┘


-- ═══════════════════════════════════════════════════════════════════
-- 初始化示范插入语句
-- ═══════════════════════════════════════════════════════════════════

-- ① 超级管理员白名单：把你的超管 user_id 写进去（从 users 表查 id）
--    ⚠️ 此表没有前端入口，只能手动执行。把下面的 'uYOUR_ADMIN_ID' 换成真实 id。
-- SQLite：
INSERT INTO sys_super_admin (user_id, create_time, remark)
VALUES ('uYOUR_ADMIN_ID', strftime('%s','now'), '项目负责人');
-- MySQL：
-- INSERT INTO sys_super_admin (user_id, create_time, remark)
-- VALUES ('uYOUR_ADMIN_ID', NOW(), '项目负责人');

-- ② 爬虫数据源示例（人民日报）：base_url 为版面导航根地址
--    target_column_id 绑定公文栏目（分类名，取自 getAllCategories）
-- SQLite：
INSERT INTO crawler_source (id, source_name, base_url, target_column_id, category_tag, enable, create_by, create_time, update_time)
VALUES ('cs' || substr(lower(hex(randomblob(16))),1,16),
        '人民日报',
        'http://paper.people.com.cn/rmrb/pc/layout',
        '新闻',
        '时政',
        1,
        'uYOUR_ADMIN_ID',
        strftime('%s','now'),
        strftime('%s','now'));
-- MySQL：
-- INSERT INTO crawler_source (id, source_name, base_url, target_column_id, category_tag, enable, create_by, create_time, update_time)
-- VALUES (CONCAT('cs', LEFT(UUID(), 16)), '人民日报',
--         'http://paper.people.com.cn/rmrb/pc/layout', '新闻', '时政', 1,
--         'uYOUR_ADMIN_ID', NOW(), NOW());

-- ③ sys_secret_config.encrypted_value 必须用密文写入，请勿手填明文！
--    运行： node scripts/seed-crawler-secret.mjs
--    该脚本会生成 AES-256-GCM 密文并自动插入一行 key_name='crawler_upload'。
--    （明文密钥来自环境变量 CRAWLER_API_KEY，建议用强随机串）
