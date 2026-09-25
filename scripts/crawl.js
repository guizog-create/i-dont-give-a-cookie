// Real-site crawl: visits each site twice (without and with the extension)
// and classifies what happened. Writes report.json, report.html and
// summary.md (also appended to the GitHub Actions job summary).
//
//   npm run crawl                               all sites in tests/sites.txt
//   npm run crawl -- --limit 20 --concurrency 2
//   npm run crawl -- --sites my-list.txt --out /tmp/report
//   npm run crawl -- --fail-on-suspicious       exit 1 if any suspicious click
//
// Results depend on where you run it: many sites only show consent banners
// to EU visitors (by IP), so run it from an EU network for meaningful data.
//
// Outcomes
//   accepted        banner seen without the extension, gone with it, we acted
//   css-fallback    we hid it because its button didn't work
//   missed          banner still visible with the extension
//   suspicious      we acted although the control run saw no banner, or the
//                   page navigated elsewhere after our action: check by hand
//   no-banner       nothing to do, nothing done
//   gone-anyway     banner disappeared on its own (auto-dismiss / timing)
//   error           the page failed to load

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const opts = {
    sites: path.join(ROOT, "tests", "sites.txt"),
    out: path.join(ROOT, "crawl-report"),
    limit: Infinity,
    concurrency: 4,
    wait: 10000,
    failOnSuspicious: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--sites") opts.sites = path.resolve(next());
    else if (a === "--out") opts.out = path.resolve(next());
    else if (a === "--limit") opts.limit = Number(next());
    else if (a === "--concurrency") opts.concurrency = Math.max(1, Number(next()));
    else if (a === "--wait") opts.wait = Number(next());
    else if (a === "--fail-on-suspicious") opts.failOnSuspicious = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return opts;
}

function readSites(file, limit) {
  return fs.readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.replace(/#.*/, "").trim())
    .filter(Boolean)
    .map((l) => (/^https?:\/\//.test(l) ? l : `https://${l}`))
    .slice(0, limit);
}

const normalizeHost = (h) => (h || "").toLowerCase().replace(/^www\./, "");
const slug = (u) => u.replace(/^https?:\/\//, "").replace(/[^a-z0-9.-]+/gi, "_").slice(0, 80);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Runs in the page: is a cookie/consent banner visibly on screen?
function detectBanner() {
  const RE = /cookie|consent|gdpr|einwilligung|consentement|consentimiento|consenso|toestemming|samtycke|samtykke|evästeet|çerez|куки|クッキー|쿠키|store and\/or access information/i;
  const FRAME_RE = /consent|privacy-mgmt|cookie|cmp|sp_message|trustarc|truste|didomi|onetrust|quantcast/i;
  const vh = innerHeight;
  const found = [];
  const floating = (el, cs) =>
    cs.position === "fixed" || cs.position === "sticky" ||
    el.getAttribute("role") === "dialog" || el.getAttribute("aria-modal") === "true" ||
    (el.localName === "dialog" && el.open);

  const visit = (root) => {
    for (const el of root.querySelectorAll("*")) {
      if (found.length >= 3) return;
      if (el.shadowRoot) visit(el.shadowRoot);
      const cs = getComputedStyle(el);
      if (!floating(el, cs)) continue;
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 100 || r.height < 30 || r.bottom <= 0 || r.top >= vh) continue;
      const frame = el.localName === "iframe" ? el : el.querySelector("iframe");
      if (frame && FRAME_RE.test(`${frame.src} ${frame.id} ${frame.name} ${frame.title}`)) {
        found.push({ kind: "iframe", text: frame.src.slice(0, 140) });
        continue;
      }
      const text = (el.innerText || "").replace(/\s+/g, " ").trim();
      if (text && text.length < 5000 && RE.test(text)) found.push({ kind: "element", text: text.slice(0, 140) });
    }
  };
  visit(document);
  return { present: found.length > 0, items: found };
}

async function launch(withExtension) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "idgac-crawl-"));
  const args = withExtension ? [`--disable-extensions-except=${ROOT}`, `--load-extension=${ROOT}`] : [];
  const context = await chromium.launchPersistentContext(dir, {
    channel: "chromium",
    headless: true,
    args,
    viewport: { width: 1280, height: 800 },
    locale: "en-GB",
    timezoneId: "Europe/Amsterdam",
  });
  const worker = withExtension
    ? context.serviceWorkers()[0] || (await context.waitForEvent("serviceworker"))
    : null;
  return { context, worker };
}

async function visit(context, url, opts, shotPath) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  const result = { ok: false, finalUrl: null, banner: null, loadError: null };
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(opts.wait);
    result.finalUrl = page.url();
    result.banner = await page.evaluate(detectBanner);
    await page.screenshot({ path: shotPath, type: "jpeg", quality: 50 }).catch(() => {});
    result.ok = true;
  } catch (e) {
    result.loadError = e.message.split("\n")[0].slice(0, 200);
  } finally {
    result.pageErrors = errors.length;
    await page.close().catch(() => {});
  }
  return result;
}

async function activityFor(worker, hosts) {
  const keys = [...new Set(hosts.filter(Boolean).map((h) => `activity:${normalizeHost(h)}`))];
  const data = await worker.evaluate((k) => chrome.storage.session.get(k), keys);
  return Object.values(data).flat().sort((a, b) => a.t - b.t);
}

function classify(control, withExt, activity) {
  if (!control.ok || !withExt.ok) return "error";
  const acted = activity.some((a) => a.event === "action");
  const css = activity.some((a) => a.event === "cssFallback");
  const navigated = acted && control.finalUrl && withExt.finalUrl &&
    new URL(control.finalUrl).pathname !== new URL(withExt.finalUrl).pathname;

  if (acted && (!control.banner.present || navigated)) return "suspicious";
  if (control.banner.present && withExt.banner.present) return "missed";
  if (css) return "css-fallback";
  if (control.banner.present) return acted ? "accepted" : "gone-anyway";
  return "no-banner";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function writeReports(outDir, rows, startedAt) {
  const counts = {};
  for (const r of rows) counts[r.outcome] = (counts[r.outcome] || 0) + 1;
  const withBanner = rows.filter((r) => r.control && r.control.banner && r.control.banner.present).length;
  const handled = (counts.accepted || 0) + (counts["css-fallback"] || 0);

  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify({ startedAt, counts, rows }, null, 2));

  const order = ["suspicious", "missed", "error", "css-fallback", "accepted", "gone-anyway", "no-banner"];
  const md = [
    `## Cookie banner crawl: ${rows.length} sites`,
    "",
    `Banners seen without the extension: **${withBanner}**. Handled: **${handled}**` +
      (withBanner ? ` (${Math.round((100 * handled) / withBanner)}%)` : "") + ".",
    "",
    "| Outcome | Sites |",
    "|---|---|",
    ...order.filter((o) => counts[o]).map((o) => `| ${o} | ${counts[o]} |`),
    "",
  ];
  const attention = rows.filter((r) => ["suspicious", "missed"].includes(r.outcome));
  if (attention.length) {
    md.push("### Needs attention", "", "| Site | Outcome | Detail |", "|---|---|---|");
    for (const r of attention) md.push(`| ${r.url} | ${r.outcome} | ${escapeHtml(r.detail).replace(/\|/g, "\\|")} |`);
    md.push("");
  }
  fs.writeFileSync(path.join(outDir, "summary.md"), md.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md.join("\n") + "\n");

  const sorted = [...rows].sort((a, b) => order.indexOf(a.outcome) - order.indexOf(b.outcome));
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Crawl report</title>
<style>
  body{font:14px system-ui,sans-serif;margin:16px;background:#fff;color:#111}
  table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:6px;vertical-align:top;text-align:left}
  img{width:240px;border:1px solid #ccc}.o{font-weight:600}
  .suspicious,.missed,.error{color:#b00020}.accepted,.css-fallback{color:#137333}
  @media (prefers-color-scheme:dark){body{background:#111;color:#eee}td,th{border-color:#333}}
</style></head><body>
<h1>Crawl report</h1><p>${escapeHtml(startedAt)}: ${rows.length} sites. ${escapeHtml(JSON.stringify(counts))}</p>
<table><tr><th>Site</th><th>Outcome</th><th>Detail</th><th>Without extension</th><th>With extension</th></tr>
${sorted.map((r) => `<tr><td><a href="${escapeHtml(r.url)}">${escapeHtml(r.url)}</a></td>
<td class="o ${r.outcome}">${r.outcome}</td><td>${escapeHtml(r.detail)}</td>
<td><img loading="lazy" src="shots/${r.slug}.control.jpg" alt=""></td>
<td><img loading="lazy" src="shots/${r.slug}.ext.jpg" alt=""></td></tr>`).join("\n")}
</table></body></html>`;
  fs.writeFileSync(path.join(outDir, "report.html"), html);
  return { counts, md: md.join("\n") };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const sites = readSites(opts.sites, opts.limit);
  fs.mkdirSync(path.join(opts.out, "shots"), { recursive: true });
  const startedAt = new Date().toISOString();

  const control = await launch(false);
  const ext = await launch(true);
  const rows = [];
  let next = 0;

  async function workerLoop() {
    while (next < sites.length) {
      const url = sites[next++];
      const s = slug(url);
      const c = await visit(control.context, url, opts, path.join(opts.out, "shots", `${s}.control.jpg`));
      const e = await visit(ext.context, url, opts, path.join(opts.out, "shots", `${s}.ext.jpg`));
      const hosts = [url, c.finalUrl, e.finalUrl].map((u) => { try { return new URL(u).hostname; } catch (_) { return null; } });
      const activity = await activityFor(ext.worker, hosts).catch(() => []);
      const outcome = classify(c, e, activity);
      const actions = activity.filter((a) => a.event === "action")
        .map((a) => `${a.strategy}${a.label ? ` "${a.label}"` : ""} (${a.frame})`);
      const detail = [
        c.loadError || e.loadError,
        actions.length ? `acted: ${actions.join("; ")}` : null,
        activity.some((a) => a.event === "loopGuard") ? "loop guard tripped" : null,
        outcome === "missed" && e.banner ? `still visible: ${e.banner.items.map((i) => i.text).join(" / ")}` : null,
        outcome === "suspicious" && !c.banner.present ? "no banner in control run" : null,
      ].filter(Boolean).join(" | ");
      rows.push({ url, slug: s, outcome, detail, control: c, withExtension: e, activity });
      console.log(`${outcome.padEnd(13)} ${url}${detail ? `  ${detail}` : ""}`);
    }
  }

  await Promise.all(Array.from({ length: Math.min(opts.concurrency, sites.length) }, workerLoop));
  await control.context.close();
  await ext.context.close();

  const { counts, md } = writeReports(opts.out, rows, startedAt);
  console.log(`\n${md}\nReport: ${path.join(opts.out, "report.html")}`);
  if (opts.failOnSuspicious && counts.suspicious) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
