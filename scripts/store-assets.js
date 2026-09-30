// Generates the Chrome Web Store images into store/screenshots/:
//   1-before-after.png, 2-popup.png, 3-careful.png (1280x800)
//   promo-small.png (440x280)
// The "before/after" and popup shots are real: the demo page with and
// without the extension loaded, and the extension's own popup.
//
//   npm run store-assets

"use strict";

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const DEMO = path.join(ROOT, "store", "demo");
const OUT = path.join(ROOT, "store", "screenshots");
const VIEW = { width: 1280, height: 800 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const png = (buf) => `data:image/png;base64,${buf.toString("base64")}`;
const ICON = png(fs.readFileSync(path.join(ROOT, "icons", "icon128.png")));

function serve() {
  const server = http.createServer((req, res) => {
    const file = path.join(DEMO, path.normalize(new URL(req.url, "http://x").pathname));
    if (!file.startsWith(DEMO) || !fs.existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(fs.readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function launch(withExtension) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "idgac-assets-"));
  const args = ["--no-proxy-server"];
  if (withExtension) args.push(`--disable-extensions-except=${ROOT}`, `--load-extension=${ROOT}`);
  const context = await chromium.launchPersistentContext(dir, {
    channel: "chromium", headless: true, args, viewport: VIEW, deviceScaleFactor: 1,
  });
  const worker = withExtension
    ? context.serviceWorkers()[0] || (await context.waitForEvent("serviceworker"))
    : null;
  return { context, worker };
}

// Shared look for the composed slides (matches the popup's palette)
const SLIDE_CSS = `
  * { box-sizing: border-box; margin: 0; }
  body { width: 1280px; height: 800px; overflow: hidden; font-family: "Liberation Sans", "DejaVu Sans", sans-serif;
         background: linear-gradient(160deg, #f5f7fc 0%, #e8edf8 100%); color: #1a1a2e; }
  .title { position: absolute; top: 44px; left: 64px; right: 64px; display: flex; align-items: center; gap: 18px; }
  .title img { width: 64px; height: 64px; padding: 6px; background: #fff; border-radius: 16px;
               box-shadow: 0 4px 14px rgba(26,26,46,.14); }
  .title h1 { font-size: 40px; letter-spacing: -0.5px; }
  .title p { font-size: 20px; color: #4a5068; margin-top: 4px; }
`;

async function render(page, html, size = VIEW) {
  await page.setViewportSize(size);
  await page.setContent(html, { waitUntil: "load" });
  await sleep(100);
  return page.screenshot({ type: "png" });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const demoUrl = `http://127.0.0.1:${server.address().port}/news.html`;

  // Before: no extension
  const bare = await launch(false);
  const pb = await bare.context.newPage();
  await pb.goto(demoUrl);
  await sleep(500);
  const before = await pb.screenshot({ type: "png" });

  // After: the extension accepts the banner on its own
  const ext = await launch(true);
  const pa = await ext.context.newPage();
  await pa.goto(demoUrl);
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline && (await pa.$(".cmp-banner"))) await sleep(200);
  if (await pa.$(".cmp-banner")) throw new Error("the extension did not accept the demo banner");
  await sleep(400);
  const after = await pa.screenshot({ type: "png" });

  // Popup: real popup page, with a pretend news tab and some statistics
  const extId = new URL(ext.worker.url()).host;
  await sleep(1500); // let the background finish recording the demo acceptance
  await ext.worker.evaluate(async () => {
    await chrome.storage.local.set({
      stats: {
        total: 1284,
        cssFallback: 9,
        sites: Object.fromEntries(Array.from({ length: 312 }, (_, i) => [
          (0x1000000000000000n + BigInt(i)).toString(16), { count: 4, last: 0 }])),
      },
    });
    await chrome.storage.session.set({ "tab:424242": { dismissed: 1, cssFallback: false } });
  });
  const pp = await ext.context.newPage();
  await pp.setViewportSize({ width: 320, height: 600 });
  await pp.addInitScript(() => {
    chrome.tabs.query = async () => [{ id: 424242, url: "https://www.dailyexample.com/science/seabirds" }];
  });
  await pp.goto(`chrome-extension://${extId}/popup.html`);
  await pp.waitForFunction(() => Number(document.getElementById("totalDismissed").textContent) >= 1284);
  await sleep(300);
  const popupShot = await (await pp.$("body")).screenshot({ type: "png" });

  const page = await bare.context.newPage();

  // 1. Before / after
  fs.writeFileSync(path.join(OUT, "1-before-after.png"), await render(page, `<html><head><style>${SLIDE_CSS}
    .shots { position: absolute; top: 172px; left: 64px; right: 64px; display: flex; gap: 32px; }
    figure { flex: 1; }
    figure img { width: 100%; border-radius: 10px; box-shadow: 0 10px 30px rgba(26,26,46,.18); display: block; }
    figcaption { font-size: 22px; font-weight: 700; margin-bottom: 14px; display: flex; align-items: center; gap: 10px; }
    .tag { font-size: 14px; font-weight: 700; padding: 4px 10px; border-radius: 20px; color: #fff; }
    .off { background: #9aa0b4; } .on { background: #3f9c43; }
    .facts { position: absolute; left: 64px; right: 64px; bottom: 56px; display: flex; gap: 24px; }
    .facts span { flex: 1; background: #1a1a2e; color: #d6dcf0; border-radius: 12px; padding: 18px 24px;
                  font-size: 21px; text-align: center; }
    .facts b { color: #7ee07f; font-size: 26px; margin-right: 6px; }
    </style></head><body>
    <div class="title"><img src="${ICON}"><div><h1>Cookie banners, accepted for you</h1>
      <p>It finds the consent banner, clicks "Accept", and gets out of the way.</p></div></div>
    <div class="shots">
      <figure><figcaption><span class="tag off">WITHOUT</span> Every site, every visit</figcaption><img src="${png(before)}"></figure>
      <figure><figcaption><span class="tag on">WITH</span> Straight to the page</figcaption><img src="${png(after)}"></figure>
    </div>
    <div class="facts"><span><b>40+</b> consent platforms</span><span><b>47</b> languages</span><span><b>0</b> servers or trackers</span></div>
    </body></html>`));

  // 2. Popup
  fs.writeFileSync(path.join(OUT, "2-popup.png"), await render(page, `<html><head><style>${SLIDE_CSS}
    .popup { position: absolute; top: 170px; left: 120px; width: 320px; border-radius: 12px; overflow: hidden;
             box-shadow: 0 16px 40px rgba(26,26,46,.28); transform: scale(1.15); transform-origin: top left; }
    .popup img { display: block; width: 320px; }
    ul { position: absolute; top: 200px; left: 610px; right: 64px; list-style: none; padding: 0; }
    li { font-size: 25px; line-height: 1.35; margin-bottom: 30px; padding-left: 44px; position: relative; }
    li::before { content: "✓"; position: absolute; left: 0; top: 0; color: #3f9c43; font-weight: 700; }
    li small { display: block; font-size: 18px; color: #4a5068; margin-top: 4px; }
    </style></head><body>
    <div class="title"><img src="${ICON}"><div><h1>You stay in control</h1>
      <p>One click in the toolbar.</p></div></div>
    <div class="popup"><img src="${png(popupShot)}"></div>
    <ul>
      <li>Turn it off for any site<small>Covers the whole site, including its subdomains</small></li>
      <li>One main switch<small>Pause it everywhere, any time</small></li>
      <li>See what it has handled<small>Statistics stay on your device</small></li>
    </ul></body></html>`));

  // 3. Careful by design
  fs.writeFileSync(path.join(OUT, "3-careful.png"), await render(page, `<html><head><style>${SLIDE_CSS}
    .cols { position: absolute; top: 200px; left: 64px; right: 64px; display: flex; gap: 32px; }
    .card { flex: 1; background: #fff; border-radius: 14px; padding: 36px 40px 22px; box-shadow: 0 8px 24px rgba(26,26,46,.10); }
    .card h2 { font-size: 28px; margin-bottom: 24px; }
    .card li { font-size: 24px; line-height: 1.3; margin-bottom: 24px; list-style: none; padding-left: 38px; position: relative; }
    .card ul { padding: 0; }
    .yes li::before { content: "✓"; color: #3f9c43; position: absolute; left: 0; font-weight: 700; }
    .no li::before { content: "✗"; color: #c0392b; position: absolute; left: 0; font-weight: 700; }
    .foot { position: absolute; bottom: 56px; left: 64px; right: 64px; background: #1a1a2e; color: #fff; border-radius: 12px;
            padding: 20px 28px; font-size: 22px; display: flex; gap: 14px; align-items: center; }
    .foot b { color: #7ee07f; }
    </style></head><body>
    <div class="title"><img src="${ICON}"><div><h1>Careful by design</h1>
      <p>It only answers cookie banners, and nothing else.</p></div></div>
    <div class="cols">
      <div class="card yes"><h2>Clicks</h2><ul>
        <li>"Accept all" on cookie banners</li>
        <li>40+ consent platforms, 47 languages</li>
        <li>Banners in pop-ups, bars, walls and iframes</li>
        <li>Verifies the banner is really gone</li></ul></div>
      <div class="card no"><h2>Never clicks</h2><ul>
        <li>Reject, settings, subscribe or sign-in buttons</li>
        <li>Sign-up forms or Terms of Service</li>
        <li>Age checks ("Are you over 18?")</li>
        <li>Ordinary links or "Do Not Sell" dialogs</li></ul></div>
    </div>
    <div class="foot"><b>Private:</b> nothing leaves your browser. No servers, no analytics, no list of the sites you visit.</div>
    </body></html>`));

  // Small promo tile
  fs.writeFileSync(path.join(OUT, "promo-small.png"), await render(page, `<html><head><style>
    * { box-sizing: border-box; margin: 0; }
    body { width: 440px; height: 280px; overflow: hidden; font-family: "Liberation Sans", "DejaVu Sans", sans-serif;
           background: linear-gradient(135deg, #16213e 0%, #0f3460 100%); color: #fff;
           display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; }
    img { width: 92px; height: 92px; padding: 8px; background: #fff; border-radius: 22px;
          box-shadow: 0 6px 18px rgba(0,0,0,.35); }
    h1 { font-size: 30px; letter-spacing: -0.3px; }
    p { font-size: 17px; color: #b8c4e6; }
    </style></head><body><img src="${ICON}"><h1>I Don't Give a Cookie</h1><p>Cookie banners, accepted for you</p></body></html>`,
  { width: 440, height: 280 }));

  await bare.context.close();
  await ext.context.close();
  server.close();
  for (const f of fs.readdirSync(OUT)) console.log(`wrote store/screenshots/${f}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
