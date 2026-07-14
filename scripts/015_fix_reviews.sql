-- ─── 015 修复 reviews 表 schema 漂移 + 错误外键 ─────────────
-- 问题：
--   1) 生产库 reviews 表仍是旧结构（status 列、reviewer_id→users 外键），
--      而代码 schema(reviews.ts) 已改为 review_status/reviewer_name/department/operated_at。
--   2) reviewer_id 被设成 → users.id 外键，但「审阅人」是独立实体(reviewers 表)，
--      并非应用用户，导致 POST /api/reviews 因 FK 校验失败返回 500。
-- 修复：重建 reviews 表，去掉 reviewer_id 对 users 的外键（改为自由文本），
--       对齐到最新 schema；旧数据 status→review_status，reviewer_name 从 users 表回填。

CREATE TABLE reviews_new (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL DEFAULT '',
  reviewer_name TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  review_status TEXT NOT NULL DEFAULT 'pending',
  comment TEXT DEFAULT '',
  operated_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO reviews_new (
  id, document_id, reviewer_id, reviewer_name, department,
  review_status, comment, operated_at, created_at, updated_at
)
SELECT
  r.id,
  r.document_id,
  r.reviewer_id,
  COALESCE(u.name, ''),
  '',
  r.status,
  r.comment,
  NULL,
  r.created_at,
  r.updated_at
FROM reviews r
LEFT JOIN users u ON r.reviewer_id = u.id;

DROP TABLE reviews;

ALTER TABLE reviews_new RENAME TO reviews;

CREATE INDEX IF NOT EXISTS idx_reviews_document_id ON reviews(document_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_id);
