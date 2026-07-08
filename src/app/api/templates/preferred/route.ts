// ─── PUT /api/templates/preferred — 设置首选模板 ─
import { NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/server/auth/guard";
import { client } from "@/server/db";

export async function PUT(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id } = body; // null = 清除首选

    await client.execute({
      sql: "UPDATE users SET preferred_template_id = ? WHERE id = ?",
      args: [id || null, user.id],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Preferred PUT] Error:", error);
    return NextResponse.json({ success: false, error: { message: "设置首选模板失败" } }, { status: 500 });
  }
}
