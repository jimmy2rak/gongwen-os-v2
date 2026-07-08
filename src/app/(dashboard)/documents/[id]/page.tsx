// ─── /documents/[id] — 重定向到编辑器并加载文档 ──
// 跳转到首页（编辑器），携带 ?edit=id 参数
// 首页的 useEffect 会读取该参数并加载文档

import { redirect } from "next/navigation";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/?edit=${id}`);
}
