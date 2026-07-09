// ─── 一键初稿 布局（含二级导航） ─────────────────

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { QuickDraftNav } from "@/components/quick-draft/QuickDraftNav";

export default function QuickDraftLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout title="一键初稿">
      <QuickDraftNav />
      <div className="p-4 md:p-6 max-w-5xl mx-auto w-full">{children}</div>
    </DashboardLayout>
  );
}
