// I Don't Give a Cookie - Popup Controller

"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const $ = (id) => document.getElementById(id);
  const enableToggle = $("enableToggle");
  const debugToggle = $("debugToggle");
  const totalDismissedEl = $("totalDismissed");
  const sitesCountEl = $("sitesCount");
  const siteNameEl = $("siteName");
  const siteDetailEl = $("siteDetail");
  const statusDot = $("statusDot");
  const blockSiteBtn = $("blockSiteBtn");
  const allowSiteBtn = $("allowSiteBtn");
  const reScanBtn = $("reScanBtn");

  $("version").textContent = "v" + chrome.runtime.getManifest().version;

  // Same normalization as content.js, so "Allow" always undoes "Block"
  const normalizeHost = (host) => (host || "").toLowerCase().replace(/^www\./, "");
  const hostMatches = (site, pattern) => {
    const p = normalizeHost(pattern);
    return !!p && (site === p || site.endsWith("." + p));
  };

  let site = "";
  let tabId = null;

  // ─── Settings ────────────────────────────────────────────────────────

  const { enabled } = await chrome.storage.sync.get({ enabled: true });
  enableToggle.checked = enabled !== false;
  const { debug } = await chrome.storage.local.get({ debug: false });
  debugToggle.checked = !!debug;

  enableToggle.addEventListener("change", () => {
    chrome.storage.sync.set({ enabled: enableToggle.checked });
    refreshSite();
  });

  debugToggle.addEventListener("change", () => {
    chrome.storage.local.set({ debug: debugToggle.checked });
  });

  // ─── Statistics ──────────────────────────────────────────────────────

  async function loadStats() {
    const { stats } = await chrome.storage.local.get("stats");
    totalDismissedEl.textContent = (stats && stats.total) || 0;
    sitesCountEl.textContent = stats ? Object.keys(stats.sites || {}).length : 0;
  }

  // ─── Current site ────────────────────────────────────────────────────

  function setStatus(dot, detail) {
    statusDot.className = "dot " + dot;
    siteDetailEl.textContent = detail;
  }

  function showBlocked(blocked) {
    blockSiteBtn.style.display = blocked ? "none" : "inline-flex";
    allowSiteBtn.style.display = blocked ? "inline-flex" : "none";
  }

  async function refreshSite() {
    if (!site) return;
    const { blocklist = [] } = await chrome.storage.local.get("blocklist");
    const blocked = blocklist.some((p) => hostMatches(site, p));
    showBlocked(blocked);

    if (blocked) return setStatus("blocked", "Blocked: extension disabled here");
    if (!enableToggle.checked) return setStatus("idle", "Extension is turned off");

    const tab = await chrome.runtime.sendMessage({ action: "getTabStatus", tabId }).catch(() => null);
    if (tab && tab.dismissed > 0) {
      setStatus("active", `${tab.dismissed} banner(s) accepted on this page`);
    } else if (tab && tab.cssFallback) {
      setStatus("active", "Banner hidden (its button did not respond)");
    } else {
      setStatus("idle", "No banner handled on this page");
    }
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let url = null;
  try {
    url = tab && tab.url ? new URL(tab.url) : null;
  } catch (e) { /* unparsable */ }

  if (url && (url.protocol === "http:" || url.protocol === "https:")) {
    tabId = tab.id;
    site = normalizeHost(url.hostname);
    siteNameEl.textContent = site;
    await refreshSite();
  } else {
    siteNameEl.textContent = "N/A";
    setStatus("idle", "Extension doesn't run on this page");
    blockSiteBtn.disabled = true;
    reScanBtn.disabled = true;
  }

  // ─── Actions ─────────────────────────────────────────────────────────
  // Content scripts listen to storage changes, so no tab messaging is
  // needed for block/allow; the page reacts immediately.

  blockSiteBtn.addEventListener("click", async () => {
    if (!site) return;
    const { blocklist = [] } = await chrome.storage.local.get("blocklist");
    if (!blocklist.some((p) => hostMatches(site, p))) blocklist.push(site);
    await chrome.storage.local.set({ blocklist });
    refreshSite();
  });

  allowSiteBtn.addEventListener("click", async () => {
    if (!site) return;
    const { blocklist = [] } = await chrome.storage.local.get("blocklist");
    // Remove every entry that covers this site (e.g. "example.com" when on
    // "shop.example.com"), otherwise "Allow" would silently do nothing.
    await chrome.storage.local.set({ blocklist: blocklist.filter((p) => !hostMatches(site, p)) });
    refreshSite();
  });

  reScanBtn.addEventListener("click", () => {
    if (tabId == null) return;
    setStatus("idle", "Re-scanning…");
    // Sent to every frame (CMP iframes re-arm too); only the top frame replies
    chrome.tabs.sendMessage(tabId, { action: "reScan" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        setStatus("idle", "Could not reach the page (reload it first)");
        return;
      }
      setTimeout(() => {
        loadStats();
        refreshSite();
      }, 3000);
    });
  });

  loadStats();
});
