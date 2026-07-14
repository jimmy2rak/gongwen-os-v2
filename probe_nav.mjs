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

const events = [];
page.on("framenavigated", (f) => { if (f === page.mainFrame()) events.push(`[nav] ${f.url()}`); });
page.on("load", () => events.push(`[load] ${page.url()}`));
page.on("domcontentloaded", () => events.push(`[dcl] ${page.url()}`));
page.on("response", (r) => {
  const u = r.url();
  if (u.endsWith("/api/auth/me")) events.push(`[resp auth/me] ${r.status()}`);
});

await page.goto(`https://${DOMAIN}/`, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
await page.waitForTimeout(10000);
console.log("===== 导航/加载事件 (10s) =====");
for (const e of events) console.log(e);
console.log("总计事件:", events.length);
await browser.close();
