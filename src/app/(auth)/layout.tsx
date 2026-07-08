// ─── 认证页面布局 ──────────────────────────────────
// 登录页、注册页共享的布局（没有 Sidebar 的完整页面）

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
