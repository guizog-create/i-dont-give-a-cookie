# I Don't Give a Cookie

A Chrome extension that automatically accepts cookie consent banners on virtually any website. It covers 27 languages and 40+ Consent Management Platforms, verifies each click, falls back to CSS, supports SPAs, and has per-site controls. It is also careful never to click anything that isn't a cookie banner.

## Features

- **Two-stage detection**: exact selectors for 40+ known CMPs first, then a heuristic that starts from text mentioning cookies/consent and walks up to the floating box (fixed, sticky or dialog) that contains it
- **40+ CMP platforms**: OneTrust, Cookiebot, Didomi, Quantcast, TrustArc, Usercentrics, CookieYes, Osano, Complianz, Klaro, Iubenda, Termly, HubSpot, Sourcepoint, Consentmanager.net, Tarteaucitron, and many more
- **27 languages**: English, French, German, Spanish, Italian, Portuguese, Dutch, Polish, Swedish, Danish, Norwegian, Finnish, Czech, Romanian, Hungarian, Greek, Turkish, Russian, Ukrainian, Japanese, Chinese, Korean, Arabic, Thai, Vietnamese, Indonesian, Hindi
- **Click verification**: one activation per attempt, then it checks that the banner actually went away (fade-out animations are allowed for). It retries up to 3 times
- **CSS fallback**: if the CMP's button is broken, it hides the banner *and* its backdrop and restores scrolling
- **SPA support**: re-scans after client-side navigation (Navigation API, `popstate`, `hashchange`)
- **Cross-origin CMP iframes**: Sourcepoint, TrustArc and similar are handled inside their own frames, and state is attributed to the top-level site
- **Loop guard**: if a site reloads and shows the banner again, it stops after 6 clicks per minute and backs off for 10 minutes
- **Per-site controls**: block/allow from the popup. The page reacts immediately and the setting also covers CMP iframes on that site
- **Shadow DOM**: open shadow roots, plus closed ones on custom elements via `chrome.dom`
- **Safety guards**: never answers non-cookie dialogs ("Delete account?", sign-up or Terms dialogs, even ones that say "consent", feedback polls), never answers age gates, never touches boxes with form fields, and never clicks "reject/settings/subscribe/sign in", real navigation links, checkboxes, disabled buttons or CAPTCHA widgets
- **CMP JavaScript APIs**: for OneTrust, Cookiebot, Didomi, Usercentrics, Klaro, consentmanager, Cookie-Script, tarteaucitron and CookieConsent it calls the platform's own "accept all" (only while its banner is visible), then verifies, and falls back to clicking
- **Site rules as data**: per-site fixes in `rules/sites.json` (see [rules/README.md](rules/README.md))
- **Real-site crawler**: `npm run crawl` compares ~230 European sites with and without the extension and flags anything suspicious
- **Debug mode**: logs every decision to the page console with the `[IDGAC]` prefix
- **No runtime dependencies**: plain JavaScript, no build step

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (top-right toggle)
4. Click "Load unpacked" and select the repository folder
5. The extension icon appears in your toolbar

## How It Works

```
page load / SPA navigation / popup "Re-scan"
        │
        ▼
  ┌──────────── scanning (30 s window) ────────────┐
  │ triggers: retry timers + MutationObserver      │
  │ (throttled; full scan only when added nodes    │
  │  mention cookies/consent)                      │
  │                                                │
  │ 0. Site rule accept selectors (rules/sites.json)│
  │    CMP JavaScript API if its banner is visible │
  │ 1. Known CMP accept selectors                  │
  │    (gated: must sit inside a consent UI)       │
  │ 2. Consent containers                          │
  │    known CMP containers + text-anchored        │
  │    floating boxes → best-scoring accept button │
  └──────────────────────┬─────────────────────────┘
                         │ target found
                         ▼
          background loop guard → single click
                         │
                         ▼
     verifying (0.6–2 s): gone? → done (report stats)
                          still there? → retry (≤3) → CSS fallback
```

Keyword matching respects word boundaries for space-separated scripts, so "OK" doesn't match "Book now" and "agree" doesn't match "disagree". Words that are too ambiguous on their own ("OK", "Yes", "Close", "Continue") only count when they are the button's entire label, and only inside a container that talks about cookies or consent.

**Background service worker**: the single writer for statistics (no lost updates when several tabs report at once), per-tab status for the popup (in `storage.session`), the badge, the loop guard, and migration from the v2.1 storage layout.

## Popup Controls

| Control | Description |
|---------|-------------|
| Extension Enabled | Global on/off toggle (applies to open tabs immediately) |
| Block *domain* | Disable the extension on the site's registrable domain (e.g. `bbc.co.uk` from `news.bbc.co.uk`, via the Public Suffix List) and all its subdomains |
| Allow This Site | Re-enable it, including removing any parent-domain block |
| Re-scan | Force the page (and its CMP iframes) to look again |
| Debug Mode | Log detection decisions to the page console |

## Privacy

This extension:
- Runs entirely locally in your browser
- Makes zero network requests
- Stores only a dismissal count per site, the blocklist and your settings
- Does not collect, transmit, or share any data
- Has no analytics, telemetry, or tracking

## Permissions Explained

| Permission | Why |
|-----------|-----|
| `storage` | Settings, blocklist, per-site dismissal counts |
| `activeTab` | Lets the popup read the current tab's address when you open it |
| Content script on `<all_urls>` | Banners can appear on any site |

## Development

No build step. Edit the source files and reload the extension in `chrome://extensions/`.

```sh
npm install          # installs Playwright (dev only)
npm test             # end-to-end tests in real Chromium with the extension loaded
npm test -- --slow   # also the SPA test (~40 s)
npm test -- --perf   # also print the main-thread cost benchmark
npm run lint         # syntax check
npm run crawl        # real-site crawl → crawl-report/report.html (run from an EU network)
npm run pack         # dist/i-dont-give-a-cookie-<version>.zip for the Chrome Web Store
npm run update-psl   # regenerate psl-rules.js after bumping the psl dev dependency
```

Per-site fixes are data, not code: see [`rules/README.md`](rules/README.md) for the `rules/sites.json` format (`mode`, `accept`, `hide`, `reason`).

Tests live in `tests/`: each fixture in `tests/fixtures/` is a small page reproducing one real-world banner pattern or a false-positive trap, and `tests/e2e.js` asserts exactly what got clicked. When you add a CMP or fix a site, add a fixture for it.

## License

MIT License. See [LICENSE](LICENSE) for details.
