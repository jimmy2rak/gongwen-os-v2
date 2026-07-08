// ─── AI 厂商预设 ─────────────────────────────────
// 8 家预设厂商，均走 OpenAI 兼容 /chat/completions 接口（stream 模式）。
export interface ProviderPreset {
  id: string;
  label: string;
  baseURL: string;
  models: string[];
  openaiCompatible: boolean;
}

export const AI_PROVIDERS: ProviderPreset[] = [
  {
    id: "deepseek",
    label: "DeepSeek",
    baseURL: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-reasoner"],
    openaiCompatible: true,
  },
  {
    id: "doubao",
    label: "豆包 (火山方舟)",
    baseURL: "https://ark.cn-beijing.volces.com/api/v3",
    models: ["doubao-pro-32k", "doubao-pro-256k"],
    openaiCompatible: true,
  },
  {
    id: "openai",
    label: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    models: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
    openaiCompatible: true,
  },
  {
    id: "qwen",
    label: "通义千问",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["qwen-plus", "qwen-max", "qwen-turbo"],
    openaiCompatible: true,
  },
  {
    id: "kimi",
    label: "Kimi (Moonshot)",
    baseURL: "https://api.moonshot.cn/v1",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
    openaiCompatible: true,
  },
  {
    id: "glm",
    label: "智谱 GLM",
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    models: ["glm-4-plus", "glm-4-air", "glm-4-flash"],
    openaiCompatible: true,
  },
  {
    id: "nvidia",
    label: "NVIDIA",
    baseURL: "https://integrate.api.nvidia.com/v1",
    models: [
      "nvidia/llama-3.1-nemotron-70b-instruct",
      "nvidia/mistral-nemo-minitron-8b-base",
      "nvidia/mixtral-8x22b-instruct-v0.1",
    ],
    openaiCompatible: true,
  },
  {
    id: "minicpm",
    label: "MiniCPM (面壁智能)",
    baseURL: "https://api.modelbest.co/v1",
    models: [
      "MiniCPM-V-4.6-Instruct",
      "MiniCPM-V-4.6-Thinking",
      "MiniCPM-o-4.5",
    ],
    openaiCompatible: true,
  },
];

const PROVIDER_MAP = new Map(AI_PROVIDERS.map((p) => [p.id, p]));

export function getProvider(id: string): ProviderPreset | undefined {
  return PROVIDER_MAP.get(id);
}

export function isValidProvider(id: string): boolean {
  return PROVIDER_MAP.has(id);
}
