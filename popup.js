const enabledCheckbox = document.getElementById("enabled");

function loadState() {
  chrome.storage.sync.get({ enabled: true }, (data) => {
    enabledCheckbox.checked = data.enabled;
  });
}

function saveState(enabled) {
  chrome.storage.sync.set({ enabled });
}

enabledCheckbox.addEventListener("change", () => {
  saveState(enabledCheckbox.checked);
});

loadState();