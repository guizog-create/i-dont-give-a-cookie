// End-to-end tests: loads the unpacked extension into Chromium and runs it
// against local fixture pages. Each test gets its own loopback hostname
// (127.0.0.x) so per-site state never leaks between tests.
//
//   npm test                 run all tests
//   npm test -- --perf       also print the main-thread cost benchmark
//   npm test -- --slow       also run slow tests (SPA re-arm, ~40 s)
//   npm test -- onetrust     run tests whose name contains "onetrust"

"use strict";

const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const EXT_DIR = path.resolve(__dirname, "..");
const FIXTURES = path.join(__dirname, "fixtures");
const args = process.argv.slice(2);
const filter = args.find((a) => !a.startsWith("--"));
const runPerf = args.includes("--perf");
const runSlow = args.includes("--slow");

// ─── Fixture server ─────────────────────────────────────────────────────────

function startServer() {
  const server = http.createServer((req, res) => {
    const file = path.join(FIXTURES, path.normalize(new URL(req.url, "http://x").pathname));
    if (!file.startsWith(FIXTURES) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end("not found");
      return;
    }
    const type = file.endsWith(".js") ? "text/javascript" : "text/html; charset=utf-8";
    res.writeHead(200, { "content-type": type }).end(fs.readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, "0.0.0.0", () => resolve(server)));
}

// ─── Browser ────────────────────────────────────────────────────────────────

async function launch(withExtension) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "idgac-"));
  const extArgs = withExtension
    ? [`--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`]
    : [];
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium", // new headless mode, which supports extensions
    headless: true,
    args: ["--no-proxy-server", ...extArgs],
    viewport: { width: 1280, height: 800 },
  });
  let worker = null;
  if (withExtension) {
    worker = context.serviceWorkers()[0] || (await context.waitForEvent("serviceworker"));
  }
  return { context, worker };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeout = 5000, step = 100) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await fn()) return true;
    await sleep(step);
  }
  return false;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

let port;
let hostCounter = 10;
const url = (file, host) => `http://${host || `127.0.0.${hostCounter}`}:${port}/${file}`;
const clicks = (page) => page.evaluate(() => window.__clicks);

const tests = [
  {
    name: "onetrust: accepts once, never clicks settings",
    async run({ page }) {
      await page.goto(url("onetrust.html"));
      await waitFor(async () => (await clicks(page)).accept);
      await sleep(2000);
      const c = await clicks(page);
      expect(c.accept === 1, `accept clicked ${c.accept} time(s), expected exactly 1`);
      expect(!c.settings, "settings button was clicked");
    },
  },
  {
    name: "fade-out banner: accept clicked exactly once",
    async run({ page }) {
      await page.goto(url("fade.html"));
      await waitFor(async () => (await clicks(page)).accept);
      await sleep(3000);
      const c = await clicks(page);
      expect(c.accept === 1, `accept clicked ${c.accept} time(s), expected exactly 1`);
      expect(!c.decline, "decline was clicked");
    },
  },
  {
    name: "shadow DOM (Usercentrics): accepts",
    async run({ page }) {
      await page.goto(url("shadow.html"));
      const ok = await waitFor(async () => (await clicks(page)).direct);
      expect(ok, "accept button inside shadow root was not clicked");
      expect(!(await clicks(page)).deny, "deny was clicked");
    },
  },
  {
    name: "unknown CMP (heuristic): accepts 'Got it', not 'Learn more'",
    async run({ page }) {
      await page.goto(url("heuristic.html"));
      const ok = await waitFor(async () => (await clicks(page)).gotit);
      expect(ok, "'Got it' was not clicked");
      expect(!(await clicks(page)).policy, "policy link was clicked");
    },
  },
  {
    name: "IAB TCF page (Sourcepoint-style, no 'cookie' word): accepts",
    async run({ page }) {
      await page.goto(url("tcf.html"));
      const ok = await waitFor(async () => (await clicks(page)).accept);
      expect(ok, "TCF accept button was not clicked");
      expect(!(await clicks(page)).manage, "manage was clicked");
    },
  },
  {
    name: "the word 'challenge' in an article does not disable the extension",
    async run({ page }) {
      await page.goto(url("challenge.html"));
      const ok = await waitFor(async () => (await clicks(page)).accept);
      expect(ok, "banner not accepted on a page that merely contains 'challenge'");
    },
  },
  {
    name: "does not scroll the page when accepting an in-flow banner",
    async run({ page }) {
      await page.goto(url("footer-notice.html"));
      const ok = await waitFor(async () => (await clicks(page)).ok);
      expect(ok, "in-flow cookie notice was not accepted");
      const y = await page.evaluate(() => window.scrollY);
      expect(y === 0, `page scrolled to y=${y}px`);
    },
  },
  {
    name: "SAFETY: never confirms a destructive alertdialog",
    async run({ page }) {
      await page.goto(url("alertdialog.html"));
      await sleep(3000);
      const c = await clicks(page);
      expect(!c.confirm, "clicked 'Confirm' on 'Delete your account permanently?'");
    },
  },
  {
    name: "SAFETY: never answers a non-cookie 'feedback-banner' (class hint alone)",
    async run({ page }) {
      await page.goto(url("follow.html"));
      await sleep(3000);
      expect(!(await clicks(page)).yes, "clicked 'Yes' in a 'Was this helpful?' banner");
    },
  },
  {
    name: "SAFETY: never clicks 'Book now' ('ok' substring)",
    async run({ page }) {
      await page.goto(url("book.html"));
      await sleep(3000);
      expect(!(await clicks(page)).book, "clicked 'Book now' in a promo bar");
    },
  },
  {
    name: "SAFETY: never agrees to Terms of Service on the user's behalf",
    async run({ page }) {
      await page.goto(url("tos.html"));
      await sleep(3000);
      expect(!(await clicks(page)).agree, "clicked 'I agree' on a sign-up Terms dialog");
    },
  },
  {
    name: "broken CMP: CSS fallback removes the blocking overlay too, bounded clicks",
    async run({ page }) {
      await page.goto(url("cmpbox-dead.html"));
      const topElement = () => page.evaluate(() => {
        const el = document.elementFromPoint(20, 20);
        return el && (el.id || el.className);
      });
      await waitFor(async () => (await topElement()) === "page-btn", 12000);
      await sleep(1000);
      const c = await clicks(page);
      expect((c.yes || 0) <= 3, `dead accept button clicked ${c.yes} times (expected <= 3)`);
      const top = await topElement();
      expect(top === "page-btn", `page is still covered by '${top}'`);
      const boxVisible = await page.evaluate(
        () => getComputedStyle(document.getElementById("cmpbox")).display !== "none");
      expect(!boxVisible, "#cmpbox still visible");
    },
  },
  {
    name: "cross-origin CMP iframe keeps working across many sites",
    async run({ page }) {
      const failures = [];
      for (let i = 0; i < 7; i++) {
        const host = `127.0.0.${100 + i}`;
        await page.goto(url("site.html", host));
        const ok = await waitFor(async () => (await clicks(page))["frame:accept"], 4000);
        if (!ok) failures.push(host);
      }
      expect(!failures.length, `iframe CMP not accepted on site(s): ${failures.join(", ")}`);
    },
  },
  {
    name: "broken CMP iframe: top frame hides the frame, leaves in-content embeds",
    async run({ page }) {
      await page.goto(url("site-dead.html"));
      const wrapperHidden = () => page.evaluate(
        () => getComputedStyle(document.getElementById("sp_wrapper")).display === "none");
      const ok = await waitFor(wrapperHidden, 15000);
      expect(ok, "floating CMP iframe still covers the page");
      const embedShown = await page.evaluate(
        () => getComputedStyle(document.getElementById("embed")).display !== "none");
      expect(embedShown, "in-content iframe from the same origin was hidden too");
    },
  },
  {
    name: "blocklist also applies to CMP iframes inside the blocked site",
    async run({ page, worker }) {
      const host = `127.0.0.${hostCounter}`;
      await worker.evaluate((h) => chrome.storage.local.set({ blocklist: [h] }), host);
      await page.goto(url("site.html", host));
      await sleep(3000);
      const c = await clicks(page);
      expect(!c["frame:accept"], "CMP iframe accepted on a blocked site");
    },
  },
  {
    name: "CMP API: uses OneTrust.AllowAll() when the banner is showing",
    async run({ page }) {
      await page.goto(url("api-onetrust.html"));
      const ok = await waitFor(async () => (await clicks(page)).api);
      expect(ok, "OneTrust.AllowAll() was not called");
      await sleep(1500);
      const c = await clicks(page);
      expect(c.api === 1, `AllowAll() called ${c.api} times, expected 1`);
      expect(!c.button, "clicked the button even though the API worked");
    },
  },
  {
    name: "CMP API: falls back to clicking when the API doesn't close the banner",
    async run({ page }) {
      await page.goto(url("api-noop.html"));
      const ok = await waitFor(async () => (await clicks(page)).button, 6000);
      const c = await clicks(page);
      expect(c.api === 1, `Didomi API called ${c.api} times, expected 1`);
      expect(ok && c.button === 1, `button clicked ${c.button} times, expected 1`);
    },
  },
  {
    name: "popup: Block covers the registrable domain, Allow undoes it",
    async run({ page, worker }) {
      const extId = new URL(worker.url()).host;
      // The popup reads the active tab; point it at a pretend news.bbc.co.uk tab
      await page.addInitScript(() => {
        chrome.tabs.query = async () => [{ id: 999999, url: "https://news.bbc.co.uk/article" }];
      });
      await page.goto(`chrome-extension://${extId}/popup.html`);
      await waitFor(async () => (await page.textContent("#blockSiteBtn")) === "Block bbc.co.uk", 3000);
      expect((await page.textContent("#blockSiteBtn")) === "Block bbc.co.uk",
        `button says "${await page.textContent("#blockSiteBtn")}"`);
      await page.click("#blockSiteBtn");
      await waitFor(async () => (await worker.evaluate(() => chrome.storage.local.get("blocklist"))).blocklist.length, 3000);
      let { blocklist } = await worker.evaluate(() => chrome.storage.local.get("blocklist"));
      expect(JSON.stringify(blocklist) === '["bbc.co.uk"]', `blocklist is ${JSON.stringify(blocklist)}`);
      await page.click("#allowSiteBtn");
      await waitFor(async () => !(await worker.evaluate(() => chrome.storage.local.get("blocklist"))).blocklist.length, 3000);
      ({ blocklist } = await worker.evaluate(() => chrome.storage.local.get("blocklist")));
      expect(!blocklist.length, `Allow left ${JSON.stringify(blocklist)}`);
    },
  },
  {
    name: "SAFETY: never calls a CMP API when its banner isn't showing",
    async run({ page }) {
      await page.goto(url("api-hidden.html"));
      await sleep(3000);
      expect(!(await clicks(page)).api, "overrode a prior choice via OneTrust.AllowAll()");
    },
  },
  {
    name: "loop guard: stops clicking when a site reloads and re-shows the banner",
    async run({ page }) {
      await page.goto(url("reload-loop.html"));
      await sleep(10000);
      const n = Number(await page.evaluate(() => sessionStorage.n || 0));
      expect(n >= 1, "banner was never accepted");
      expect(n <= 6, `accepted ${n} times in 10 s: no loop protection`);
    },
  },
  {
    name: "migration: folds v2.1 per-host keys into the stats object",
    async run({ worker }) {
      await worker.evaluate(() => chrome.storage.local.set({
        totalDismissed: 9,
        "__IDGAC__www.example.com": { count: 3, ts: 1 },
        "__IDGAC__cdn.privacy-mgmt.com": { count: 5, ts: 2 },
      }));
      await worker.evaluate(() => migrateLegacyStorage());
      const all = await worker.evaluate(() => chrome.storage.local.get(null));
      expect(!Object.keys(all).some((k) => k.startsWith("__IDGAC__")), "legacy keys not removed");
      expect(all.totalDismissed === undefined, "totalDismissed not removed");
      expect(all.stats && all.stats.total === 9, `total is ${all.stats && all.stats.total}, expected 9`);
      expect(all.stats.sites["example.com"].count === 3, "per-site count lost");
    },
  },
  {
    name: "popup renders stats without errors",
    async run({ page, worker }) {
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await worker.evaluate(() => chrome.storage.local.set({
        stats: { total: 42, cssFallback: 0, sites: { "a.com": { count: 40, last: 1 }, "b.com": { count: 2, last: 1 } } },
      }));
      const extId = new URL(worker.url()).host;
      await page.goto(`chrome-extension://${extId}/popup.html`);
      await waitFor(async () => (await page.textContent("#totalDismissed")) === "42", 3000);
      expect((await page.textContent("#totalDismissed")) === "42", "total not rendered");
      expect((await page.textContent("#sitesCount")) === "2", "site count not rendered");
      expect(/^v\d/.test(await page.textContent("#version")), "version not rendered");
      expect(!errors.length, `popup errors: ${errors.join("; ")}`);
    },
  },
  {
    name: "SPA: re-arms on client-side navigation after the scan window (slow)",
    slow: true,
    async run({ page }) {
      await page.goto(url("spa.html"));
      await sleep(31000); // initial 30 s scan window has closed
      await page.evaluate(() => window.__navigate());
      const ok = await waitFor(async () => (await clicks(page)).accept, 6000);
      expect(ok, "banner shown after pushState navigation was not accepted");
    },
  },
];

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function resetExtensionState(worker) {
  await worker.evaluate(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.sync.set({ enabled: true });
  });
}

// ─── Perf benchmark ─────────────────────────────────────────────────────────

async function measureLag(context, host) {
  const page = await context.newPage();
  await page.goto(url("perf.html", host));
  await sleep(10000);
  const lag = await page.evaluate(() => window.__lag);
  await page.close();
  return lag;
}

// ─── Main ───────────────────────────────────────────────────────────────────

(async () => {
  const server = await startServer();
  port = server.address().port;
  const { context, worker } = await launch(true);
  let failed = 0;
  let ran = 0;

  for (const t of tests) {
    if (filter && !t.name.toLowerCase().includes(filter.toLowerCase())) continue;
    if (t.slow && !runSlow && !filter) continue;
    hostCounter++;
    ran++;
    await resetExtensionState(worker);
    const page = await context.newPage();
    try {
      await t.run({ page, worker, context });
      console.log(`  ✓ ${t.name}`);
    } catch (e) {
      failed++;
      console.log(`  ✗ ${t.name}\n      ${e.message}`);
    } finally {
      await page.close();
    }
  }

  if (runPerf) {
    const withExt = await measureLag(context, "127.0.0.250");
    const { context: bare } = await launch(false);
    const without = await measureLag(bare, "127.0.0.251");
    await bare.close();
    const fmt = (l) => `total ${l.total.toFixed(0)} ms, worst ${l.max.toFixed(0)} ms`;
    console.log(`\n  main-thread lag over 10 s on a 6k-element page with a live ticker:`);
    console.log(`    without extension: ${fmt(without)}`);
    console.log(`    with extension:    ${fmt(withExt)}`);
  }

  await context.close();
  server.close();
  console.log(`\n${ran - failed}/${ran} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
