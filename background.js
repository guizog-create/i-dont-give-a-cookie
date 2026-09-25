// I Don't Give a Cookie - Background Service Worker
// v2.2.0 - Single writer for statistics, per-tab status for the popup,
// badge, a click-loop guard, and migration from the v2.1 storage layout.

"use strict";

const LOOP_WINDOW_MS = 60 * 1000;      // Look at clicks in the last minute…
const LOOP_MAX_CLICKS = 6;             // …more than this on one site = a loop
const LOOP_BACKOFF_MS = 10 * 60 * 1000;
const MAX_TRACKED_SITES = 500;

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

function updateStats(mutate) {
  return serialized(async () => {
    const { stats = emptyStats() } = await chrome.storage.local.get("stats");
    mutate(stats);
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
      updateStats((stats) => {
        stats.total++;
        const entry = stats.sites[site] || { count: 0, last: 0 };
        entry.count++;
        entry.last = Date.now();
        if (site) stats.sites[site] = entry;
      });
      if (tabId != null) {
        updateTab(tabId, (entry) => { entry.dismissed++; });
        flashBadge(tabId);
      }
      return false;

    case "cssFallbackUsed":
      updateStats((stats) => { stats.cssFallback++; });
      if (tabId != null) updateTab(tabId, (entry) => { entry.cssFallback = true; });
      return false;

    case "requestClick":
      requestClick(site)
        .then((allowed) => sendResponse({ allowed }))
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

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    await chrome.storage.sync.set({ enabled: true });
    await chrome.storage.local.set({ blocklist: [], debug: false, stats: emptyStats() });
  } else if (details.reason === "update") {
    await migrateLegacyStorage();
  }
});
