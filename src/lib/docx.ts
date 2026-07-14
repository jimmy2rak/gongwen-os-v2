// ─── docx → HTML 解析（浏览器端）──────────────────
// 使用 mammoth 浏览器构建将 .docx 转为 HTML，供编辑器/文档管理/知识库复用。

export interface DocxParseResult {
  html: string;
  title: string;
}

/**
 * 解析一个 .docx 文件为 HTML 字符串。
 * 失败时抛出 Error（调用方负责提示）。
 */
export async function parseDocxFile(file: File): Promise<DocxParseResult> {
  if (!file) throw new Error("未选择文件");
  const name = file.name || "导入文档";
  const title = name.replace(/\.docx?$/i, "").trim() || "导入文档";

  // 动态引入浏览器版 mammoth，避免拖累主包 / 触发 SSR
  const mod: any = await import("mammoth/mammoth.browser");
  const mammoth = mod.default || mod;

  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });

  // result.messages 可能包含告警，忽略；value 为 HTML
  const html = (result && result.value) ? String(result.value) : "<p></p>";
  return { html, title };
}
