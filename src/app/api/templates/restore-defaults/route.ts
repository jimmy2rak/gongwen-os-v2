// ─── POST /api/templates/restore-defaults — 恢复默认 ─
// 清空用户所有自定义模板 + 清除首选
import { NextResponse } from "next/server";
import { getServerUser } from "@/server/auth/guard";
import { client } from "@/server/db";

export async function POST() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { message: "未登录" } }, { status: 401 });
  }

  try {
    // 删除用户所有自定义模板
    await client.execute({
      sql: "DELETE FROM templates WHERE user_id = ? AND type = 'custom'",
      args: [user.id],
    });

    // 清除首选
    await client.execute({
      sql: "UPDATE users SET preferred_template_id = NULL WHERE id = ?",
      args: [user.id],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[RestoreDefaults POST] Error:", error);
    return NextResponse.json({ success: false, error: { message: "恢复默认失败" } }, { status: 500 });
  }
}
