// Real-site crawl: visits each site twice (without and with the extension)
// and classifies what happened. Writes report.json, report.html and
// summary.md (also appended to the GitHub Actions job summary).
//
//   npm run crawl                               all sites in tests/sites.txt
//   npm run crawl -- --limit 20 --concurrency 2
//   npm run crawl -- --sites my-list.txt --out /tmp/report
//   npm run crawl -- --fail-on-suspicious       exit 1 on a suspicious action
//                                               not listed in tests/crawl-reviewed.json
//   npm run crawl -- --annotate                 GitHub Actions annotations for
//                                               findings (never fails the run)
//
// Results depend on where you run it: many sites only show consent banners
// to EU visitors (by IP), so run it from an EU network for meaningful data.
//
// Outcomes
//   accepted        banner seen without the extension, gone with it, we acted
//   accepted-unconfirmed
//                   we acted through a known CMP (API, CMP selector, site rule)
//                   but the control run's detector saw no banner: detector gap
//   css-fallback    we hid it because its button didn't work
//   missed          banner still visible with the extension
//   suspicious      a heuristic click although the control run saw no banner,
//                   or the page moved to another site after our action:
//                   check by hand, then record the verdict in
//                   tests/crawl-reviewed.json
//   no-banner       nothing to do, nothing done
//   gone-anyway     banner disappeared on its own (auto-dismiss / timing)
//   error           the page failed to load

"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const { registrableDomain } = require("../domain.js");
const REVIEWED_FILE = path.join(ROOT, "tests", "crawl-reviewed.json");

// Actions taken through known CMP markup or APIs; a control-run miss next to
// one of these is a detector gap, not a wrong click.
const TRUSTED_STRATEGY = /^(CMP API|CMP selector|site rule)\b/;

function parseArgs(argv) {
  const opts = {
    sites: path.join(ROOT, "tests", "sites.txt"),
    out: path.join(ROOT, "crawl-report"),
    limit: Infinity,
    concurrency: 4,
    wait: 10000,
    failOnSuspicious: false,
    annotate: false,
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
    else if (a === "--annotate") opts.annotate = true;
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
  const RE = new RegExp([
    "cookie", "consent", "gdpr", "store and/or access information",
    "einwilligung", "consentement", "consentimiento", "consenso", "toestemming",
    "samtycke", "samtykke", "evästeet", "çerez", "küpsis", "sīkdatn", "slapuk",
    "kolačić", "kolacic", "piškot", "бисквитк", "куки", "クッキー", "쿠키",
    "ciasteczk", "sütik", "\\brodo\\b",
  ].join("|"), "i");
  const FRAME_RE = /consent|privacy-mgmt|cookie|cmp|sp_message|trustarc|truste|didomi|onetrust|quantcast/i;
  const HINT_RE = /cookie|consent|gdpr|cmp|rodo|privacy/i;
  const vw = innerWidth;
  const vh = innerHeight;
  const found = [];
  const floating = (el, cs) =>
    cs.position === "fixed" || cs.position === "sticky" ||
    el.getAttribute("role") === "dialog" || el.getAttribute("aria-modal") === "true" ||
    (el.localName === "dialog" && el.open);
  // Full-page consent screens are often in the normal flow (e.g. wp.pl)
  const bigHinted = (el, r) =>
    HINT_RE.test(`${el.id} ${el.getAttribute("class") || ""}`) && r.width * r.height > vw * vh * 0.4;
  // Only the host/path of a frame: ad URLs carry "consent" in query strings
  const frameId = (f) => {
    let where = "";
    try {
      const u = new URL(f.src, location.href);
      where = u.hostname + u.pathname;
    } catch (e) { /* no src */ }
    return `${where} ${f.id} ${f.name} ${f.title}`;
  };
  // Text outside links and buttons: a menu with a "Manage cookies" link or
  // button isn't a banner; a banner's own sentence sits outside its buttons
  const ownText = (el) => {
    let text = el.innerText || "";
    for (const a of el.querySelectorAll("a, button, [role='button']")) {
      const t = a.innerText;
      if (t) text = text.split(t).join(" ");
    }
    return text.replace(/\s+/g, " ").trim();
  };

  const visit = (root) => {
    for (const el of root.querySelectorAll("*")) {
      if (found.length >= 3) return;
      if (el.shadowRoot) visit(el.shadowRoot);
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 100 || r.height < 30 || r.bottom <= 0 || r.top >= vh) continue;
      if (!floating(el, cs) && !bigHinted(el, r)) continue;
      const frame = el.localName === "iframe" ? el : el.querySelector("iframe");
      if (frame && FRAME_RE.test(frameId(frame))) {
        found.push({ kind: "iframe", text: frame.src.slice(0, 140) });
        continue;
      }
      const text = ownText(el);
      if (text && text.length < 5000 && RE.test(text)) found.push({ kind: "element", text: text.slice(0, 140) });
    }
  };
  visit(document);
  return { present: found.length > 0, items: found };
}

// Headless Chromium announces itself as "HeadlessChrome", which bot
// protection (Akamai, Cloudflare) often blocks outright. Present the same
// version as a regular Chrome so the crawl sees what users see.
let userAgent = null;
async function regularUserAgent() {
  if (!userAgent) {
    const probe = await chromium.launch({ channel: "chromium", headless: true });
    const version = probe.version();
    await probe.close();
    userAgent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
  }
  return userAgent;
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
    userAgent: await regularUserAgent(),
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
    result.banner = await evaluateAfterNavigation(page, detectBanner);
    result.finalUrl = page.url();
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

// Consent walls often reload the page after accepting; wait for the new
// document instead of reporting "Execution context was destroyed"
async function evaluateAfterNavigation(page, fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await page.evaluate(fn);
    } catch (e) {
      if (attempt >= 2 || !/context was destroyed|navigat/i.test(e.message)) throw e;
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
      await sleep(2000);
    }
  }
}

async function activityFor(worker, hosts) {
  const keys = [...new Set(hosts.filter(Boolean).map((h) => `activity:${normalizeHost(h)}`))];
  const data = await worker.evaluate((k) => chrome.storage.session.get(k), keys);
  return Object.values(data).flat().sort((a, b) => a.t - b.t);
}

const siteOf = (u) => {
  try {
    return registrableDomain(new URL(u).hostname.replace(/^www\./, ""));
  } catch (e) {
    return "";
  }
};

// "CMP selector .sp_choice_type_11 "accept"": what we did, without the frame
const actionSignature = (a) => `${a.strategy}${a.label ? ` "${a.label}"` : ""}`;

function classify(control, withExt, activity) {
  if (!control.ok || !withExt.ok) return "error";
  const actions = activity.filter((a) => a.event === "action");
  const acted = actions.length > 0;
  const css = activity.some((a) => a.event === "cssFallback");
  // Consent walls often redirect back to the article: only leaving the site counts
  const leftSite = acted && control.finalUrl && withExt.finalUrl &&
    siteOf(control.finalUrl) !== siteOf(withExt.finalUrl);

  if (leftSite) return "suspicious";
  if (acted && !control.banner.present) {
    return actions.every((a) => TRUSTED_STRATEGY.test(a.strategy)) ? "accepted-unconfirmed" : "suspicious";
  }
  if (control.banner.present && withExt.banner.present) return "missed";
  if (css) return "css-fallback";
  if (control.banner.present) return acted ? "accepted" : "gone-anyway";
  return "no-banner";
}

function loadReviewed(file = REVIEWED_FILE) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf8")).reviewed || [];
}

// A suspicious result is "reviewed" when a person already checked that
// exact action on that site. A different action on the same site is new.
function isReviewed(url, activity, reviewed) {
  const site = siteOf(url);
  const allowed = reviewed.filter((r) => r.site === site).map((r) => r.action);
  const actions = activity.filter((a) => a.event === "action").map(actionSignature);
  return actions.length > 0 && actions.every((sig) => allowed.includes(sig));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function writeReports(outDir, rows, startedAt) {
  const counts = {};
  for (const r of rows) counts[r.outcome] = (counts[r.outcome] || 0) + 1;
  const withBanner = rows.filter((r) => r.control && r.control.banner && r.control.banner.present).length;
  const handled = (counts.accepted || 0) + (counts["css-fallback"] || 0);
  const newSuspicious = rows.filter((r) => r.outcome === "suspicious" && !r.reviewed);

  fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify({ startedAt, counts, rows }, null, 2));

  const order = ["suspicious", "missed", "error", "css-fallback", "accepted", "accepted-unconfirmed", "gone-anyway", "no-banner"];
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
    newSuspicious.length
      ? `**${newSuspicious.length} new suspicious action(s).** Check them in report.html; if an action is fine, ` +
        "add it to `tests/crawl-reviewed.json` so it stops failing the run."
      : "No new suspicious actions (suspicious results already reviewed are listed below as such).",
    "",
  ];
  const attention = rows.filter((r) => ["suspicious", "missed"].includes(r.outcome));
  if (attention.length) {
    md.push("### Needs attention", "", "| Site | Outcome | Detail |", "|---|---|---|");
    for (const r of attention) {
      const outcome = r.reviewed ? `${r.outcome} (reviewed)` : r.outcome;
      md.push(`| ${r.url} | ${outcome} | ${escapeHtml(r.detail).replace(/\|/g, "\\|")} |`);
    }
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
  return { counts, newSuspicious: newSuspicious.length, md: md.join("\n") };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const sites = readSites(opts.sites, opts.limit);
  fs.mkdirSync(path.join(opts.out, "shots"), { recursive: true });
  const startedAt = new Date().toISOString();

  const reviewed = loadReviewed();
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
      const isNewSuspicious = outcome === "suspicious" && !isReviewed(url, activity, reviewed);
      const actions = activity.filter((a) => a.event === "action")
        .map((a) => `${actionSignature(a)} (${a.frame})`);
      const detail = [
        c.loadError || e.loadError,
        actions.length ? `acted: ${actions.join("; ")}` : null,
        activity.some((a) => a.event === "loopGuard") ? "loop guard tripped" : null,
        outcome === "missed" && e.banner ? `still visible: ${e.banner.items.map((i) => i.text).join(" / ")}` : null,
        outcome === "suspicious" && !c.banner.present ? "no banner in control run" : null,
      ].filter(Boolean).join(" | ");
      const isReviewedRow = outcome === "suspicious" && !isNewSuspicious;
      rows.push({ url, slug: s, outcome, reviewed: isReviewedRow, detail, control: c, withExtension: e, activity });
      console.log(`${(outcome + (isReviewedRow ? "*" : "")).padEnd(21)} ${url}${detail ? `  ${detail}` : ""}`);
    }
  }

  await Promise.all(Array.from({ length: Math.min(opts.concurrency, sites.length) }, workerLoop));
  await control.context.close();
  await ext.context.close();

  const { newSuspicious, md } = writeReports(opts.out, rows, startedAt);
  console.log(`\n${md}\nReport: ${path.join(opts.out, "report.html")}`);
  if (opts.annotate) annotate(rows);
  if (opts.failOnSuspicious && newSuspicious) process.exit(1);
}

// GitHub Actions annotations: visible on the run page, never fail it
function annotate(rows) {
  const clean = (s) => String(s).replace(/[\r\n%]/g, " ").slice(0, 300);
  for (const r of rows) {
    if (r.outcome === "suspicious" && !r.reviewed) {
      console.log(`::warning title=Suspicious action: ${clean(r.url)}::${clean(r.detail)}`);
    } else if (r.outcome === "missed") {
      console.log(`::notice title=Banner missed: ${clean(r.url)}::${clean(r.detail)}`);
    }
  }
}

module.exports = { classify, isReviewed, loadReviewed, actionSignature, siteOf };

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
