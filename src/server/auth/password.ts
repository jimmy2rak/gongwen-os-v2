// ─── 密码哈希和比对 ──────────────────────────────
// 使用 bcryptjs（纯 JS 实现，无原生依赖）

import bcrypt from "bcryptjs";

/** 密码哈希（salt rounds = 12，越高越安全但越慢） */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/** 密码比对：验证输入的密码是否匹配已存储的哈希 */
export async function comparePassword(
  password: string,
  hashed: string
): Promise<boolean> {
  return bcrypt.compare(password, hashed);
}
