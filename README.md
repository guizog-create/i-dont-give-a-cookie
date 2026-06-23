# I Don't Give a Cookie

A bulletproof Chrome extension that automatically accepts cookie consent banners on virtually any website. Supports 30+ languages, 40+ Consent Management Platforms, with click verification, CSS fallback, SPA support, and per-site controls.

## Features

- **Universal Detection Engine** — 6-strategy pipeline that handles known CMPs, heuristic banners, ARIA attributes, overlays, iframes, and full-page scans
- **40+ CMP Platforms** — OneTrust, Cookiebot, Didomi, Quantcast, TrustArc, Usercentrics, CookieYes, Osano, Complianz, Klaro, Iubenda, Termly, HubSpot, Sourcepoint, Consentmanager.net, Tarteaucitron, and many more
- **30+ Languages** — English, French, German, Spanish, Italian, Portuguese, Dutch, Polish, Swedish, Danish, Norwegian, Finnish, Czech, Romanian, Hungarian, Greek, Turkish, Russian, Ukrainian, Japanese, Chinese, Korean, Arabic, Thai, Vietnamese, Indonesian, Hindi
- **Click Verification** — Confirms banners are actually dismissed after clicking; retries with alternative methods if not
- **CSS Fallback** — If clicks fail after multiple attempts, hides banners via CSS injection as a safety net
- **SPA Support** — Detects single-page application navigation (History API, popstate, hashchange) and re-scans for new banners
- **Background Service Worker** — Coordinates across tabs, manages badge notifications, handles navigation events
- **Per-Site Controls** — Block/allow the extension on specific sites from the popup
- **Shadow DOM Traversal** — Pierces through shadow roots used by modern web components
- **Anti-False-Positive Guards** — Won't click CAPTCHAs, robot checks, social buttons, newsletter signups, or navigation links
- **Debug Mode** — Toggle console logging for troubleshooting
- **Zero External Dependencies** — Pure JavaScript, no build step required

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (top-right toggle)
4. Click "Load unpacked" and select the repository folder
5. The extension icon appears in your toolbar

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Background Service Worker              │
│  - Tab navigation detection (SPA support)                │
│  - Badge management                                      │
│  - Cross-tab state coordination                          │
│  - Message routing                                       │
└────────────────────────┬────────────────────────────────┘
                         │ chrome.runtime messages
┌────────────────────────▼────────────────────────────────┐
│                    Content Script (per tab)               │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Detection Pipeline (runs in order)               │    │
│  │                                                  │    │
│  │  1. CMP-Specific Selectors (100+ selectors)     │    │
│  │  2. Container-Based Detection (heuristic)        │    │
│  │  3. ARIA/Attribute Detection                     │    │
│  │  4. Overlay/Backdrop Detection                   │    │
│  │  5. Iframe Consent Detection                     │    │
│  │  6. Full-Page Scan (strict, last resort)         │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Click Engine                                     │    │
│  │  - Full mouse event sequence (pointer + mouse)   │    │
│  │  - Direct .click() fallback                      │    │
│  │  - Keyboard Enter fallback                       │    │
│  │  - Post-click verification (600ms)               │    │
│  │  - Retry up to 3 times                           │    │
│  │  - CSS fallback on exhaustion                    │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Observation & Scheduling                         │    │
│  │  - MutationObserver (childList, debounced)       │    │
│  │  - Progressive retries (100ms → 25s)             │    │
│  │  - SPA navigation detection (History API patch)  │    │
│  │  - Auto-disconnect after 30s                     │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    Popup UI                               │
│  - Global enable/disable toggle                          │
│  - Per-site block/allow controls                         │
│  - Re-scan button                                        │
│  - Statistics (banners dismissed, sites handled)          │
│  - Debug mode toggle                                     │
└─────────────────────────────────────────────────────────┘
```

## How It Works

The extension runs a content script on every page that executes a 6-strategy detection pipeline. Each strategy is progressively less specific but covers more edge cases:

**Strategy 1 (CMP Selectors)** targets known platforms by their exact DOM selectors. This is the fastest and most reliable method, handling the majority of sites.

**Strategy 2 (Container Detection)** finds banner-like containers by their class/ID patterns, position (fixed/sticky), z-index, and cookie-related text content, then locates the accept button within.

**Strategy 3 (ARIA/Attributes)** finds buttons via `aria-label`, `data-action`, `data-consent`, and similar attributes.

**Strategy 4 (Overlay Detection)** identifies full-screen overlays containing consent text and finds the accept button inside.

**Strategy 5 (Iframe Consent)** handles CMPs that render inside iframes (same-origin only due to browser security).

**Strategy 6 (Full-Page Scan)** is the last resort — scans all visible buttons for strong "Accept All" phrases only, with strict filtering to prevent false positives.

After clicking, the **Click Verification** system waits 600ms and checks if the banner is still visible. If so, it retries with alternative click methods. After 3 failed attempts, it injects **CSS rules** to force-hide the banner and restore page scrolling.

## Popup Controls

| Control | Description |
|---------|-------------|
| Extension Enabled | Global on/off toggle |
| Block This Site | Disable the extension on the current domain |
| Allow This Site | Re-enable after blocking |
| Re-scan | Force the extension to re-check for banners |
| Debug Mode | Enable console logging for troubleshooting |

## Privacy

This extension:
- Runs entirely locally in your browser
- Makes zero network requests
- Stores only minimal state (click counts per domain, blocklist)
- Does not collect, transmit, or share any data
- Has no analytics, telemetry, or tracking

## Permissions Explained

| Permission | Why |
|-----------|-----|
| `storage` | Save enabled state, per-site click counts, blocklist, and debug preference |
| `tabs` | Detect tab navigation for SPA support and show current site info in popup |
| `activeTab` | Access the current tab's URL to display site status in popup |

## Development

No build step required. Edit the source files directly and reload the extension in `chrome://extensions/`.

To enable debug logging, toggle "Debug Mode" in the popup. All detection actions will be logged to the browser console with the `[IDGAC]` prefix.

## License

MIT License. See [LICENSE](LICENSE) for details.
