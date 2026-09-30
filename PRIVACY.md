# Privacy Policy: I Don't Give a Cookie

_Last updated: 30 September 2026_

I Don't Give a Cookie is a browser extension that accepts cookie consent banners for you. It is a free, non-commercial project published by an individual. This policy explains exactly what the extension does with data. The short version: **nothing leaves your browser.**

## What the extension does not do

- It sends **no data anywhere**. The extension makes no network requests of its own: no servers, no analytics, no telemetry, no crash reporting, no ads.
- It does **not** sell, share, or transfer any data to anyone.
- It does **not** collect personal information, account details, passwords, form contents, financial or health information, or your location.
- It does **not** keep a list of the websites you visit.
- It loads **no remote code**. Everything it runs is contained in the published package.

## What the extension reads on web pages

To find a cookie banner, the extension reads the text and layout of the pages you open (for example, to recognise a box that says "We use cookies" and its "Accept all" button). This happens **only inside your browser**, only to find and answer cookie banners, and nothing it reads is stored or sent anywhere.

When a known consent platform's banner is visible (for example OneTrust or Didomi), the extension may call that platform's own "accept all" function on the page instead of clicking. This also happens only in your browser.

## What the extension stores, and where

All of this stays on your device, in the browser's own extension storage. None of it is sent to the developer or anyone else.

| Stored | Where | Why |
|---|---|---|
| On/off setting (a single yes/no value) | Chrome sync storage | So the switch in the popup is remembered. If you use Chrome sync, Google syncs this one value across your own devices, as it does for other browser settings. |
| Sites you chose to block | Local storage on this device | So the extension stays off on sites you excluded. You add and remove these yourself in the popup. |
| Number of banners handled, and a count of distinct sites | Local storage on this device | For the statistics shown in the popup. Sites are stored only as a salted one-way hash, which can count them but cannot be turned back into site names. |
| Debug-mode setting | Local storage on this device | Remembers whether you turned on debug logging. |
| Recent activity: which banner was handled on which site, and how | Memory only (session storage) | Shown in the popup for the current page, and used to stop the extension from clicking in a loop. Limited to recent sites and **erased when you close the browser**. |

If you turn on **debug mode**, the extension writes its decisions to the browser's developer console on the page. This log stays in your browser.

## Permissions

| Permission | Why it is needed |
|---|---|
| Access to all websites | Cookie banners can appear on any website, so the extension must be able to run on any page to find and accept them. |
| `scripting` | To call a consent platform's own "accept all" function on the page, only at the moment a visible banner is being accepted. |
| `storage` | To save the settings and statistics described above. |
| `activeTab` | So the popup can show which site the current tab is on when you open it. |

## Your control

- Turn the extension off entirely, or on specific sites, from its popup.
- Removing the extension deletes everything it stored, including the synced on/off setting.

## Children

The extension is not directed at children and does not knowingly process any information about them. It processes no personal information at all.

## Changes

If this policy changes, the new version will be published at this address with a new "Last updated" date. The full history of changes is public in the project's repository.

## Contact

Questions or concerns: please open an issue at
<https://github.com/guizog-create/i-dont-give-a-cookie/issues>
