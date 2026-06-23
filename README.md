# I Don't Give a Cookie 🍪🚫

A lightweight, universal Chrome extension that automatically accepts cookie consent banners on virtually any website. Save yourself thousands of unnecessary clicks!

## Features

- **Universal Detection Engine:** Uses a multi-layered approach to find and accept cookie banners.
- **CMP Framework Support:** Built-in exact selectors for all major Consent Management Platforms (OneTrust, Cookiebot, TrustArc, Usercentrics, Didomi, Quantcast, Osano, etc.).
- **Multilingual:** Recognizes "Accept" keywords in over 30 languages (English, French, German, Spanish, Italian, Dutch, Japanese, Chinese, etc.).
- **Shadow DOM Traversal:** Can pierce through Shadow DOMs used by modern cookie banners to find the accept button.
- **Smart Heuristics:** Safely ignores captchas, robot checks, and negative buttons ("Manage", "Reject", "Settings").
- **Performance Optimized:** Uses a debounced `MutationObserver` to handle dynamically loaded banners without slowing down your browser.
- **Cross-session Reliability:** Uses `chrome.storage.local` to remember which domains have been handled, preventing infinite redirect loops.

## Installation

### From Chrome Web Store
*(Coming soon)*

### Manual Installation (Developer Mode)

1. Clone or download this repository.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the `i-dont-give-a-cookie` directory.
5. Pin the extension to your toolbar for easy access!

## How It Works

The extension runs a lightweight content script on every page you visit. It employs 6 different strategies to find and dismiss cookie banners:

1. **CMP-Specific Selectors:** The fastest method. Checks for known IDs and classes used by major consent platforms.
2. **Container-Based Detection:** Finds elements that look like cookie banners (based on size, position, z-index, and keywords), then searches within them for an accept button.
3. **ARIA/Attribute Detection:** Looks for buttons with accessibility labels indicating they accept cookies.
4. **Overlay Detection:** Finds full-screen overlays/modals that contain cookie consent text.
5. **Iframe Consent:** Checks iframes (often used by TrustArc/Sourcepoint) for consent buttons.
6. **Full-Page Scan:** A strict fallback that scans the entire page for strong "Accept All" phrases.

## Usage

Once installed, the extension works automatically in the background. 

Click the extension icon to:
- Toggle the auto-accept functionality on/off.
- View statistics on how many cookie popups have been automatically handled.

If a website misbehaves or gets stuck in a loop, simply toggle the extension off for that session and reload the page.

## Privacy & Security

- **No Tracking:** This extension does not track your browsing history.
- **Local Storage Only:** All settings and statistics are stored locally on your device.
- **No External API Calls:** Everything runs entirely within your browser.

## Contributing

Contributions are welcome! If you find a website where the extension doesn't work, feel free to open an issue or submit a pull request with the necessary selectors or keywords.

## License

MIT License
