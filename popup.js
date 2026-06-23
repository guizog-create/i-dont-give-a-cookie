// I Don't Give a Cookie - Popup Controller
// Manages the enabled state and displays statistics

const enabledCheckbox = document.getElementById("enabled");
const statusDot = document.getElementById("statusDot");
const totalCountEl = document.getElementById("totalCount");

// Load state from storage
function loadState() {
  chrome.storage.sync.get({ enabled: true }, (data) => {
    enabledCheckbox.checked = data.enabled;
    updateStatusDot(data.enabled);
  });
}

// Save enabled state
function saveState(enabled) {
  chrome.storage.sync.set({ enabled });
  updateStatusDot(enabled);
}

// Update the visual status indicator
function updateStatusDot(enabled) {
  statusDot.className = "status-indicator " + (enabled ? "active" : "inactive");
}

// Load and display statistics
function loadStats() {
  chrome.storage.local.get(null, (data) => {
    let totalClicks = 0;
    for (const key of Object.keys(data)) {
      if (key.startsWith("__IDGAC__") && data[key] && typeof data[key].count === "number") {
        totalClicks += data[key].count;
      }
    }
    totalCountEl.textContent = totalClicks.toLocaleString();
  });
}

// Event listeners
enabledCheckbox.addEventListener("change", () => {
  saveState(enabledCheckbox.checked);
});

// Initialize
loadState();
loadStats();
