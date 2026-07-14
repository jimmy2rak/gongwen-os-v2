import { chromium } from "playwright";
import { readFileSync } from "fs";

const jar = readFileSync("/tmp/probe_cookies.txt", "utf8");
const token = jar.match(/auth_token\s+(\S+)/)?.[1];
const DOMAIN = "gongwenos.182183.xyz";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
await ctx.addCookies([
  { name: "auth_token", value: token, domain: DOMAIN, path: "/", httpOnly: true, sameSite: "Lax" },
]);
const page = await ctx.newPage();

const counters = {};
const errors = [];
page.on("request", (req) => {
  const u = req.url();
  for (const key of ["/api/skills", "/api/settings/api-keys", "/api/auth/me"]) {
    if (u.includes(key)) counters[key] = (counters[key] || 0) + 1;
  }
});
page.on("console", (m) => {
  const t = m.text();
  if (/error|Maximum update depth|Warning/i.test(t)) errors.push(`[${m.type()}] ${t}`);
});
page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));

await page.goto(`https://${DOMAIN}/`, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
await page.waitForTimeout(10000);

console.log("===== 10秒内请求次数统计 =====");
for (const k of Object.keys(counters)) console.log(`  ${k}: ${counters[k]} 次`);
console.log("===== 控制台错误/警告 (前20) =====");
console.log(errors.slice(0, 20).join("\n") || "（无）");
await browser.close();
