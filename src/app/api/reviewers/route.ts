// ─── GET|POST /api/reviewers — 审阅人管理 ─────────
// GET:  返回审阅人列表（从数据库读取，向下兼容 localStorage）
// POST: 新增/同步审阅人

import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/server/auth/guard";

// 默认审阅人
const DEFAULT_REVIEWERS = [
  { id: "r1", name: "张主任", department: "办公室" },
  { id: "r2", name: "李副主任", department: "办公室" },
  { id: "r3", name: "王科长", department: "综合科" },
  { id: "r4", name: "赵副科长", department: "综合科" },
];

export async function GET() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "未登录" } },
      { status: 401 }
    );
  }

  // 返回默认审阅人（后续可扩展为数据库存储）
  return NextResponse.json({ success: true, data: DEFAULT_REVIEWERS });
}
