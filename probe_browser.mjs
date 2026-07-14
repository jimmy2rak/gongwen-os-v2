import { chromium } from "playwright";
import { readFileSync } from "fs";

// 从 curl cookie jar 读取 auth_token
const jar = readFileSync("/tmp/probe_cookies.txt", "utf8");
const m = jar.match(/auth_token\s+(\S+)/);
const token = m ? m[1] : null;
if (!token) { console.error("未找到 auth_token"); process.exit(1); }

const DOMAIN = "gongwenos.182183.xyz";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true });

// 注入有效 cookie（HttpOnly 由服务端设置，这里仅模拟已登录态）
await ctx.addCookies([
  { name: "auth_token", value: token, domain: DOMAIN, path: "/", httpOnly: true, sameSite: "Lax" },
]);

const page = await ctx.newPage();

const consoleMsgs = [];
const failedReqs = [];
const apiMe = { status: null, body: null, time: null };

page.on("console", (msg) => {
  consoleMsgs.push(`[${msg.type()}] ${msg.text()}`);
});
page.on("pageerror", (err) => {
  consoleMsgs.push(`[pageerror] ${err.message}`);
});
page.on("requestfailed", (req) => {
  failedReqs.push(`${req.method()} ${req.url()} -> ${req.failure()?.errorText}`);
});

const t0 = Date.now();
await page.goto(`https://${DOMAIN}/`, { waitUntil: "networkidle", timeout: 30000 }).catch((e) => {
  consoleMsgs.push(`[goto-error] ${e.message}`);
});
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

// 抓取 /api/auth/me 响应
const meReq = page.request;
try {
  const r = await meReq.get(`https://${DOMAIN}/api/auth/me`);
  apiMe.status = r.status();
  apiMe.body = (await r.text()).slice(0, 300);
} catch (e) {
  apiMe.status = "ERR";
  apiMe.body = e.message;
}

const finalUrl = page.url();
const bodyText = (await page.evaluate(() => document.body?.innerText || "")).slice(0, 500);
const hasLoading = (await page.evaluate(() => document.body?.innerText?.includes("加载中"))) || false;

await page.screenshot({ path: "/tmp/probe_editor.png", fullPage: false });

console.log("===== 无头浏览器测试结果 =====");
console.log("访问 URL        : /");
console.log("最终 URL        :", finalUrl);
console.log("加载耗时        :", elapsed + "s");
console.log("页面含'加载中'  :", hasLoading);
console.log("--- /api/auth/me (用同一 cookie) ---");
console.log("  status:", apiMe.status);
console.log("  body  :", apiMe.body);
console.log("--- 页面正文片段 ---");
console.log(bodyText);
console.log("--- 控制台/页面错误 (前30条) ---");
console.log(consoleMsgs.slice(0, 30).join("\n") || "（无）");
console.log("--- 失败请求 ---");
console.log(failedReqs.slice(0, 15).join("\n") || "（无）");
console.log("截图已保存: /tmp/probe_editor.png");

await browser.close();
