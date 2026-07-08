import { createHash, randomBytes, createCipheriv } from "crypto";
import { createClient } from "@libsql/client";

const url = process.env.DATABASE_URL;
const token = process.env.DATABASE_AUTH_TOKEN;

if (!url) {
  console.error("缺少 DATABASE_URL");
  process.exit(1);
}

function getMasterKey() {
  const raw = process.env.CRAWLER_MASTER_KEY || process.env.JWT_SECRET;
  if (!raw) throw new Error("缺少 CRAWLER_MASTER_KEY / JWT_SECRET");
  return createHash("sha256").update(raw).digest();
}

function encryptSecret(plain) {
  const key = getMasterKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

const client = createClient({ url, authToken: token });

const DEFAULT_MINICPM_KEY = "lis_sk_298cf78155f231c7_DkrDcNLHnK8dJRnfFrJCd4JGDbBLMkHrC3T-wLpvC9zy0BPemsyFuQ";

const cfg = {
  id: "system:minicpm",
  provider: "minicpm",
  label: "MiniCPM (面壁智能) · 系统默认",
  baseUrl: "https://api.modelbest.co/v1",
  apiKey: DEFAULT_MINICPM_KEY,
  models: ["MiniCPM-V-4.6-Instruct", "MiniCPM-V-4.6-Thinking", "MiniCPM-o-4.5"],
  defaultModel: "MiniCPM-V-4.6-Instruct",
  isActive: true,
  isSystem: true,
  createdAt: Math.floor(Date.now() / 1000),
  updatedAt: Math.floor(Date.now() / 1000),
};

async function main() {
  try {
    const existing = await client.execute({
      sql: "SELECT id FROM sys_secret_config WHERE key_name = 'minicpm_default_api' LIMIT 1",
      args: [],
    });
    const now = Math.floor(Date.now() / 1000);
    const enc = encryptSecret(JSON.stringify(cfg));
    if (existing.rows.length > 0) {
      await client.execute({
        sql: "UPDATE sys_secret_config SET encrypted_value = ?, algorithm = ?, update_time = ? WHERE key_name = ?",
        args: [enc, "aes-256-gcm", now, "minicpm_default_api"],
      });
      console.log("✅ 已更新系统默认 MiniCPM 配置");
    } else {
      await client.execute({
        sql: "INSERT INTO sys_secret_config (key_name, encrypted_value, algorithm, create_time, update_time) VALUES (?, ?, ?, ?, ?)",
        args: ["minicpm_default_api", enc, "aes-256-gcm", now, now],
      });
      console.log("✅ 已创建系统默认 MiniCPM 配置");
    }
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error("种子失败:", e);
  process.exit(1);
});
