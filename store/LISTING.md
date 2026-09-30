# Chrome Web Store submission kit

Everything to paste into the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole),
in the order the dashboard asks for it. Upload file: the zip attached to the
GitHub release (see `.github/workflows/release.yml`), or `npm run pack`.

---

## 1. Account (one time)

- **Trader status:** *Non-trader*. This is a free, personal, non-commercial project, so no business address or phone number is published.
- **Contact email:** required by the dashboard for Google to reach you. It is **not** shown on the listing unless you choose to show it.

---

## 2. Store listing tab

**Title** (comes from the manifest): I Don't Give a Cookie

**Summary** (comes from the manifest, 120 of 132 characters):
> Automatically accepts cookie consent banners on virtually any website, in 45+ languages and all major consent platforms.

**Description** (paste as is):

```
Tired of clicking "Accept" on every website? I Don't Give a Cookie finds cookie consent banners and accepts them for you, so you can get straight to the page.

WHAT IT DOES
• Accepts cookie banners automatically on virtually any website
• Works with 40+ consent platforms (OneTrust, Cookiebot, Didomi, Usercentrics, Quantcast, Sourcepoint, TrustArc, Klaro, Iubenda and more), using the platform's own "accept all" where possible
• Understands banners in 47 languages
• Handles banners in pop-ups, bottom bars, full-screen walls, iframes and shadow DOM
• Checks that the banner is really gone after clicking, and hides it if the site's own button is broken
• Restores scrolling when a banner has locked the page

CAREFUL BY DESIGN
• Only clicks inside boxes that talk about cookies or consent
• Never clicks "Reject", "Settings", "Subscribe", "Sign in" or ordinary links
• Never answers sign-up forms, Terms of Service, age checks ("Are you over 18?") or "Do Not Sell" privacy dialogs
• Built-in protection against click loops

YOUR CONTROL
• Turn it off for any site with one click from the toolbar popup
• Turn it off everywhere with the main switch
• See how many banners it has handled

PRIVATE
• Nothing leaves your browser: no servers, no analytics, no tracking
• Keeps no list of the sites you visit
• Open source: https://github.com/guizog-create/i-dont-give-a-cookie

GOOD TO KNOW
Accepting a banner means giving the website the consent it asks for, including cookies that may be used for advertising or analytics. If you would rather reject cookies, this extension is not the right tool for you.

Not affiliated with any consent platform or website.
```

**Category:** Productivity → *Tools* (or *Privacy & Security* if the dashboard offers it).

**Language:** English.

**Store icon:** `icons/icon128.png` (128×128).

**Screenshots** (1280×800, in this order): `store/screenshots/1-before-after.png`, `2-popup.png`, `3-careful.png`.

**Small promo tile** (440×280): `store/screenshots/promo-small.png`.

**Official URL / homepage:** https://github.com/guizog-create/i-dont-give-a-cookie

**Support URL:** https://github.com/guizog-create/i-dont-give-a-cookie/issues

---

## 3. Privacy tab

**Single purpose** (paste):
> Automatically accept cookie consent banners on websites, so users do not have to click them manually.

**Permission justifications** (one box each, paste):

- **storage**
  > Saves the user's settings (on/off switch, sites the user excluded, debug mode) and the banner statistics shown in the popup. All data stays on the device.

- **activeTab**
  > Lets the toolbar popup show which site the current tab is on, so the user can turn the extension off for that site.

- **scripting**
  > When a known consent platform's banner (e.g. OneTrust, Didomi, Cookiebot) is visibly on screen, the extension calls that platform's own "accept all" function in the page, which is more reliable than clicking. It runs only at that moment, only in the frame showing the banner, and only on sites the user has not excluded.

- **Host permission (all websites)**
  > Cookie consent banners can appear on any website, so the extension must be able to run on any page to detect and accept them. It only reads page content locally to find the banner and its accept button. Nothing is stored or transmitted.

**Are you using remote code?** No. All code is included in the package; nothing is downloaded or evaluated at runtime.

**Data usage: what user data do you collect?**
The extension transmits nothing off the device. Recommended answer, which is conservative:

- ☑ **Website content**: the extension reads page text locally to find cookie banners. It is not stored or transmitted.
- ☐ Everything else (personally identifiable information, health, financial, authentication, personal communications, location, web history, user activity): not collected.

> Why tick "Website content" if nothing leaves the device? Google's form asks what data the extension *handles* in some cases and what it *collects* in others. Declaring the one category the extension genuinely touches is the safe choice; declaring nothing while requesting access to all sites is a common reason for review questions. If the dashboard's wording makes clear it only covers data sent off the device, leaving everything unticked is also accurate.

**Certifications** (tick all three; all are true):
- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:**
https://github.com/guizog-create/i-dont-give-a-cookie/blob/main/PRIVACY.md

---

## 4. Distribution tab

- **Payments:** Free.
- **Visibility:** Public. (Choose *Unlisted* first if you want to try the store version yourself before anyone can find it.)
- **Regions:** All regions.

---

## 5. Before pressing "Submit for review"

- [ ] Uploaded zip version matches `manifest.json` (currently 2.7.0)
- [ ] You tried this exact version in your own Chrome for a day or two
- [ ] Privacy policy URL opens without logging in
- [ ] Screenshots show the current version

Review with access to all websites plus `scripting` is an in-depth review: expect days to a few weeks. If the reviewer asks questions, the permission justifications above are the answers.
