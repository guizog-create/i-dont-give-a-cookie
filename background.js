// I Don't Give a Cookie - Background Service Worker
// v2.0.0 - Coordinates content scripts, handles SPA navigation,
// manages badge, and provides centralized state management.

"use strict";

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

const stats = {
  totalDismissed: 0,
  cssFallbackCount: 0,
};

// Track which tabs have had banners dismissed
const tabState = new Map();

// ═══════════════════════════════════════════════════════════════════════════
// BADGE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

function updateBadge(tabId, dismissed) {
  try {
    if (dismissed) {
      chrome.action.setBadgeText({ text: "✓", tabId });
      chrome.action.setBadgeBackgroundColor({ color: "#4CAF50", tabId });
      // Clear badge after 3 seconds
      setTimeout(() => {
        try {
          chrome.action.setBadgeText({ text: "", tabId });
        } catch (e) { /* tab may be closed */ }
      }, 3000);
    }
  } catch (e) { /* ignore badge errors */ }
}

function updateGlobalBadge() {
  // Show total count on extension icon when no specific tab is active
  try {
    if (stats.totalDismissed > 0) {
      chrome.action.setTitle({
        title: `I Don't Give a Cookie - ${stats.totalDismissed} banners dismissed this session`,
      });
    }
  } catch (e) { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE HANDLING (from content scripts)
// ═══════════════════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab && sender.tab.id;

  switch (msg.action) {
    case "bannerDismissed":
      stats.totalDismissed++;
      if (tabId) {
        tabState.set(tabId, {
          hostname: msg.hostname,
          dismissed: true,
          timestamp: Date.now(),
        });
        updateBadge(tabId, true);
      }
      updateGlobalBadge();
      // Persist total count
      chrome.storage.local.set({ totalDismissed: stats.totalDismissed });
      sendResponse({ ok: true });
      break;

    case "cssFallbackUsed":
      stats.cssFallbackCount++;
      if (tabId) {
        const state = tabState.get(tabId) || {};
        state.cssFallback = true;
        tabState.set(tabId, state);
      }
      sendResponse({ ok: true });
      break;

    case "getStats":
      sendResponse({
        totalDismissed: stats.totalDismissed,
        cssFallbackCount: stats.cssFallbackCount,
      });
      break;

    default:
      sendResponse({ ok: false, error: "unknown action" });
  }

  return true; // Keep channel open for async
});

// ═══════════════════════════════════════════════════════════════════════════
// TAB NAVIGATION DETECTION (for SPA support)
// ═══════════════════════════════════════════════════════════════════════════

// Detect when a tab navigates (covers both full page loads and SPA History API)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only act on URL changes (SPA navigation) or complete loads
  if (changeInfo.url || changeInfo.status === "complete") {
    // If this tab previously had a banner dismissed, reset for new page
    if (tabState.has(tabId)) {
      const state = tabState.get(tabId);
      // Only reset if URL actually changed
      if (changeInfo.url && changeInfo.url !== state.lastUrl) {
        state.lastUrl = changeInfo.url;
        state.dismissed = false;
        state.cssFallback = false;
        tabState.set(tabId, state);

        // Tell content script to re-scan
        try {
          chrome.tabs.sendMessage(tabId, { action: "reScan" }, () => {
            if (chrome.runtime.lastError) {
              // Content script not ready yet, that's fine — it will scan on its own
            }
          });
        } catch (e) { /* ignore */ }
      }
    }
  }
});

// Clean up state when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabState.delete(tabId);
});

// ═══════════════════════════════════════════════════════════════════════════
// INSTALLATION & STARTUP
// ═══════════════════════════════════════════════════════════════════════════

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Set default settings on first install
    chrome.storage.sync.set({ enabled: true });
    chrome.storage.local.set({
      totalDismissed: 0,
      blocklist: [],
      debug: false,
    });
  } else if (details.reason === "update") {
    // Migration logic for future versions
    const previousVersion = details.previousVersion;
    // Preserve existing settings on update
  }
});

// Load persisted stats on startup
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(["totalDismissed"], (data) => {
    if (data && data.totalDismissed) {
      stats.totalDismissed = data.totalDismissed;
    }
    updateGlobalBadge();
  });
});

// Also load on service worker wake
chrome.storage.local.get(["totalDismissed"], (data) => {
  if (data && data.totalDismissed) {
    stats.totalDismissed = data.totalDismissed;
  }
});
