// I Don't Give a Cookie - Popup Controller
// v2.0.0

document.addEventListener("DOMContentLoaded", () => {
  const enableToggle = document.getElementById("enableToggle");
  const debugToggle = document.getElementById("debugToggle");
  const totalDismissedEl = document.getElementById("totalDismissed");
  const sitesCountEl = document.getElementById("sitesCount");
  const siteNameEl = document.getElementById("siteName");
  const siteDetailEl = document.getElementById("siteDetail");
  const statusDot = document.getElementById("statusDot");
  const blockSiteBtn = document.getElementById("blockSiteBtn");
  const allowSiteBtn = document.getElementById("allowSiteBtn");
  const reScanBtn = document.getElementById("reScanBtn");

  let currentHostname = "";
  let currentTabId = null;

  // ─── Load Settings ───────────────────────────────────────────────────

  chrome.storage.sync.get({ enabled: true }, (data) => {
    enableToggle.checked = data.enabled;
  });

  chrome.storage.local.get(["debug", "blocklist"], (data) => {
    debugToggle.checked = data.debug || false;
  });

  // ─── Load Stats ──────────────────────────────────────────────────────

  function loadStats() {
    chrome.storage.local.get(null, (data) => {
      let total = 0;
      let sites = 0;

      for (const key of Object.keys(data)) {
        if (key.startsWith("__IDGAC__")) {
          const entry = data[key];
          if (entry && entry.count > 0) {
            total += entry.count;
            sites++;
          }
        }
      }

      // Also check background stats
      if (data.totalDismissed && data.totalDismissed > total) {
        total = data.totalDismissed;
      }

      totalDismissedEl.textContent = total;
      sitesCountEl.textContent = sites;
    });
  }

  loadStats();

  // ─── Current Site Status ─────────────────────────────────────────────

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) return;

    const tab = tabs[0];
    currentTabId = tab.id;

    try {
      const url = new URL(tab.url);
      currentHostname = url.hostname;
      siteNameEl.textContent = currentHostname;

      // Check if site is blocked
      chrome.storage.local.get(["blocklist"], (data) => {
        const blocklist = data.blocklist || [];
        const isBlocked = blocklist.some(
          (p) => currentHostname === p || currentHostname.endsWith("." + p)
        );

        if (isBlocked) {
          statusDot.className = "dot blocked";
          siteDetailEl.textContent = "Blocked — extension disabled here";
          blockSiteBtn.style.display = "none";
          allowSiteBtn.style.display = "inline-flex";
        } else {
          // Check if banner was handled on this site
          const stateKey = "__IDGAC__" + currentHostname;
          chrome.storage.local.get([stateKey], (stateData) => {
            if (stateData && stateData[stateKey] && stateData[stateKey].count > 0) {
              statusDot.className = "dot active";
              siteDetailEl.textContent = `${stateData[stateKey].count} banner(s) dismissed`;
            } else {
              statusDot.className = "dot idle";
              siteDetailEl.textContent = "No banners detected";
            }
          });
        }
      });
    } catch (e) {
      siteNameEl.textContent = "N/A";
      siteDetailEl.textContent = "Cannot access this page";
    }
  });

  // ─── Event Handlers ──────────────────────────────────────────────────

  enableToggle.addEventListener("change", () => {
    chrome.storage.sync.set({ enabled: enableToggle.checked });
  });

  debugToggle.addEventListener("change", () => {
    chrome.storage.local.set({ debug: debugToggle.checked });
  });

  blockSiteBtn.addEventListener("click", () => {
    if (!currentHostname) return;

    chrome.storage.local.get(["blocklist"], (data) => {
      const blocklist = data.blocklist || [];
      if (!blocklist.includes(currentHostname)) {
        blocklist.push(currentHostname);
        chrome.storage.local.set({ blocklist }, () => {
          // Notify content script
          if (currentTabId) {
            chrome.tabs.sendMessage(currentTabId, {
              action: "toggleSite",
              blocked: true,
            }, () => {
              if (chrome.runtime.lastError) { /* ignore */ }
            });
          }
          // Update UI
          statusDot.className = "dot blocked";
          siteDetailEl.textContent = "Blocked — extension disabled here";
          blockSiteBtn.style.display = "none";
          allowSiteBtn.style.display = "inline-flex";
        });
      }
    });
  });

  allowSiteBtn.addEventListener("click", () => {
    if (!currentHostname) return;

    chrome.storage.local.get(["blocklist"], (data) => {
      let blocklist = data.blocklist || [];
      blocklist = blocklist.filter((p) => p !== currentHostname);
      chrome.storage.local.set({ blocklist }, () => {
        // Notify content script
        if (currentTabId) {
          chrome.tabs.sendMessage(currentTabId, {
            action: "toggleSite",
            blocked: false,
          }, () => {
            if (chrome.runtime.lastError) { /* ignore */ }
          });
        }
        // Update UI
        statusDot.className = "dot idle";
        siteDetailEl.textContent = "Extension active";
        blockSiteBtn.style.display = "inline-flex";
        allowSiteBtn.style.display = "none";
      });
    });
  });

  reScanBtn.addEventListener("click", () => {
    if (!currentTabId) return;

    chrome.tabs.sendMessage(currentTabId, { action: "reScan" }, (response) => {
      if (chrome.runtime.lastError) {
        siteDetailEl.textContent = "Could not reach page";
        return;
      }
      siteDetailEl.textContent = "Re-scanning...";
      // Refresh stats after a delay
      setTimeout(loadStats, 2000);
      setTimeout(() => {
        const stateKey = "__IDGAC__" + currentHostname;
        chrome.storage.local.get([stateKey], (stateData) => {
          if (stateData && stateData[stateKey] && stateData[stateKey].count > 0) {
            statusDot.className = "dot active";
            siteDetailEl.textContent = `${stateData[stateKey].count} banner(s) dismissed`;
          } else {
            statusDot.className = "dot idle";
            siteDetailEl.textContent = "No banners detected";
          }
        });
      }, 3000);
    });
  });
});
