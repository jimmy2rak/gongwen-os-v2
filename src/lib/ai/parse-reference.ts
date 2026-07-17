// ─── 参考文件解析（客户端） ──────────────────────────
// 一键初稿 / 大纲的「双资料上传区」：将用户上传的参考文件解析为纯文本，
// 供 AI 真实读取、学习、复用（事件事实 / 文风结构）。
//
// 支持格式：pdf / docx / doc(尽力) / txt / md / jpg / png(ocr)
// 设计：重依赖（pdfjs-dist / tesseract.js / mammoth）全部动态 import，
// 仅在用户真正上传对应格式时才加载，避免污染首屏 bundle。
// 文本截断到 MAX_FILE_CHARS，防止单份资料撑爆上下文。

"use client";

export const ALLOWED_EXT = ["pdf", "docx", "doc", "txt", "md", "jpg", "jpeg", "png"] as const;
export type AllowedExt = (typeof ALLOWED_EXT)[number];

/** 单份资料解析后注入提示词的最大字符数 */
export const MAX_FILE_CHARS = 6000;

/** 单份文件的原始大小上限（20MB），超出直接拒绝，避免内存压力 */
const MAX_FILE_BYTES = 20 * 1024 * 1024;

export interface ParsedRef {
  /** 原始文件名 */
  name: string;
  /** 解析出的纯文本（截断后） */
  text: string;
  /** 解析失败信息（有则前端展示，不阻断其他文件） */
  error?: string;
  /** 是否被截断 */
  truncated?: boolean;
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function isAllowedFile(name: string): boolean {
  return (ALLOWED_EXT as readonly string[]).includes(extOf(name));
}

function truncate(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_FILE_CHARS) return { text, truncated: false };
  return { text: text.slice(0, MAX_FILE_CHARS) + "\n…（内容过长已截断）", truncated: true };
}

async function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

/** 解析 txt / md（直接文本） */
async function parsePlain(file: File): Promise<string> {
  return await file.text();
}

/** 解析 docx（mammoth，已安装） */
async function parseDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const res = await mammoth.extractRawText({ arrayBuffer });
  return res.value || "";
}

/** 解析 pdf（pdfjs-dist，动态加载；worker 走 CDN 以匹配版本） */
async function parsePdf(file: File): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const arrayBuffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((it: any) => ("str" in it ? it.str : "")).join(" ");
    pages.push(strings);
  }
  return pages.join("\n\n").replace(/\s+\n/g, "\n").trim();
}

/** OCR 解析 jpg / png（tesseract.js，动态加载；语言数据走 CDN） */
async function parseImageOcr(file: File, onProgress?: (p: number) => void): Promise<string> {
  const Tesseract: any = await import("tesseract.js");
  const dataUrl = await fileToDataURL(file);
  const worker = await Tesseract.createWorker("chi_sim+eng", 1, {
    logger: (m: any) => {
      if (m?.status === "recognizing text" && typeof m.progress === "number") onProgress?.(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(dataUrl);
    return data.text || "";
  } finally {
    await worker.terminate();
  }
}

/**
 * 解析单个参考文件为纯文本。
 * 失败时不抛出，返回 { error }，由调用方决定提示方式。
 */
export async function parseReferenceFile(
  file: File,
  onProgress?: (p: number) => void
): Promise<ParsedRef> {
  const name = file.name;
  const ext = extOf(name);

  if (!isAllowedFile(name)) {
    return { name, text: "", error: `不支持的格式 .${ext}（支持 pdf/docx/doc/txt/md/jpg/png）` };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { name, text: "", error: `文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），上限 20MB` };
  }

  try {
    let raw = "";
    switch (ext) {
      case "txt":
      case "md":
        raw = await parsePlain(file);
        break;
      case "docx":
        raw = await parseDocx(file);
        break;
      case "pdf":
        raw = await parsePdf(file);
        break;
      case "jpg":
      case "jpeg":
      case "png":
        raw = await parseImageOcr(file, onProgress);
        break;
      case "doc":
        // 旧版二进制 .doc 无可靠纯前端解析库，提示转换
        return {
          name,
          text: "",
          error: "旧版 .doc 二进制格式暂不支持，请用 Word「另存为 .docx」后重新上传",
        };
      default:
        return { name, text: "", error: `不支持的格式 .${ext}` };
    }

    const cleaned = (raw || "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
    if (!cleaned) {
      return { name, text: "", error: "未能提取到文本内容（可能是扫描件/空白/图片无文字）" };
    }
    const { text, truncated } = truncate(cleaned);
    return { name, text, truncated };
  } catch (e: any) {
    return { name, text: "", error: "解析失败：" + (e?.message || "未知错误") };
  }
}
