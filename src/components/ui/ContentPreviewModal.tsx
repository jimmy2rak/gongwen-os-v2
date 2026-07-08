// ─── 内容预览弹窗 ─────────────────────────────
// 用于预览模板/Skill 内容（渲染为格式化文本）

"use client";

import { X, FileText, Sparkles } from "lucide-react";

interface PreviewData {
  title: string;
  content: string;
  type: "template" | "skill";
  category?: string;
}

export function ContentPreviewModal({ data, onClose }: {
  data: PreviewData | null;
  onClose: () => void;
}) {
  if (!data) return null;

  // 尝试格式化内容：如果是 JSON，解析后转为可读格式
  let displayContent = data.content;
  try {
    const parsed = JSON.parse(data.content);
    if (parsed && typeof parsed === "object") {
      if (parsed.titlePattern) {
        // 模板 JSON
        const lines: string[] = [];
        lines.push(`# ${data.title}`);
        lines.push(`\n## 标题模式\n${parsed.titlePattern}`);
        if (parsed.sections?.length) {
          lines.push(`\n## 必备章节（${parsed.sections.length} 项）`);
          parsed.sections.forEach((s: string, i: number) => {
            lines.push(`${i + 1}. ${s}`);
            if (parsed.sectionSamples?.[i]) {
              lines.push(`   > ${parsed.sectionSamples[i].slice(0, 80)}...`);
            }
          });
        }
        if (parsed.structureHint) {
          lines.push(`\n## 结构提示\n${parsed.structureHint}`);
        }
        if (parsed.formatRules?.length) {
          lines.push(`\n## 格式要求`);
          parsed.formatRules.forEach((r: string) => lines.push(`- ${r}`));
        }
        displayContent = lines.join("\n");
      } else if (Array.isArray(parsed)) {
        // Skill 数组
        displayContent = parsed.map((item, i) => `${i + 1}. ${item}`).join("\n");
      } else {
        displayContent = JSON.stringify(parsed, null, 2);
      }
    }
  } catch {
    // 纯文本直接显示
  }

  // 美化纯文本中的 markdown 标记
  const formatted = displayContent
    .replace(/【([^】]+)】/g, "**[$1]**")
    .replace(/\n{3,}/g, "\n\n");

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[600px] max-w-[90vw] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            {data.type === "template" ? (
              <FileText className="w-4 h-4 text-blue-500" />
            ) : (
              <Sparkles className="w-4 h-4 text-amber-500" />
            )}
            <h3 className="text-sm font-semibold text-gray-800">{data.title}</h3>
            {data.category && (
              <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{data.category}</span>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <pre className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-sans">{formatted}</pre>
        </div>

        {/* 底部 */}
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end flex-shrink-0">
          <button onClick={onClose}
            className="px-4 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">关闭</button>
        </div>
      </div>
    </div>
  );
}
