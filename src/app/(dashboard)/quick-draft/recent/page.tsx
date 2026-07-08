// ─── 一键初稿 · 最近文稿 ────────────────────────

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, ExternalLink, Clock } from "lucide-react";
import { getCategoryColor } from "@/types";

interface DocItem {
  id: string;
  title: string;
  category: string;
  updatedAt: number;
}

function fmt(ts: number) {
  if (!ts) return "";
  const t = ts < 1e12 ? ts * 1000 : ts;
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function RecentPage() {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/documents?pageSize=30")
      .then((r) => r.json())
      .then((b) => {
        if (b.success) setDocs(b.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-800 mb-1">最近文稿</h2>
      <p className="text-xs text-gray-400 mb-5">最近编辑的公文文档</p>

      {loading ? (
        <p className="text-xs text-gray-400">加载中…</p>
      ) : docs.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <p className="text-xs text-gray-400">暂无文档</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <Link
              key={d.id}
              href={`/documents/${d.id}`}
              className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white hover:border-red-300 hover:shadow-sm transition-all"
            >
              <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-gray-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-gray-800 truncate">{d.title}</div>
                <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: getCategoryColor(d.category) }} />
                  {d.category} · <Clock className="w-3 h-3" /> {fmt(d.updatedAt)}
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-300" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
