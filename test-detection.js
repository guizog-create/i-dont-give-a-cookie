// Test detection logic against real page HTML snapshots using JSDOM
// This avoids timeout issues with full Puppeteer navigation

const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

// Simulated HTML snippets representing real cookie banners from various CMPs
const TEST_CASES = [
  {
    name: "OneTrust (BBC, Reuters, IKEA style)",
    cmp: "OneTrust",
    html: `<div id="onetrust-banner-sdk" class="otFlat" style="position:fixed;bottom:0;width:100%;z-index:2147483645;">
      <div class="ot-sdk-container">
        <div class="ot-sdk-row">
          <div id="onetrust-group-container">
            <p>We use cookies and similar technologies to help personalise content, tailor and measure ads, and provide a better experience.</p>
          </div>
          <div id="onetrust-button-group">
            <button id="onetrust-accept-btn-handler">Accept All Cookies</button>
            <button id="onetrust-pc-btn-handler">Cookie Settings</button>
            <button class="onetrust-close-btn-handler">×</button>
          </div>
        </div>
      </div>
    </div>`
  },
  {
    name: "Cookiebot (Cybot)",
    cmp: "Cookiebot",
    html: `<div id="CybotCookiebotDialog" style="position:fixed;bottom:0;width:100%;z-index:2147483647;">
      <div id="CybotCookiebotDialogBody">
        <p>This website uses cookies to ensure you get the best experience on our website.</p>
        <div id="CybotCookiebotDialogBodyButtons">
          <button id="CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll">Allow all</button>
          <button id="CybotCookiebotDialogBodyButtonDecline">Deny</button>
          <button id="CybotCookiebotDialogBodyButtonAccept">Allow selection</button>
        </div>
      </div>
    </div>`
  },
  {
    name: "Didomi (Le Monde, Le Figaro style)",
    cmp: "Didomi",
    html: `<div id="didomi-host" style="position:fixed;bottom:0;width:100%;z-index:2147483647;">
      <div id="didomi-notice">
        <p>Nous utilisons des cookies pour vous offrir la meilleure expérience.</p>
        <button id="didomi-notice-agree-button">Accepter et fermer</button>
        <button id="didomi-notice-learn-more-button">En savoir plus</button>
      </div>
    </div>`
  },
  {
    name: "Quantcast Choice",
    cmp: "Quantcast",
    html: `<div class="qc-cmp2-container" style="position:fixed;bottom:0;width:100%;z-index:9999;">
      <div class="qc-cmp2-summary-section">
        <p>We and our partners use cookies to Store and/or access information on a device.</p>
      </div>
      <div class="qc-cmp2-summary-buttons">
        <button mode="primary" class="qc-cmp2-button">AGREE</button>
        <button mode="secondary" class="qc-cmp2-button">MANAGE OPTIONS</button>
      </div>
    </div>`
  },
  {
    name: "TrustArc (Truste)",
    cmp: "TrustArc",
    html: `<div id="truste-consent-track" style="position:fixed;bottom:0;width:100%;z-index:999999;">
      <div id="truste-consent-content">
        <p>This site uses cookies to provide you with a great user experience.</p>
        <button id="truste-consent-button">I Agree</button>
        <a id="truste-consent-required">Cookie Preferences</a>
      </div>
    </div>`
  },
  {
    name: "Usercentrics",
    cmp: "Usercentrics",
    html: `<div id="usercentrics-root" style="position:fixed;bottom:0;width:100%;z-index:99999;">
      <div class="uc-banner">
        <p>This website uses cookies to ensure the best experience.</p>
        <button id="uc-btn-accept-banner">Accept All</button>
        <button id="uc-btn-deny-banner">Deny</button>
        <button id="uc-btn-more-info-banner">More Info</button>
      </div>
    </div>`
  },
  {
    name: "CookieYes",
    cmp: "CookieYes",
    html: `<div class="cky-consent-container" style="position:fixed;bottom:0;width:100%;z-index:999999;">
      <div class="cky-consent-bar">
        <p>We use cookies on our website to give you the most relevant experience.</p>
        <div class="cky-notice-btn-wrapper">
          <button class="cky-btn cky-btn-accept" data-cky-tag="accept-button">Accept All</button>
          <button class="cky-btn cky-btn-reject">Reject All</button>
          <button class="cky-btn cky-btn-customize">Customize</button>
        </div>
      </div>
    </div>`
  },
  {
    name: "Osano",
    cmp: "Osano",
    html: `<div class="osano-cm-window osano-cm-window--type_bar" style="position:fixed;bottom:0;width:100%;z-index:999999;">
      <p class="osano-cm-message">This site uses cookies.</p>
      <div class="osano-cm-buttons">
        <button class="osano-cm-accept-all osano-cm-button">Accept All</button>
        <button class="osano-cm-manage osano-cm-button">Manage Preferences</button>
        <button class="osano-cm-deny osano-cm-button">Deny</button>
      </div>
    </div>`
  },
  {
    name: "Complianz (WordPress)",
    cmp: "Complianz",
    html: `<div class="cmplz-cookiebanner cmplz-show" style="position:fixed;bottom:0;width:100%;z-index:999999;">
      <div class="cmplz-body">
        <p>We use cookies to optimize our website and our service.</p>
        <div class="cmplz-buttons">
          <button class="cmplz-btn cmplz-accept">Accept</button>
          <button class="cmplz-btn cmplz-deny">Deny</button>
          <button class="cmplz-btn cmplz-view-preferences">Preferences</button>
        </div>
      </div>
    </div>`
  },
  {
    name: "HubSpot EU Cookie Banner",
    cmp: "HubSpot",
    html: `<div id="hs-eu-cookie-confirmation" style="position:fixed;top:0;width:100%;z-index:999999;">
      <div id="hs-eu-cookie-confirmation-inner">
        <p>This website stores cookies on your computer.</p>
        <div id="hs-eu-cookie-confirmation-button-group">
          <button id="hs-eu-confirmation-button">Accept</button>
          <button id="hs-eu-decline-button">Decline</button>
        </div>
      </div>
    </div>`
  },
  {
    name: "Klaro",
    cmp: "Klaro",
    html: `<div class="klaro" style="position:fixed;bottom:0;width:100%;z-index:999999;">
      <div class="cookie-modal">
        <div class="cm-body">
          <p>We use cookies and similar technologies.</p>
          <div class="cm-footer">
            <button class="cm-btn cm-btn-accept-all">Accept all</button>
            <button class="cm-btn cm-btn-decline">Decline</button>
          </div>
        </div>
      </div>
    </div>`
  },
  {
    name: "Iubenda",
    cmp: "Iubenda",
    html: `<div class="iubenda-cs-container" style="position:fixed;bottom:0;width:100%;z-index:99999999;">
      <div class="iubenda-cs-content">
        <p>Questo sito utilizza cookie tecnici e di profilazione.</p>
        <div class="iubenda-cs-opt-group">
          <button class="iubenda-cs-accept-btn">Accetta</button>
          <button class="iubenda-cs-reject-btn">Rifiuta</button>
          <a class="iubenda-cs-customize-btn">Personalizza</a>
        </div>
      </div>
    </div>`
  },
  {
    name: "Tarteaucitron (French sites)",
    cmp: "Tarteaucitron",
    html: `<div id="tarteaucitronRoot" style="position:fixed;bottom:0;width:100%;z-index:2147483647;">
      <div id="tarteaucitronAlertBig">
        <span>Ce site utilise des cookies et vous donne le contrôle sur ceux que vous souhaitez activer.</span>
        <button id="tarteaucitronAllAllowed" class="tarteaucitronAllow">Tout accepter</button>
        <button id="tarteaucitronAllDenied2">Tout refuser</button>
        <button id="tarteaucitronPersonalize">Personnaliser</button>
      </div>
    </div>`
  },
  {
    name: "Cookie Consent by Insites (cc-banner)",
    cmp: "Cookie Consent (Insites)",
    html: `<div class="cc-window cc-banner cc-type-info" style="position:fixed;bottom:0;width:100%;z-index:9999;">
      <span class="cc-message">This website uses cookies to ensure you get the best experience.</span>
      <div class="cc-compliance">
        <a class="cc-btn cc-allow">Allow cookies</a>
      </div>
    </div>`
  },
  {
    name: "Consentmanager.net",
    cmp: "Consentmanager",
    html: `<div id="cmpbox" class="cmpbox" style="position:fixed;bottom:0;width:100%;z-index:99999;">
      <div class="cmpboxinner">
        <p>Wir verwenden Cookies und ähnliche Technologien.</p>
        <div class="cmpboxbtns">
          <button class="cmpboxbtn cmpboxbtnyes">Alle akzeptieren</button>
          <button class="cmpboxbtn cmpboxbtnno">Ablehnen</button>
        </div>
      </div>
    </div>`
  },
  {
    name: "Stack Exchange (custom - close button pattern)",
    cmp: "Custom (Stack Exchange)",
    html: `<div class="js-consent-banner" style="position:fixed;bottom:0;left:0;width:350px;z-index:5050;background:#232629;color:white;padding:16px;">
      <p>By continuing to use this website, you agree Stack Exchange can store cookies on your device.</p>
      <div>
        <button class="js-accept-cookies s-btn s-btn__primary">Necessary cookies only</button>
        <button class="js-cookie-settings">Customize settings</button>
      </div>
    </div>`
  },
  {
    name: "Generic banner - English (Accept All)",
    cmp: "Generic",
    html: `<div id="cookie-banner" style="position:fixed;bottom:0;width:100%;z-index:9999;background:#333;color:white;padding:20px;">
      <p>We use cookies to improve your experience. By using our site, you agree to our use of cookies.</p>
      <button class="accept-btn" onclick="acceptCookies()">Accept All Cookies</button>
      <a href="/privacy">Learn More</a>
    </div>`
  },
  {
    name: "Generic banner - German (Alle akzeptieren)",
    cmp: "Generic (DE)",
    html: `<div class="cookie-hinweis" style="position:fixed;bottom:0;width:100%;z-index:9999;background:#f5f5f5;padding:20px;">
      <p>Diese Website verwendet Cookies, um Ihnen die bestmögliche Erfahrung zu bieten.</p>
      <button class="btn-accept">Alle akzeptieren</button>
      <button class="btn-settings">Einstellungen</button>
    </div>`
  },
  {
    name: "Generic banner - Spanish (Aceptar todas)",
    cmp: "Generic (ES)",
    html: `<div class="aviso-cookies" style="position:fixed;bottom:0;width:100%;z-index:9999;background:white;padding:20px;border-top:1px solid #ccc;">
      <p>Utilizamos cookies para mejorar su experiencia en nuestro sitio web.</p>
      <button class="btn-aceptar">Aceptar todas las cookies</button>
      <a href="/politica-cookies">Política de cookies</a>
    </div>`
  },
  {
    name: "Generic banner - Japanese (すべて受け入れる)",
    cmp: "Generic (JA)",
    html: `<div class="cookie-notice" style="position:fixed;bottom:0;width:100%;z-index:9999;background:#fff;padding:20px;border-top:2px solid #ddd;">
      <p>当サイトではCookieを使用しています。</p>
      <button class="accept-all">すべて受け入れる</button>
      <a href="/privacy">プライバシーポリシー</a>
    </div>`
  },
  {
    name: "Generic banner - Dutch (Alles accepteren)",
    cmp: "Generic (NL)",
    html: `<div class="cookie-melding" style="position:fixed;bottom:0;width:100%;z-index:9999;background:#f8f8f8;padding:20px;">
      <p>Wij gebruiken cookies om uw ervaring te verbeteren.</p>
      <button class="accept-cookies">Alles accepteren</button>
      <button class="manage-cookies">Voorkeuren beheren</button>
    </div>`
  },
  {
    name: "ARIA-based detection",
    cmp: "ARIA",
    html: `<div role="dialog" aria-label="Cookie consent" style="position:fixed;bottom:0;width:100%;z-index:9999;">
      <p>We value your privacy.</p>
      <button aria-label="Accept all cookies">OK</button>
      <button aria-label="Manage cookie preferences">Manage</button>
    </div>`
  },
  {
    name: "Overlay/modal pattern",
    cmp: "Overlay",
    html: `<div class="cookie-overlay" style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;background:rgba(0,0,0,0.5);">
      <div class="cookie-modal" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:white;padding:30px;width:500px;">
        <h2>Cookie Consent</h2>
        <p>We use cookies to provide you with a better experience.</p>
        <button class="accept-all-btn">Accept All</button>
        <button class="reject-btn">Reject All</button>
      </div>
    </div>`
  },
  {
    name: "Shopify native cookie banner",
    cmp: "Shopify",
    html: `<div id="shopify-pc" style="position:fixed;bottom:0;width:100%;z-index:2147483647;">
      <div id="shopify-pc__banner">
        <p>This store uses cookies to improve your experience.</p>
        <button id="shopify-pc__banner__btn-accept">Accept</button>
        <button id="shopify-pc__banner__btn-manage">Manage preferences</button>
      </div>
    </div>`
  },
  {
    name: "Borlabs Cookie (WordPress DE)",
    cmp: "Borlabs",
    html: `<div id="BorlabsCookieBoxWrap" style="position:fixed;bottom:0;width:100%;z-index:999999;">
      <div class="BorlabsCookie">
        <p>Wir verwenden Cookies auf unserer Website.</p>
        <button class="cookie-accept-all" data-cookie-accept-all>Alle Cookies akzeptieren</button>
        <button class="cookie-preference">Einstellungen</button>
      </div>
    </div>`
  },
  {
    name: "Microsoft / Bing consent",
    cmp: "Microsoft",
    html: `<div id="wcpConsentBannerCtrl" style="position:fixed;bottom:0;width:100%;z-index:9999;">
      <div class="wcp-consent-banner">
        <p>Microsoft uses cookies for analytics and advertising.</p>
        <button id="bnp_btn_accept">Accept</button>
        <button id="bnp_btn_reject">Reject</button>
        <a href="/privacy">Privacy</a>
      </div>
    </div>`
  },
];

// Our CMP selectors (from content.js)
const CMP_ACCEPT_SELECTORS = JSON.parse(fs.readFileSync(path.join(__dirname, "cmp-selectors.json"), "utf-8"));

// Multilingual accept keywords
const ACCEPT_STRONG = [
  "accept all", "accept all cookies", "allow all", "allow all cookies", "agree to all",
  "i agree", "accept & continue", "accept and continue", "accept cookies",
  "accepter tout", "tout accepter", "j'accepte", "accepter et fermer",
  "alle akzeptieren", "alles akzeptieren", "alle cookies akzeptieren", "ich stimme zu",
  "aceptar todo", "aceptar todas", "aceptar todas las cookies",
  "accetta tutto", "accetta tutti", "accetta tutti i cookie", "accetto",
  "aceitar tudo", "aceitar todos",
  "alles accepteren", "alle cookies accepteren", "akkoord",
  "acceptera alla", "godkänn alla",
  "accepter alle", "godkend alle",
  "godta alle", "aksepter alle",
  "hyväksy kaikki",
  "přijmout vše", "přijmout všechny",
  "acceptă tot", "acceptă toate",
  "elfogad mindent", "összes elfogadása",
  "αποδοχή όλων",
  "tümünü kabul et", "hepsini kabul et",
  "принять все",
  "прийняти всі",
  "すべて受け入れる", "すべてのcookieを受け入れる", "同意する",
  "全部接受", "接受所有", "全部同意",
  "모두 수락", "모두 동의",
  "قبول الكل",
  "ยอมรับทั้งหมด",
  "chấp nhận tất cả",
  "terima semua",
  "सभी स्वीकार करें",
];

const ACCEPT_GENERIC = [
  "accept", "agree", "allow", "consent", "ok", "okay", "got it", "continue",
  "confirm", "understood", "i understand", "close",
  "accepter", "acceptez",
  "akzeptieren", "zustimmen", "einverstanden",
  "aceptar", "acepto",
  "accetta", "accetto",
  "aceitar", "concordo",
  "accepteren", "akkoord",
  "acceptera", "godkänn",
  "accepter", "godkend",
  "godta", "aksepter",
  "hyväksy", "hyväksyn",
  "přijmout", "souhlasím",
  "acceptă", "accept",
  "elfogad", "elfogadom",
  "αποδοχή", "αποδέχομαι",
  "kabul", "kabul et",
  "принять", "согласен",
  "прийняти", "згоден",
  "同意", "承認", "受け入れる",
  "接受", "同意",
  "수락", "동의",
  "قبول",
  "ยอมรับ",
  "chấp nhận", "đồng ý",
  "terima",
  "स्वीकार",
];

const NEGATIVE = [
  "manage", "preferences", "settings", "customize", "customise", "learn more",
  "more info", "reject", "decline", "deny", "refuse", "only necessary",
  "cookie policy", "privacy policy", "save preferences", "personalize",
  "personnaliser", "einstellungen", "personalizar", "personalizza",
  "voorkeuren", "beheren",
];

function isVisible(el) {
  const style = el.style || {};
  if (style.display === "none" || style.visibility === "hidden") return false;
  return true;
}

function testCase(tc) {
  const dom = new JSDOM(`<html><body>${tc.html}</body></html>`, {
    url: "https://example.com",
    pretendToBeVisual: true,
  });
  const document = dom.window.document;

  // Strategy 1: CMP selectors
  for (const selector of CMP_ACCEPT_SELECTORS) {
    try {
      const el = document.querySelector(selector);
      if (el) {
        return { found: true, strategy: "CMP-specific", selector, text: (el.textContent || "").trim().substring(0, 60) };
      }
    } catch (e) {}
  }

  // Strategy 2: Container-based with keyword matching
  const containers = document.querySelectorAll("div, section, aside, dialog, form, [role='dialog'], [role='alertdialog']");
  for (const container of containers) {
    const idClass = ((container.id || "") + " " + (container.className || "")).toLowerCase();
    const innerText = (container.textContent || "").toLowerCase();
    const COOKIE_HINTS = ["cookie", "consent", "gdpr", "privacy", "banner", "notice", "compliance", "dsgvo", "rgpd",
      "çerez", "cerez", "consentement", "confidentialité", "datenschutz", "privatsphäre",
      "consentimiento", "privacidad", "consenso", "toestemming", "ciasteczka",
      "kakor", "samtycke", "evästeet", "eväste", "souhlas", "sütik", "süti",
      "gizlilik", "onay", "куки", "согласие", "конфиденциальность",
      "クッキー", "쿠키", "คุกกี้", "كوكيز", "कुकी"];
    const hasCookieHint = COOKIE_HINTS.some(h => idClass.includes(h) || innerText.includes(h));
    if (!hasCookieHint) continue;

    const buttons = container.querySelectorAll("button, [role='button'], a.cc-btn, a.btn, input[type='button'], input[type='submit']");
    for (const btn of buttons) {
      const btnText = (btn.textContent || btn.value || "").toLowerCase().trim();
      if (!btnText || btnText.length > 50) continue;
      if (NEGATIVE.some(n => btnText.includes(n))) continue;
      if (ACCEPT_STRONG.some(s => btnText.includes(s))) {
        return { found: true, strategy: "Container (strong match)", selector: describeSel(btn), text: btnText.substring(0, 60) };
      }
    }
    // Second pass for generic
    for (const btn of buttons) {
      const btnText = (btn.textContent || btn.value || "").toLowerCase().trim();
      if (!btnText || btnText.length > 50) continue;
      if (NEGATIVE.some(n => btnText.includes(n))) continue;
      if (ACCEPT_GENERIC.some(g => btnText === g || btnText.startsWith(g))) {
        return { found: true, strategy: "Container (generic match)", selector: describeSel(btn), text: btnText.substring(0, 60) };
      }
    }
  }

  // Strategy 3: ARIA-based
  const ariaSelectors = [
    "button[aria-label*='accept' i]", "button[aria-label*='Accept']",
    "[role='button'][aria-label*='accept' i]",
    "button[aria-label*='agree' i]", "button[aria-label*='Allow']",
  ];
  for (const sel of ariaSelectors) {
    try {
      const el = document.querySelector(sel);
      if (el) {
        const t = (el.textContent || el.getAttribute("aria-label") || "").trim();
        if (!NEGATIVE.some(n => t.toLowerCase().includes(n))) {
          return { found: true, strategy: "ARIA-based", selector: sel, text: t.substring(0, 60) };
        }
      }
    } catch (e) {}
  }

  return { found: false };
}

function describeSel(el) {
  let desc = el.tagName.toLowerCase();
  if (el.id) desc += "#" + el.id;
  else if (el.className) desc += "." + el.className.trim().split(/\s+/).slice(0, 2).join(".");
  return desc;
}

// Run all tests
console.log("=" .repeat(90));
console.log("COOKIE CONSENT DETECTION TEST SUITE");
console.log("=" .repeat(90));
console.log("");

let pass = 0, fail = 0;
const failures = [];

for (const tc of TEST_CASES) {
  const result = testCase(tc);
  if (result.found) {
    pass++;
    console.log(`  ✓ PASS  ${tc.name.padEnd(45)} [${result.strategy}] "${result.text}"`);
  } else {
    fail++;
    failures.push(tc.name);
    console.log(`  ✗ FAIL  ${tc.name.padEnd(45)} — No accept button detected`);
  }
}

console.log("");
console.log("=" .repeat(90));
console.log(`RESULTS: ${pass} PASS / ${fail} FAIL / ${TEST_CASES.length} TOTAL`);
if (failures.length > 0) {
  console.log(`FAILURES: ${failures.join(", ")}`);
}
console.log("=" .repeat(90));

process.exit(fail > 0 ? 1 : 0);
