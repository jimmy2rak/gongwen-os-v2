import { createClient } from "@libsql/client";

const url = process.env.DATABASE_URL;
const token = process.env.DATABASE_AUTH_TOKEN;

if (!url) {
  console.error("缺少 DATABASE_URL");
  process.exit(1);
}

const client = createClient({ url, authToken: token });

async function main() {
  try {
    try {
      await client.execute("ALTER TABLE api_keys ADD COLUMN base_url text");
      console.log("✅ 已添加 base_url 列");
    } catch (e) {
      if (e.message && e.message.toLowerCase().includes("duplicate column")) {
        console.log("ℹ️ base_url 列已存在，跳过");
      } else {
        throw e;
      }
    }
  } finally {
    await client.close();
  }
}

main().catch((e) => {
  console.error("迁移失败:", e);
  process.exit(1);
});
