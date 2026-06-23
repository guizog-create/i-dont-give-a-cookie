// Edge case tests: unusual, tricky, or adversarial cookie banner patterns
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const CMP_ACCEPT_SELECTORS = JSON.parse(fs.readFileSync(path.join(__dirname, "cmp-selectors.json"), "utf-8"));

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
  "confirm", "understood", "i understand",
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

// Edge cases that should PASS (button should be found)
const SHOULD_PASS = [
  {
    name: "Button with extra whitespace and newlines",
    html: `<div class="cookie-banner" style="position:fixed;bottom:0;width:100%;z-index:9999;">
      <p>We use cookies.</p>
      <button class="accept">
        Accept   All
        Cookies
      </button>
    </div>`
  },
  {
    name: "Button inside deeply nested divs",
    html: `<div id="cookie-consent-wrapper" style="position:fixed;bottom:0;width:100%;z-index:9999;">
      <div class="inner"><div class="inner2"><div class="inner3"><div class="buttons">
        <button class="primary">Accept All</button>
      </div></div></div></div>
    </div>`
  },
  {
    name: "Input type=button instead of button element",
    html: `<div class="gdpr-notice" style="position:fixed;bottom:0;width:100%;z-index:9999;">
      <p>Cookie notice</p>
      <input type="button" value="Accept All Cookies" class="accept-btn">
    </div>`
  },
  {
    name: "Link styled as button (a tag with role=button)",
    html: `<div class="cookie-bar" style="position:fixed;bottom:0;width:100%;z-index:9999;">
      <p>This site uses cookies.</p>
      <a href="#" role="button" class="btn-accept">Accept All</a>
      <a href="/privacy">Privacy Policy</a>
    </div>`
  },
  {
    name: "Mixed case button text",
    html: `<div class="cookie-consent" style="position:fixed;bottom:0;width:100%;z-index:9999;">
      <p>Cookies help us deliver our services.</p>
      <button>ACCEPT ALL COOKIES</button>
    </div>`
  },
  {
    name: "Korean cookie banner",
    html: `<div class="cookie-notice" style="position:fixed;bottom:0;width:100%;z-index:9999;">
      <p>이 웹사이트는 쿠키를 사용합니다.</p>
      <button class="accept">모두 수락</button>
      <button class="settings">설정</button>
    </div>`
  },
  {
    name: "Chinese cookie banner (Simplified)",
    html: `<div class="cookie-notice" style="position:fixed;bottom:0;width:100%;z-index:9999;">
      <p>本网站使用Cookie来改善您的体验。</p>
      <button class="accept">全部接受</button>
      <a href="/privacy">隐私政策</a>
    </div>`
  },
  {
    name: "Russian cookie banner",
    html: `<div class="cookie-notice" style="position:fixed;bottom:0;width:100%;z-index:9999;">
      <p>Мы используем файлы cookie для улучшения вашего опыта.</p>
      <button class="accept">Принять все</button>
      <button class="settings">Настройки</button>
    </div>`
  },
  {
    name: "Turkish cookie banner",
    html: `<div class="cerez-bildirimi" style="position:fixed;bottom:0;width:100%;z-index:9999;">
      <p>Bu web sitesi çerezleri kullanmaktadır.</p>
      <button class="kabul">Tümünü kabul et</button>
      <a href="/gizlilik">Gizlilik Politikası</a>
    </div>`
  },
  {
    name: "Arabic cookie banner (RTL)",
    html: `<div class="cookie-notice" dir="rtl" style="position:fixed;bottom:0;width:100%;z-index:9999;">
      <p>يستخدم هذا الموقع ملفات تعريف الارتباط.</p>
      <button class="accept">قبول الكل</button>
    </div>`
  },
  {
    name: "Banner with data-consent attribute",
    html: `<div data-consent-banner="true" style="position:fixed;bottom:0;width:100%;z-index:9999;">
      <p>We use cookies to improve your experience.</p>
      <button data-consent-action="accept">Accept</button>
      <button data-consent-action="reject">Reject</button>
    </div>`
  },
  {
    name: "WordPress GDPR Cookie Compliance plugin",
    html: `<div id="moove_gdpr_cookie_info_bar" style="position:fixed;bottom:0;width:100%;z-index:9999;">
      <p>We are using cookies to give you the best experience.</p>
      <button class="mgbutton">Accept</button>
      <button class="mgbutton-settings">Settings</button>
    </div>`
  },
  {
    name: "Drupal EU Cookie Compliance",
    html: `<div class="eu-cookie-compliance-banner" style="position:fixed;bottom:0;width:100%;z-index:9999;">
      <p>We use cookies on this site to enhance your user experience.</p>
      <button class="eu-cookie-compliance-default-button agree-button">OK, I agree</button>
      <button class="find-more-button">No, give me more info</button>
    </div>`
  },
  {
    name: "Evidon / LiveRamp",
    html: `<div class="evidon-banner" style="position:fixed;bottom:0;width:100%;z-index:9999;">
      <p>This site uses cookies for analytics.</p>
      <button class="evidon-banner-acceptbutton">Accept</button>
      <button class="evidon-banner-optionsbutton">Options</button>
    </div>`
  },
  {
    name: "CookieFirst",
    html: `<div class="cookiefirst-root" style="position:fixed;bottom:0;width:100%;z-index:9999;">
      <p>We use cookies to improve your experience.</p>
      <button data-cookiefirst-action="accept">Accept all cookies</button>
      <button data-cookiefirst-action="reject">Reject all</button>
    </div>`
  },
];

// Edge cases that should NOT trigger (false positive prevention)
const SHOULD_NOT_PASS = [
  {
    name: "Newsletter signup (not a cookie banner)",
    html: `<div class="newsletter-popup" style="position:fixed;bottom:0;width:100%;z-index:9999;">
      <p>Subscribe to our newsletter for the latest updates!</p>
      <button class="subscribe-btn">Subscribe</button>
      <button class="close-btn">No thanks</button>
    </div>`
  },
  {
    name: "Login form (should not be clicked)",
    html: `<div class="login-modal" style="position:fixed;top:50%;left:50%;z-index:9999;">
      <h2>Log in to continue</h2>
      <input type="email" placeholder="Email">
      <input type="password" placeholder="Password">
      <button class="login-btn">Continue</button>
    </div>`
  },
  {
    name: "CAPTCHA / robot check",
    html: `<div class="captcha-container" style="position:fixed;top:50%;left:50%;z-index:9999;">
      <p>Please verify you are not a robot.</p>
      <button class="verify-btn">I'm not a robot</button>
    </div>`
  },
  {
    name: "Age verification gate",
    html: `<div class="age-gate" style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;">
      <p>Are you over 18? You must be of legal drinking age to enter this site.</p>
      <button class="yes-btn">Yes, I am over 18</button>
      <button class="no-btn">No</button>
    </div>`
  },
  {
    name: "Social media share buttons (should not be clicked)",
    html: `<div class="share-bar" style="position:fixed;bottom:0;width:100%;z-index:9999;">
      <a href="https://facebook.com/share" class="share-btn">Share on Facebook</a>
      <a href="https://twitter.com/share" class="share-btn">Share on Twitter</a>
      <button class="accept-invite">Accept Invite</button>
    </div>`
  },
];

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
        return { found: true, strategy: "CMP-specific", text: (el.textContent || "").trim().substring(0, 60) };
      }
    } catch (e) {}
  }

  // Strategy 2: Container-based
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

    const buttons = container.querySelectorAll("button, [role='button'], a.cc-btn, a.btn, a[role='button'], input[type='button'], input[type='submit']");
    for (const btn of buttons) {
      const btnText = (btn.textContent || btn.getAttribute("value") || "").toLowerCase().trim().replace(/\s+/g, " ");
      if (!btnText || btnText.length > 50) continue;
      if (NEGATIVE.some(n => btnText.includes(n))) continue;
      if (ACCEPT_STRONG.some(s => btnText.includes(s))) {
        return { found: true, strategy: "Container (strong)", text: btnText.substring(0, 60) };
      }
    }
    for (const btn of buttons) {
      const btnText = (btn.textContent || btn.getAttribute("value") || "").toLowerCase().trim().replace(/\s+/g, " ");
      if (!btnText || btnText.length > 50) continue;
      if (NEGATIVE.some(n => btnText.includes(n))) continue;
      if (ACCEPT_GENERIC.some(g => btnText === g || btnText.startsWith(g))) {
        return { found: true, strategy: "Container (generic)", text: btnText.substring(0, 60) };
      }
    }
  }

  // Strategy 3: ARIA
  const ariaSelectors = [
    "button[aria-label*='accept' i]", "button[aria-label*='Accept']",
    "[role='button'][aria-label*='accept' i]",
  ];
  for (const sel of ariaSelectors) {
    try {
      const el = document.querySelector(sel);
      if (el) {
        const t = (el.textContent || el.getAttribute("aria-label") || "").trim();
        if (!NEGATIVE.some(n => t.toLowerCase().includes(n))) {
          return { found: true, strategy: "ARIA", text: t.substring(0, 60) };
        }
      }
    } catch (e) {}
  }

  return { found: false };
}

// Run tests
console.log("=" .repeat(90));
console.log("EDGE CASE TEST SUITE");
console.log("=" .repeat(90));

console.log("\n--- SHOULD DETECT (True Positives) ---\n");
let tp = 0, fn = 0;
for (const tc of SHOULD_PASS) {
  const result = testCase(tc);
  if (result.found) {
    tp++;
    console.log(`  ✓ PASS  ${tc.name.padEnd(50)} [${result.strategy}] "${result.text}"`);
  } else {
    fn++;
    console.log(`  ✗ FAIL  ${tc.name.padEnd(50)} — Not detected`);
  }
}

console.log("\n--- SHOULD NOT DETECT (True Negatives / False Positive Prevention) ---\n");
let tn = 0, fp = 0;
const falsePositives = [];
for (const tc of SHOULD_NOT_PASS) {
  const result = testCase(tc);
  if (!result.found) {
    tn++;
    console.log(`  ✓ PASS  ${tc.name.padEnd(50)} — Correctly ignored`);
  } else {
    fp++;
    falsePositives.push(tc.name);
    console.log(`  ✗ FAIL  ${tc.name.padEnd(50)} — FALSE POSITIVE: "${result.text}" [${result.strategy}]`);
  }
}

console.log("\n" + "=" .repeat(90));
console.log(`TRUE POSITIVES:  ${tp}/${SHOULD_PASS.length} detected`);
console.log(`TRUE NEGATIVES:  ${tn}/${SHOULD_NOT_PASS.length} correctly ignored`);
console.log(`FALSE NEGATIVES: ${fn} (missed banners)`);
console.log(`FALSE POSITIVES: ${fp} (incorrectly triggered)`);
if (falsePositives.length > 0) {
  console.log(`  → ${falsePositives.join(", ")}`);
}
console.log("=" .repeat(90));

process.exit(fn + fp > 0 ? 1 : 0);
