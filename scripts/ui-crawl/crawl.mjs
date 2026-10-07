import { chromium } from "playwright";
const BASE = "http://localhost:3005";
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: "state.json" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(`${page.url()} :: ${e.message}`));
const shot = async (name, full = true) => { await page.screenshot({ path: `shots/${name}.png`, fullPage: full }); console.log("shot", name, page.url()); };
const go = async (name, path, wait = 4500) => {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(wait);
  await shot(name);
};
const tryClick = async (sel, name, wait = 1500) => {
  try { await page.locator(sel).first().click({ timeout: 4000 }); await page.waitForTimeout(wait); await shot(name, false); await page.keyboard.press("Escape"); await page.waitForTimeout(500); }
  catch (e) { console.log("skip", name, e.message.split("\n")[0]); }
};
const routes = [
  ["dashboard", "/dashboard"], ["clients", "/clients"], ["metrics", "/metrics"], ["alerts", "/alerts"],
  ["sales-hub", "/Sales-Hub"], ["contacts", "/contacts"], ["campaigns", "/campaigns"], ["ask-birdy", "/ask-birdy"],
  ["settings", "/settings"], ["settings-integrations", "/settings?tab=integrations"], ["settings-billing", "/settings?tab=billing"], ["settings-tracking", "/settings?tab=tracking"],
  ["billing", "/billing"], ["credits-redirect", "/credits"], ["changelog", "/changelog"], ["terms", "/billing/terms-of-service"], ["notfound", "/does-not-exist"],
];
for (const [n, p] of routes) { try { await go(n, p); } catch (e) { console.log("fail", n, e.message.split("\n")[0]); } }

// interactions
await go("alerts-2", "/alerts", 3000);
await tryClick('button:has-text("Create Alert")', "alerts-create-dialog", 1800);
await tryClick('[role="tab"]:has-text("Triggered"), button:has-text("Triggered")', "alerts-triggered", 1500);
await go("dash-2", "/dashboard", 3000);
await tryClick('button[aria-label*="otification" i]', "notifications", 1200);
await tryClick('header button:has([class*="avatar" i]), header [data-slot="dropdown-menu-trigger"]', "user-menu", 1200);
await page.locator('input[aria-label="Ask Birdy"]').fill("Which client has the worst CPL this week?").catch(() => {});
await page.keyboard.press("Enter").catch(() => {});
await page.waitForTimeout(1800); await shot("chat-modal-thinking", false);
await page.waitForTimeout(15000); await shot("chat-modal-answer", false);
await page.keyboard.press("Escape");
// first client detail
await go("clients-2", "/clients", 3000);
const href = await page.locator('a[href^="/clients/"]').first().getAttribute("href").catch(() => null);
if (href) { await go("client-detail", href); await tryClick('[role="tab"]:has-text("Settings")', "client-detail-settings", 1500); }
await tryClick('button:has-text("Add Client"), button:has-text("Add client")', "clients-add-wizard", 1500);
console.log("ERRORS", JSON.stringify(errors, null, 1));
await browser.close();
