// I Don't Give a Cookie - Background Service Worker
// Single writer for statistics, per-tab status and per-site activity for
// the popup, badge, a click-loop guard, and migration from v2.1 storage.

"use strict";

importScripts("rules.js", "cmp-api.js");

const LOOP_WINDOW_MS = 60 * 1000;      // Look at clicks in the last minute…
const LOOP_MAX_CLICKS = 6;             // …more than this on one site = a loop
const LOOP_BACKOFF_MS = 10 * 60 * 1000;
const MAX_TRACKED_SITES = 500;
const MAX_ACTIVITY_ENTRIES = 20;
const MAX_ACTIVITY_SITES = 200;        // session log keeps the most recent sites only

// ═══════════════════════════════════════════════════════════════════════════
// SERIALIZED STORAGE ACCESS
// ═══════════════════════════════════════════════════════════════════════════
// The service worker can be woken by several content scripts at once.
// Read-modify-write without a queue loses increments; every write below
// goes through this chain.

let queue = Promise.resolve();

function serialized(task) {
  const run = queue.then(task);
  queue = run.catch((e) => console.error("[IDGAC]", e));
  return run;
}

function emptyStats() {
  return { total: 0, cssFallback: 0, sites: {} };
}

// Privacy: persistent stats never store readable site names (that would be a
// browsing-history list on disk). Sites are keyed by a salted hash that only
// serves to count distinct sites; the salt never leaves this profile.
const HASHED_KEY = /^[0-9a-f]{16}$/;
let saltPromise = null;

function statsSalt() {
  if (!saltPromise) {
    saltPromise = chrome.storage.local.get("statsSalt").then(async ({ statsSalt: salt }) => {
      if (salt) return salt;
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      const fresh = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
      await chrome.storage.local.set({ statsSalt: fresh });
      return fresh;
    });
  }
  return saltPromise;
}

async function siteKey(site) {
  const data = new TextEncoder().encode(`${await statsSalt()}|${site}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return [...digest.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Replace any readable site names (stored by v2.2-v2.5) with hashed keys
async function hashPlainSiteKeys(stats) {
  for (const [key, entry] of Object.entries(stats.sites)) {
    if (HASHED_KEY.test(key)) continue;
    const hashed = await siteKey(key);
    const existing = stats.sites[hashed] || { count: 0, last: 0 };
    existing.count += entry.count || 0;
    existing.last = Math.max(existing.last, entry.last || 0);
    stats.sites[hashed] = existing;
    delete stats.sites[key];
  }
}

function updateStats(mutate) {
  return serialized(async () => {
    const { stats = emptyStats() } = await chrome.storage.local.get("stats");
    await mutate(stats);
    await hashPlainSiteKeys(stats);
    const sites = Object.entries(stats.sites);
    if (sites.length > MAX_TRACKED_SITES) {
      sites.sort((a, b) => b[1].last - a[1].last);
      stats.sites = Object.fromEntries(sites.slice(0, MAX_TRACKED_SITES));
    }
    await chrome.storage.local.set({ stats });
  });
}

// Per-tab status lives in storage.session: it survives service-worker
// restarts (an in-memory Map does not) and is wiped when the browser closes.
function updateTab(tabId, mutate) {
  const key = `tab:${tabId}`;
  return serialized(async () => {
    const data = await chrome.storage.session.get(key);
    const entry = data[key] || { dismissed: 0, cssFallback: false };
    mutate(entry);
    await chrome.storage.session.set({ [key]: entry });
  });
}

// Recent actions per site (memory-only storage.session, cleared when the
// browser closes). Shown in the popup and read by the crawler.
function logActivity(site, entry) {
  if (!site) return Promise.resolve();
  const key = `activity:${site}`;
  return serialized(async () => {
    const data = await chrome.storage.session.get([key, "activityIndex"]);
    const list = (data[key] || []).concat({ t: Date.now(), ...entry }).slice(-MAX_ACTIVITY_ENTRIES);
    // Bounded: storage.session has a 10 MB quota and long browsing sessions
    // would otherwise fill it
    const index = (data.activityIndex || []).filter((s) => s !== site).concat(site);
    const evicted = index.splice(0, Math.max(0, index.length - MAX_ACTIVITY_SITES));
    if (evicted.length) await chrome.storage.session.remove(evicted.map((s) => `activity:${s}`));
    await chrome.storage.session.set({ [key]: list, activityIndex: index });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// LOOP GUARD
// ═══════════════════════════════════════════════════════════════════════════
// If a click makes the page navigate or reload and the banner comes back,
// the content script would click forever. Rate-limit clicks per site.

function requestClick(site) {
  return serialized(async () => {
    const { loopGuard = {} } = await chrome.storage.session.get("loopGuard");
    const now = Date.now();
    const entry = loopGuard[site] || { clicks: [], blockedUntil: 0 };
    entry.clicks = entry.clicks.filter((t) => now - t < LOOP_WINDOW_MS);

    let allowed = now >= entry.blockedUntil;
    if (allowed && entry.clicks.length >= LOOP_MAX_CLICKS) {
      entry.blockedUntil = now + LOOP_BACKOFF_MS;
      allowed = false;
    }
    if (allowed) entry.clicks.push(now);

    loopGuard[site] = entry;
    // Drop sites with nothing left to remember, so the table stays small
    for (const [other, e] of Object.entries(loopGuard)) {
      if (other !== site && e.blockedUntil <= now && !e.clicks.some((t) => now - t < LOOP_WINDOW_MS)) {
        delete loopGuard[other];
      }
    }
    await chrome.storage.session.set({ loopGuard });
    return allowed;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// BADGE
// ═══════════════════════════════════════════════════════════════════════════

function flashBadge(tabId) {
  chrome.action.setBadgeText({ text: "✓", tabId }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ color: "#4CAF50", tabId }).catch(() => {});
  setTimeout(() => {
    chrome.action.setBadgeText({ text: "", tabId }).catch(() => {}); // tab may be gone
  }, 3000);
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGES
// ═══════════════════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.action !== "string") return false;
  const tabId = sender.tab && sender.tab.id;
  const site = typeof msg.site === "string" ? msg.site : "";

  switch (msg.action) {
    case "pageStart":
      // Top frame (re)loaded: reset what the popup shows for this tab
      if (tabId != null) {
        serialized(() => chrome.storage.session.remove(`tab:${tabId}`));
      }
      return false;

    case "bannerDismissed":
      logActivity(site, { event: "dismissed", strategy: String(msg.strategy || "") });
      updateStats(async (stats) => {
        stats.total++;
        if (!site) return;
        const key = await siteKey(site);
        const entry = stats.sites[key] || { count: 0, last: 0 };
        entry.count++;
        entry.last = Date.now();
        stats.sites[key] = entry;
      });
      if (tabId != null) {
        updateTab(tabId, (entry) => { entry.dismissed++; });
        flashBadge(tabId);
      }
      return false;

    case "cssFallbackUsed":
      logActivity(site, { event: "cssFallback" });
      updateStats((stats) => { stats.cssFallback++; });
      if (tabId != null) updateTab(tabId, (entry) => { entry.cssFallback = true; });
      return false;

    case "frameFallback": {
      // A CMP iframe gave up, or accepted but may be left on screen; the
      // iframe element lives in the top frame
      let origin = null;
      try {
        origin = new URL(sender.url).origin;
      } catch (e) { /* no url */ }
      // Opaque-origin frames (about:blank, data:) report "null": they could
      // otherwise ask the top frame to hide every other "null" frame
      if (tabId != null && origin && origin !== "null" && sender.frameId !== 0) {
        const delayMs = Math.min(Math.max(Number(msg.delayMs) || 0, 0), 10000);
        chrome.tabs.sendMessage(tabId, { action: "hideFrame", origin, delayMs }, { frameId: 0 })
          .catch(() => {}); // top frame may have navigated away
      }
      return false;
    }

    case "callCmpApi": {
      // Runs the CMP's own "accept all" in the page world of the asking
      // frame, only now. content.js has already checked that the banner is
      // visible and the site allowed; nothing stays resident in the page.
      const cmp = typeof msg.cmp === "string" ? msg.cmp : "";
      if (tabId == null || !self.IDGAC_CMP_API_IDS.includes(cmp)) return false;
      chrome.scripting.executeScript({
        // Pin to the exact document that asked: if the frame navigated in
        // the meantime (maybe to a blocked site), the call goes nowhere
        target: sender.documentId
          ? { tabId, documentIds: [sender.documentId] }
          : { tabId, frameIds: [sender.frameId || 0] },
        world: "MAIN",
        func: self.IDGAC_cmpAcceptAll,
        args: [cmp],
      })
        .then((results) => sendResponse({ ok: !!(results && results[0] && results[0].result) }))
        .catch(() => sendResponse({ ok: false }));
      return true; // async response
    }

    case "requestClick":
      requestClick(site)
        .then((allowed) => {
          logActivity(site, {
            event: allowed ? "action" : "loopGuard",
            strategy: String(msg.strategy || "").slice(0, 120),
            label: String(msg.label || "").slice(0, 60),
            frame: sender.frameId === 0 ? "top" : "iframe",
          });
          sendResponse({ allowed });
        })
        .catch(() => sendResponse({ allowed: true }));
      return true; // async response

    case "getTabStatus":
      chrome.storage.session.get(`tab:${msg.tabId}`)
        .then((data) => sendResponse(data[`tab:${msg.tabId}`] || { dismissed: 0, cssFallback: false }))
        .catch(() => sendResponse(null));
      return true;

    default:
      return false;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  serialized(() => chrome.storage.session.remove(`tab:${tabId}`));
});

// ═══════════════════════════════════════════════════════════════════════════
// INSTALL / UPDATE
// ═══════════════════════════════════════════════════════════════════════════

// v2.1 kept one "__IDGAC__<hostname>" key per host (iframe hosts included)
// plus a racy "totalDismissed" counter. Fold them into the single stats object.
async function migrateLegacyStorage() {
  const all = await chrome.storage.local.get(null);
  const legacyKeys = Object.keys(all).filter((k) => k.startsWith("__IDGAC__"));
  if (!legacyKeys.length && all.totalDismissed === undefined) return;

  await updateStats((stats) => {
    let sum = 0;
    for (const key of legacyKeys) {
      const entry = all[key];
      const count = (entry && entry.count) || 0;
      if (!count) continue;
      sum += count;
      const host = key.slice("__IDGAC__".length).replace(/^www\./, "");
      const existing = stats.sites[host] || { count: 0, last: 0 };
      existing.count += count;
      existing.last = Math.max(existing.last, (entry && entry.ts) || 0);
      stats.sites[host] = existing;
    }
    stats.total += Math.max(sum, all.totalDismissed || 0);
  });
  await chrome.storage.local.remove([...legacyKeys, "totalDismissed"]);
}

// rules/sites.json → validated → storage.local.siteRules, which content
// scripts read with their other settings (no extra round-trip per page).
async function loadSiteRules() {
  try {
    const response = await fetch(chrome.runtime.getURL("rules/sites.json"));
    const { valid, errors } = self.IDGAC_validateRules(await response.json());
    if (errors.length) console.warn("[IDGAC] Ignored invalid site rules:", errors);
    await chrome.storage.local.set({ siteRules: valid });
  } catch (e) {
    console.error("[IDGAC] Could not load site rules:", e);
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    await chrome.storage.sync.set({ enabled: true });
    await chrome.storage.local.set({ blocklist: [], debug: false, stats: emptyStats() });
  } else if (details.reason === "update") {
    await migrateLegacyStorage();
    await updateStats(() => {}); // hashes readable site names from v2.2-v2.5
  }
  await loadSiteRules();
});

chrome.runtime.onStartup.addListener(loadSiteRules);
