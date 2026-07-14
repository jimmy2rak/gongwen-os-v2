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

const reqLog = [];
page.on("request", (req) => {
  reqLog.push({ t: Date.now(), url: req.url(), method: req.method(), status: "PENDING", ended: false });
});
page.on("requestfinished", (req) => {
  const e = reqLog.find((r) => r.url === req.url() && !r.ended);
  if (e) { e.ended = true; e.status = req.response()?.status ?? "?"; e.dur = Date.now() - e.t; }
});
page.on("requestfailed", (req) => {
  const e = reqLog.find((r) => r.url === req.url() && !r.ended);
  if (e) { e.ended = true; e.status = "FAIL:" + (req.failure()?.errorText || ""); }
});
page.on("console", (m) => reqLog.push({ note: `[console.${m.type()}] ${m.text()}` }));
page.on("pageerror", (e) => reqLog.push({ note: `[pageerror] ${e.message}` }));

await page.goto(`https://${DOMAIN}/`, { waitUntil: "domcontentloaded", timeout: 20000 }).catch((e) => {
  reqLog.push({ note: `[goto-error] ${e.message}` });
});
// 等待 12 秒，观察请求是否完成 / 是否有挂起
await page.waitForTimeout(12000);

const finalUrl = page.url();
const bodyText = (await page.evaluate(() => document.body?.innerText || "")).slice(0, 300);
const hasLoading = await page.evaluate(() => document.body?.innerText?.includes("加载中"));

console.log("最终 URL:", finalUrl);
console.log("含'加载中':", hasLoading);
console.log("正文片段:", bodyText);
console.log("\n===== 网络请求明细 (去重 URL) =====");
const seen = new Set();
for (const r of reqLog) {
  if (r.note) { console.log(r.note); continue; }
  const key = r.method + " " + r.url;
  if (seen.has(key) && r.ended) continue;
  seen.add(key);
  const pend = r.ended ? "" : "  <<< 挂起";
  console.log(`${r.method} ${r.url}  -> ${r.status}${r.dur ? " ("+r.dur+"ms)" : ""}${pend}`);
}
await browser.close();
