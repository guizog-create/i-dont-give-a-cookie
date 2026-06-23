// I Don't Give a Cookie - Universal Cookie Consent Auto-Acceptor
// v1.0.0 - Production-grade engine with CMP support, multilingual detection,
// shadow DOM traversal, debounced observers, and advanced heuristics.

(() => {
  "use strict";

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  const CONFIG = {
    // Max accept clicks per domain per session (prevents infinite loops)
    maxClicksPerDomain: 5,
    // Debounce interval for MutationObserver (ms)
    debounceMs: 150,
    // Max time to keep retrying (ms)
    maxRetryDuration: 15000,
    // Retry interval (ms)
    retryInterval: 500,
    // Max text length for a button to be considered valid
    maxButtonTextLength: 50,
    // Minimum banner size (px)
    minBannerWidth: 200,
    minBannerHeight: 40,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CMP-SPECIFIC SELECTORS (Direct ID/class targeting for known platforms)
  // These are the fastest and most reliable detection method.
  // ═══════════════════════════════════════════════════════════════════════════

  const CMP_ACCEPT_SELECTORS = [
    // OneTrust
    "#onetrust-accept-btn-handler",
    ".onetrust-close-btn-handler",
    // Cookiebot (Cybot)
    "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
    "#CybotCookiebotDialogBodyButtonAccept",
    "#CybotCookiebotDialogBodyLevelButtonAccept",
    // Didomi
    "#didomi-notice-agree-button",
    "[data-testid='didomi-notice-agree-button']",
    // Quantcast Choice
    ".qc-cmp2-summary-buttons button[mode='primary']",
    "[data-tracking-opt-in-accept]",
    ".qc-cmp-button[data-tracking-opt-in-accept='true']",
    // TrustArc (Truste)
    "#truste-consent-button",
    ".trustarc-agree-btn",
    // Usercentrics
    "#uc-btn-accept-banner",
    "[data-testid='uc-accept-all-button']",
    // CookieYes
    ".cky-btn-accept",
    "[data-cky-tag='accept-button']",
    // Osano
    ".osano-cm-accept-all",
    ".osano-cm-accept",
    // Complianz
    ".cmplz-accept",
    ".cmplz-btn.cmplz-accept",
    // Borlabs Cookie
    "[data-cookie-accept-all]",
    "#BorlabsCookieBoxWrap .cookie-accept-all",
    // Klaro
    ".klaro .cm-btn-accept",
    ".klaro .cm-btn-accept-all",
    ".cn-set-cookie[data-cookie-set='accept']",
    // Iubenda
    ".iubenda-cs-accept-btn",
    // Termly
    "[data-tid='banner-accept']",
    ".t-accept-all",
    // HubSpot
    "#hs-eu-confirmation-button",
    // Civic Cookie Control
    ".ccc-accept-settings",
    "#ccc-recommended-settings",
    // LiveRamp / Evidon
    ".evidon-banner-acceptbutton",
    "#_evidon-accept-button",
    // Consentmanager.net
    ".cmpboxbtn.cmpboxbtnyes",
    ".cmpboxbtnyes",
    "#cmpbntnotxt",
    // Cookie Notice plugin
    "#cookie-notice .cn-set-cookie",
    ".cookie-notice-container .cn-set-cookie",
    // GDPR Cookie Compliance
    "#moove_gdpr_cookie_modal .mgbutton",
    "#moove_gdpr_cookie_info_bar .mgbutton",
    // CookieFirst
    "[data-cookiefirst-action='accept']",
    // Axeptio
    "[data-accept-all]",
    // Admiral
    ".admiral-cmp-accept",
    // Sourcepoint (non-iframe)
    "button[title='Accept all']",
    "button[title='Accept All']",
    // Cookie Script
    "#cookiescript_accept",
    "#cookiescript_acceptall",
    // Pandectes
    ".pandectes-accept-all",
    // Shopify native
    "#shopify-pc__banner__btn-accept",
    // WordPress Cookie Notice
    "#cn-accept-cookie",
    // EU Cookie Law
    "#eu-cookie-law .accept",
    // Drupal EU Cookie Compliance
    ".eu-cookie-compliance-default-button",
    ".agree-button",
    // TYPO3 Cookie Consent
    ".cc-compliance .cc-btn.cc-allow",
    // Cookie Consent by Insites
    ".cc-btn.cc-allow",
    ".cc-btn.cc-dismiss",
    // Tarteaucitron
    "#tarteaucitronPersonalize2",
    ".tarteaucitronAllow",
    "#tarteaucitronAllAllowed",
    // Sirdata
    "#sd-cmp button.sd-cmp-3cRQ2",
    // Google Consent (FC)
    "button[data-cookiedomain] + button",
    // Google's own consent
    "[aria-label='Accept all']",
    "button[jsname='b3VHJd']",
    // Yahoo consent
    "[name='agree']",
    ".consent-form .accept-all",
    // Microsoft / Bing
    "#bnp_btn_accept",
    "#wcpConsentBannerCtrl button:first-child",
    // Stack Overflow / Stack Exchange
    ".js-accept-cookies",
    ".js-consent-banner-accept",
    // Reddit
    "._1tI68pPnLBjR1iHcL7vsee button",
    // Medium
    "[data-testid='close-button']",
    // GitHub
    "[data-analytics-event*='cookie'] button",
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // CMP CONTAINER SELECTORS (to identify cookie banner containers)
  // ═══════════════════════════════════════════════════════════════════════════

  const CMP_CONTAINER_SELECTORS = [
    "#onetrust-banner-sdk",
    "#onetrust-consent-sdk",
    "#CybotCookiebotDialog",
    "#CybotCookiebotDialogBody",
    "#didomi-host",
    "#didomi-popup",
    ".qc-cmp2-container",
    "#qcCmpUi",
    "#truste-consent-track",
    "#truste_overlay",
    "#usercentrics-root",
    ".cky-consent-container",
    ".osano-cm-dialog",
    ".osano-cm-window",
    ".cmplz-cookiebanner",
    "#BorlabsCookieBox",
    ".klaro",
    "#iubenda-cs-banner",
    ".t-consentPrompt",
    "#hs-eu-cookie-confirmation",
    "#ccc",
    "#cmpbox",
    "#cmpbox2",
    "#cookie-notice",
    ".cookie-notice-container",
    "#moove_gdpr_cookie_info_bar",
    "#cookiescript_injected",
    "#tarteaucitron",
    "#sd-cmp",
    ".fc-consent-root",
    "#consent-bump",
    "#sp-cc",
    ".evidon-consent-button",
    "#cookie-law-info-bar",
    ".cc-window",
    ".cc-banner",
    "#gdpr-cookie-message",
    "#cookie-popup",
    "#cookieConsent",
    "#cookie-consent",
    "#cookie_consent",
    "#cookieconsent",
    ".cookie-consent",
    ".cookie-banner",
    "#cookie-banner",
    ".cookie-popup",
    ".gdpr-banner",
    "#gdpr-banner",
    ".privacy-banner",
    "#privacy-banner",
    ".consent-banner",
    "#consent-banner",
    "[class*='cookie-banner']",
    "[class*='cookie-consent']",
    "[class*='cookieBanner']",
    "[class*='cookieConsent']",
    "[class*='consent-banner']",
    "[class*='gdpr']",
    "[id*='cookie-banner']",
    "[id*='cookie-consent']",
    "[id*='cookieBanner']",
    "[id*='cookieConsent']",
    "[id*='consent-banner']",
    "[id*='gdpr']",
    "[aria-label*='cookie']",
    "[aria-label*='consent']",
    "[role='dialog'][aria-label*='cookie']",
    "[role='dialog'][aria-label*='privacy']",
    "[role='alertdialog']",
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // MULTILINGUAL ACCEPT KEYWORDS
  // Organized by strength: strong phrases first, then generic words
  // ═══════════════════════════════════════════════════════════════════════════

  const ACCEPT_PHRASES_STRONG = [
    // English
    "accept all", "accept all cookies", "allow all", "allow all cookies",
    "agree to all", "i agree", "yes, i agree", "agree and continue",
    "i accept", "yes, i accept", "accept & continue", "accept and continue",
    "accept and close", "allow and close", "agree & close",
    // French
    "accepter tout", "tout accepter", "accepter tous les cookies",
    "accepter tous", "j'accepte", "autoriser tout", "tout autoriser",
    "accepter et continuer", "accepter & continuer",
    // German
    "alle akzeptieren", "alle cookies akzeptieren", "alles akzeptieren",
    "alle annehmen", "ich stimme zu", "akzeptieren und weiter",
    "alle zulassen", "zustimmen und weiter", "einverstanden",
    // Spanish
    "aceptar todo", "aceptar todas", "aceptar todas las cookies",
    "aceptar todos", "acepto", "estoy de acuerdo", "aceptar y continuar",
    "permitir todas", "permitir todo",
    // Italian
    "accetta tutto", "accetta tutti", "accetta tutti i cookie",
    "accetto", "acconsento", "accetta e continua", "accetta e chiudi",
    // Portuguese
    "aceitar tudo", "aceitar todos", "aceitar todos os cookies",
    "aceito", "concordo", "aceitar e continuar", "aceitar e fechar",
    // Dutch
    "alles accepteren", "alle cookies accepteren", "accepteren",
    "ik ga akkoord", "alles toestaan", "akkoord",
    // Polish
    "zaakceptuj wszystkie", "akceptuję wszystkie", "zgadzam się",
    "akceptuj wszystko", "zaakceptuj wszystko",
    // Swedish
    "acceptera alla", "godkänn alla", "acceptera alla cookies",
    "jag godkänner", "tillåt alla",
    // Danish
    "accepter alle", "tillad alle", "accepter alle cookies",
    "jeg accepterer",
    // Norwegian
    "aksepter alle", "godta alle", "aksepter alle informasjonskapsler",
    "jeg aksepterer",
    // Finnish
    "hyväksy kaikki", "hyväksy kaikki evästeet", "salli kaikki",
    // Czech
    "přijmout vše", "přijmout všechny", "přijmout všechny cookies",
    "souhlasím se všemi",
    // Romanian
    "acceptă tot", "acceptă toate", "sunt de acord cu toate",
    // Hungarian
    "mindet elfogadom", "összes elfogadása", "összes cookie elfogadása",
    // Greek
    "αποδοχή όλων", "αποδέχομαι όλα",
    // Turkish
    "tümünü kabul et", "hepsini kabul et", "tüm çerezleri kabul et",
    // Russian
    "принять все", "принять все cookies", "согласен со всеми",
    // Ukrainian
    "прийняти всі", "прийняти все",
    // Japanese
    "すべて許可", "すべて受け入れる", "全て許可", "すべてのcookieを許可",
    // Chinese (Simplified)
    "全部接受", "接受所有", "接受所有cookie", "全部允许",
    // Chinese (Traditional)
    "全部接受", "接受所有cookie",
    // Korean
    "모두 수락", "모두 허용", "모든 쿠키 수락",
    // Arabic
    "قبول الكل", "قبول جميع ملفات تعريف الارتباط",
    // Thai
    "ยอมรับทั้งหมด",
    // Vietnamese
    "chấp nhận tất cả",
    // Indonesian / Malay
    "terima semua",
    // Hindi
    "सभी स्वीकार करें",
  ];

  const ACCEPT_PHRASES_GENERIC = [
    // English
    "accept", "agree", "allow", "consent", "i consent", "ok", "okay",
    "got it", "understood", "yes", "continue", "confirm", "close",
    "dismiss", "acknowledge",
    // French
    "accepter", "j'accepte", "autoriser", "d'accord", "j'ai compris",
    "continuer", "fermer",
    // German
    "akzeptieren", "zustimmen", "erlauben", "einverstanden",
    "verstanden", "weiter", "schließen",
    // Spanish
    "aceptar", "acepto", "de acuerdo", "permitir", "continuar",
    "entendido", "cerrar",
    // Italian
    "accetta", "accetto", "va bene", "sono d'accordo", "consento",
    "chiudi", "continua",
    // Portuguese
    "aceitar", "aceito", "concordo", "permitir", "entendi",
    "continuar", "fechar",
    // Dutch
    "accepteren", "akkoord", "toestaan", "begrepen", "sluiten",
    // Polish
    "akceptuję", "akceptuj", "zgadzam się", "zamknij", "rozumiem",
    // Swedish
    "acceptera", "godkänn", "tillåt", "jag förstår", "stäng",
    // Danish
    "accepter", "tillad", "forstået", "luk",
    // Norwegian
    "aksepter", "godta", "forstått", "lukk",
    // Finnish
    "hyväksy", "salli", "ymmärrän", "sulje",
    // Czech
    "přijmout", "souhlasím", "rozumím", "zavřít",
    // Romanian
    "accept", "acceptă", "sunt de acord", "închide",
    // Hungarian
    "elfogadom", "elfogad", "rendben", "bezár",
    // Greek
    "αποδοχή", "αποδέχομαι", "συμφωνώ", "κλείσιμο", "εντάξει",
    // Turkish
    "kabul et", "kabul ediyorum", "tamam", "kapat",
    // Russian
    "принять", "принимаю", "согласен", "хорошо", "закрыть",
    // Ukrainian
    "прийняти", "приймаю", "погоджуюсь", "закрити",
    // Japanese
    "同意する", "承認", "許可", "閉じる",
    // Chinese
    "同意", "我同意", "接受", "确定", "关闭",
    // Korean
    "동의합니다", "수락", "동의", "확인", "닫기",
    // Arabic
    "أوافق", "موافق", "قبول", "إغلاق",
    // Thai
    "ยอมรับ", "ตกลง",
    // Vietnamese
    "chấp nhận", "đồng ý",
    // Indonesian
    "terima", "setuju",
    // Hindi
    "स्वीकार करें", "सहमत",
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // NEGATIVE KEYWORDS (things we must NOT click)
  // ═══════════════════════════════════════════════════════════════════════════

  const NEGATIVE_KEYWORDS = [
    // English
    "manage", "preferences", "settings", "customize", "customise",
    "learn more", "more info", "more information", "details",
    "reject", "decline", "deny", "refuse", "only necessary",
    "necessary only", "necessary cookies only", "essential only",
    "cookie policy", "privacy policy", "read more", "show purposes",
    "manage options", "manage settings", "manage preferences",
    "cookie settings", "privacy settings", "do not sell",
    "opt out", "opt-out", "save preferences", "save settings",
    "confirm choices", "confirm my choices",
    // French
    "gérer", "paramètres", "personnaliser", "en savoir plus",
    "refuser", "refuser tout", "politique de cookies",
    "politique de confidentialité", "paramétrer",
    // German
    "verwalten", "einstellungen", "anpassen", "mehr erfahren",
    "ablehnen", "alle ablehnen", "cookie-einstellungen",
    "datenschutz", "nur notwendige",
    // Spanish
    "gestionar", "configurar", "personalizar", "más información",
    "rechazar", "rechazar todo", "solo necesarias",
    "política de cookies", "configuración",
    // Italian
    "gestisci", "impostazioni", "personalizza", "maggiori informazioni",
    "rifiuta", "rifiuta tutto", "solo necessari",
    // Portuguese
    "gerenciar", "configurações", "personalizar", "saiba mais",
    "recusar", "recusar tudo", "apenas necessários",
    // Dutch
    "beheren", "instellingen", "aanpassen", "meer informatie",
    "weigeren", "alles weigeren",
    // Social / external (all languages)
    "facebook", "instagram", "twitter", "x.com", "linkedin",
    "youtube", "tiktok", "pinterest", "reddit",
    "subscribe", "sign in", "sign up", "log in", "register",
    "download", "install",
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // COOKIE CONTEXT KEYWORDS (identifies cookie/consent-related content)
  // ═══════════════════════════════════════════════════════════════════════════

  const COOKIE_CONTEXT_KEYWORDS = [
    // English
    "cookie", "cookies", "consent", "gdpr", "privacy", "tracking",
    "advertising cookies", "manage privacy", "privacy preferences",
    "data protection", "personal data", "third party", "third-party",
    "analytics cookies", "functional cookies", "performance cookies",
    // French
    "cookies", "consentement", "confidentialité", "données personnelles",
    "protection des données", "traceurs",
    // German
    "cookies", "einwilligung", "datenschutz", "privatsphäre",
    "personenbezogene daten", "tracking",
    // Spanish
    "cookies", "consentimiento", "privacidad", "datos personales",
    "protección de datos",
    // Italian
    "cookie", "consenso", "privacy", "dati personali",
    "protezione dei dati",
    // Portuguese
    "cookies", "consentimento", "privacidade", "dados pessoais",
    // Dutch
    "cookies", "toestemming", "privacy", "persoonsgegevens",
    // Generic
    "rgpd", "lgpd", "ccpa", "eprivacy", "dsgvo",
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // ANTI-FALSE-POSITIVE KEYWORDS (robot checks, captchas, etc.)
  // ═══════════════════════════════════════════════════════════════════════════

  const AVOID_KEYWORDS = [
    "not a robot", "are you a robot", "robot check", "captcha",
    "security check", "verify you are human", "verify you're human",
    "checking your browser", "ddos-protection", "cloudflare",
    "recaptcha", "hcaptcha", "turnstile", "bot detection",
    "please verify", "human verification", "access denied",
    "just a moment", "enable javascript",
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  function normalizeText(text) {
    return (text || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function containsAny(text, keywords) {
    const t = normalizeText(text);
    return keywords.some((kw) => t.includes(kw.toLowerCase()));
  }

  function matchesExact(text, keywords) {
    const t = normalizeText(text);
    return keywords.some((kw) => t === kw.toLowerCase());
  }

  function isVisible(el) {
    if (!el) return false;
    // Check if element is in the DOM
    if (!el.isConnected) return false;
    const style = window.getComputedStyle(el);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0" ||
      (style.clip === "rect(0px, 0px, 0px, 0px)" && style.position === "absolute")
    ) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isInViewport(el) {
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return (
      rect.top < vh &&
      rect.bottom > 0 &&
      rect.left < vw &&
      rect.right > 0
    );
  }

  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn.apply(this, args);
      }, delay);
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHADOW DOM TRAVERSAL
  // ═══════════════════════════════════════════════════════════════════════════

  function querySelectorAllDeep(selector, root = document) {
    const results = [];

    // Query in the current root
    try {
      const found = root.querySelectorAll(selector);
      found.forEach((el) => results.push(el));
    } catch (e) {
      // Invalid selector in this context, skip
    }

    // Traverse shadow DOMs
    const allElements = root.querySelectorAll("*");
    for (const el of allElements) {
      if (el.shadowRoot) {
        const shadowResults = querySelectorAllDeep(selector, el.shadowRoot);
        shadowResults.forEach((r) => results.push(r));
      }
    }

    return results;
  }

  function querySelectorDeep(selector, root = document) {
    // Try in current root first
    try {
      const found = root.querySelector(selector);
      if (found) return found;
    } catch (e) {
      // skip
    }

    // Traverse shadow DOMs
    const allElements = root.querySelectorAll("*");
    for (const el of allElements) {
      if (el.shadowRoot) {
        const found = querySelectorDeep(selector, el.shadowRoot);
        if (found) return found;
      }
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PER-DOMAIN STATE MANAGEMENT (using chrome.storage.local for reliability)
  // ═══════════════════════════════════════════════════════════════════════════

  const STATE_KEY = "__IDGAC__" + window.location.hostname;
  let clickCount = 0;
  let hasBeenHandled = false;

  function markHandled() {
    clickCount++;
    if (clickCount >= CONFIG.maxClicksPerDomain) {
      hasBeenHandled = true;
    }
    // Persist to chrome.storage.local for cross-session reliability
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          [STATE_KEY]: { count: clickCount, ts: Date.now() },
        });
      }
    } catch (e) {
      // Fallback to localStorage
      try {
        localStorage.setItem(STATE_KEY, JSON.stringify({ count: clickCount, ts: Date.now() }));
      } catch (e2) { /* ignore */ }
    }
  }

  function loadState(callback) {
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(STATE_KEY, (data) => {
          if (data && data[STATE_KEY]) {
            const stored = data[STATE_KEY];
            // Reset if older than 24 hours (banners may reappear)
            if (stored.ts && Date.now() - stored.ts > 86400000) {
              clickCount = 0;
            } else {
              clickCount = stored.count || 0;
            }
            if (clickCount >= CONFIG.maxClicksPerDomain) {
              hasBeenHandled = true;
            }
          }
          callback();
        });
        return;
      }
    } catch (e) { /* fallback */ }

    // Fallback: localStorage
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (raw) {
        const stored = JSON.parse(raw);
        if (stored.ts && Date.now() - stored.ts > 86400000) {
          clickCount = 0;
        } else {
          clickCount = stored.count || 0;
        }
        if (clickCount >= CONFIG.maxClicksPerDomain) {
          hasBeenHandled = true;
        }
      }
    } catch (e) { /* ignore */ }
    callback();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TARGET VALIDATION (prevent clicking bad things)
  // ═══════════════════════════════════════════════════════════════════════════

  function isBadTarget(el, text) {
    const t = normalizeText(text);

    // Check negative keywords
    if (containsAny(t, NEGATIVE_KEYWORDS)) return true;

    // Skip very long text (likely a paragraph, not a button)
    if (t.length > CONFIG.maxButtonTextLength) return true;

    const tag = (el.tagName || "").toUpperCase();
    const href = (el.getAttribute && el.getAttribute("href")) || "";
    const lowerHref = href.toLowerCase();

    // Block mailto/tel/sms
    if (
      lowerHref.startsWith("mailto:") ||
      lowerHref.startsWith("tel:") ||
      lowerHref.startsWith("sms:")
    ) {
      return true;
    }

    // Block social media links
    const socialDomains = [
      "facebook.com", "instagram.com", "twitter.com", "x.com",
      "linkedin.com", "youtube.com", "tiktok.com", "pinterest.com",
    ];
    if (href && socialDomains.some((d) => lowerHref.includes(d))) {
      return true;
    }

    // Block policy/privacy links
    const policyPaths = [
      "privacy", "cookie-policy", "cookies-policy", "/cookies",
      "cookie_settings", "cookiepreferences", "cookie-preferences",
      "/policy", "/terms", "/legal",
    ];
    if (href && policyPaths.some((p) => lowerHref.includes(p))) {
      return true;
    }

    // For <a> tags, only allow button-like anchors
    if (tag === "A" && href) {
      const trimmed = href.trim().toLowerCase();
      if (
        trimmed === "#" ||
        trimmed === "" ||
        trimmed.startsWith("javascript:") ||
        trimmed === "#!" ||
        trimmed === "void(0)"
      ) {
        return false; // Looks like a JS button
      }
      // Real navigation link - bad target
      return true;
    }

    return false;
  }

  function isLikelyRobotPage() {
    const bodyText = normalizeText(
      (document.body && document.body.innerText) || ""
    );
    return containsAny(bodyText, AVOID_KEYWORDS);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STRATEGY 1: CMP-SPECIFIC SELECTORS (fastest, most reliable)
  // ═══════════════════════════════════════════════════════════════════════════

  function tryCMPSelectors() {
    for (const selector of CMP_ACCEPT_SELECTORS) {
      const el = querySelectorDeep(selector);
      if (el && isVisible(el)) {
        const text = normalizeText(el.innerText || el.value || el.textContent || "");
        // Verify it's not a negative button that happens to match a selector
        if (!containsAny(text, ["reject", "decline", "deny", "refuse", "ablehnen", "refuser", "rechazar", "rifiuta", "weigeren"])) {
          return el;
        }
      }
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STRATEGY 2: CONTAINER-BASED DETECTION (find banner, then find button)
  // ═══════════════════════════════════════════════════════════════════════════

  function findCookieContainers() {
    const containers = [];
    const seen = new WeakSet();

    // First, try known CMP container selectors
    for (const selector of CMP_CONTAINER_SELECTORS) {
      const elements = querySelectorAllDeep(selector);
      for (const el of elements) {
        if (seen.has(el) || !isVisible(el)) continue;
        seen.add(el);
        containers.push(el);
      }
    }

    // Then, heuristic scan for unknown banners
    const candidates = document.querySelectorAll(
      "div, section, aside, dialog, form, [role='dialog'], [role='alertdialog'], [role='banner']"
    );

    const vw = window.innerWidth || document.documentElement.clientWidth || 1024;
    const vh = window.innerHeight || document.documentElement.clientHeight || 768;

    for (const el of candidates) {
      if (seen.has(el) || !isVisible(el)) continue;

      const rect = el.getBoundingClientRect();
      // Skip too small
      if (rect.width < CONFIG.minBannerWidth || rect.height < CONFIG.minBannerHeight) continue;
      // Skip full-page containers
      if (rect.width * rect.height > vw * vh * 0.85) continue;

      // Check if it looks like a cookie banner
      const idClass = normalizeText((el.id || "") + " " + (el.className || ""));
      const hasCookieHint = containsAny(idClass, [
        "cookie", "consent", "gdpr", "privacy", "banner", "notice",
        "compliance", "dsgvo", "rgpd", "ccpa", "eprivacy",
      ]);

      const innerText = normalizeText(el.innerText || "");
      const mentionsCookies = containsAny(innerText, COOKIE_CONTEXT_KEYWORDS);
      const looksLikeRobot = containsAny(innerText, AVOID_KEYWORDS);

      if (!hasCookieHint && !mentionsCookies) continue;
      if (looksLikeRobot) continue;

      // Check it has a reasonable z-index or fixed/sticky position
      const style = window.getComputedStyle(el);
      const position = style.position;
      const zIndex = parseInt(style.zIndex) || 0;
      const isOverlay = position === "fixed" || position === "sticky" || zIndex > 100;
      const isBottomBar = rect.bottom > vh * 0.7 && rect.height < vh * 0.4;
      const isTopBar = rect.top < vh * 0.3 && rect.height < vh * 0.4;
      const isCenterModal = (
        rect.top > vh * 0.1 && rect.bottom < vh * 0.9 &&
        rect.left > vw * 0.05 && rect.right < vw * 0.95
      );

      // Score the container
      let score = 0;
      if (hasCookieHint) score += 50;
      if (mentionsCookies) score += 30;
      if (isOverlay) score += 40;
      if (isBottomBar || isTopBar) score += 20;
      if (isCenterModal) score += 30;
      score += Math.min(rect.width * rect.height / 1000, 100);

      seen.add(el);
      containers.push(el);
    }

    return containers;
  }

  function findAcceptButtonInContainer(container) {
    const clickableSelectors = [
      "button",
      "[role='button']",
      "input[type='button']",
      "input[type='submit']",
      "a",
      "span[onclick]",
      "div[onclick]",
      "[tabindex='0']",
    ];

    const clickables = [];

    for (const sel of clickableSelectors) {
      let elements;
      // Check shadow DOM within container
      if (container.shadowRoot) {
        elements = container.shadowRoot.querySelectorAll(sel);
      } else {
        elements = container.querySelectorAll(sel);
      }

      for (const el of elements) {
        if (!isVisible(el)) continue;
        const rawText = el.innerText || el.value || el.textContent || "";
        const text = normalizeText(rawText);
        if (!text || text.length > CONFIG.maxButtonTextLength) continue;
        clickables.push({ el, text });
      }
    }

    if (!clickables.length) return null;

    // Score each clickable
    const candidates = [];

    for (const { el, text } of clickables) {
      if (isBadTarget(el, text)) continue;

      let strength = 0;

      // Strong match (explicit "accept all" type phrases)
      if (containsAny(text, ACCEPT_PHRASES_STRONG)) {
        strength = 10;
      }
      // Exact match on generic phrases
      else if (matchesExact(text, ACCEPT_PHRASES_GENERIC)) {
        strength = 7;
      }
      // Partial match on generic phrases
      else if (containsAny(text, ACCEPT_PHRASES_GENERIC)) {
        // Additional filtering for generic matches
        if (
          text.includes("article") || text.includes("section") ||
          text.includes("home") || text.includes("subscribe") ||
          text.includes("sign") || text.includes("log") ||
          text.includes("register") || text.includes("download")
        ) {
          continue;
        }
        strength = 4;
      }

      if (strength === 0) continue;

      const rect = el.getBoundingClientRect();
      const area = rect.width * rect.height;
      const tag = (el.tagName || "").toUpperCase();

      // Prefer real buttons over anchors
      let typeBonus = 0;
      if (tag === "BUTTON" || tag === "INPUT") typeBonus = 3;
      else if (el.getAttribute("role") === "button") typeBonus = 2;
      else if (tag === "A") typeBonus = 0;
      else typeBonus = 1;

      // Prefer elements with prominent styling (larger, colored backgrounds)
      const style = window.getComputedStyle(el);
      let styleBonus = 0;
      const bgColor = style.backgroundColor;
      if (bgColor && bgColor !== "rgba(0, 0, 0, 0)" && bgColor !== "transparent") {
        styleBonus += 2;
      }

      candidates.push({
        el,
        score: strength * 100 + typeBonus * 10 + styleBonus * 5 + Math.min(area / 100, 50),
      });
    }

    if (!candidates.length) return null;

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].el;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STRATEGY 3: ARIA/ATTRIBUTE-BASED DETECTION
  // ═══════════════════════════════════════════════════════════════════════════

  function tryAriaBasedDetection() {
    const ariaSelectors = [
      "button[aria-label*='accept' i]",
      "button[aria-label*='agree' i]",
      "button[aria-label*='allow' i]",
      "button[aria-label*='consent' i]",
      "button[aria-label*='Accept' i]",
      "[role='button'][aria-label*='accept' i]",
      "[role='button'][aria-label*='agree' i]",
      "button[data-action='accept']",
      "button[data-action='agree']",
      "button[data-consent='accept']",
      "button[data-cookieconsent='accept']",
      "a[data-action='accept']",
      "a[data-consent='accept']",
    ];

    for (const selector of ariaSelectors) {
      try {
        const el = querySelectorDeep(selector);
        if (el && isVisible(el)) {
          const text = normalizeText(el.innerText || el.value || el.getAttribute("aria-label") || "");
          if (!containsAny(text, NEGATIVE_KEYWORDS.slice(0, 30))) {
            return el;
          }
        }
      } catch (e) {
        // Some selectors may not be valid in all contexts
      }
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STRATEGY 4: FULL-PAGE SCAN (last resort for unusual banners)
  // ═══════════════════════════════════════════════════════════════════════════

  function tryFullPageScan() {
    // Only use this if the page clearly has cookie-related content
    const bodyText = normalizeText((document.body && document.body.innerText) || "");
    if (!containsAny(bodyText, COOKIE_CONTEXT_KEYWORDS)) return null;
    if (isLikelyRobotPage()) return null;

    const selectors = ["button", "[role='button']", "input[type='button']", "input[type='submit']"];
    const candidates = [];

    const vh = window.innerHeight || document.documentElement.clientHeight || 768;

    for (const sel of selectors) {
      const elements = querySelectorAllDeep(sel);
      for (const el of elements) {
        if (!isVisible(el) || !isInViewport(el)) continue;

        const rawText = el.innerText || el.value || el.textContent || "";
        const text = normalizeText(rawText);
        if (!text || text.length > 30) continue;

        if (isBadTarget(el, text)) continue;

        // Only strong accept phrases for full-page scan (to avoid false positives)
        if (!containsAny(text, ACCEPT_PHRASES_STRONG)) continue;

        const rect = el.getBoundingClientRect();
        const area = rect.width * rect.height;

        // Prefer buttons in top/bottom bands (where banners typically appear)
        const centerY = rect.top + rect.height / 2;
        let positionBonus = 0;
        if (centerY > vh * 0.7 || centerY < vh * 0.3) positionBonus = 20;

        candidates.push({
          el,
          score: area + positionBonus * 100,
        });
      }
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].el;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STRATEGY 5: OVERLAY/BACKDROP DETECTION
  // Some banners use a full-screen overlay; find the accept button within
  // ═══════════════════════════════════════════════════════════════════════════

  function tryOverlayDetection() {
    const overlaySelectors = [
      "[class*='overlay']",
      "[class*='backdrop']",
      "[class*='modal']",
      "[id*='overlay']",
      "[id*='backdrop']",
    ];

    for (const sel of overlaySelectors) {
      const overlays = document.querySelectorAll(sel);
      for (const overlay of overlays) {
        if (!isVisible(overlay)) continue;

        const style = window.getComputedStyle(overlay);
        const rect = overlay.getBoundingClientRect();
        const vw = window.innerWidth || 1024;
        const vh = window.innerHeight || 768;

        // Must be large (covering most of viewport)
        if (rect.width < vw * 0.8 || rect.height < vh * 0.8) continue;
        // Must be fixed/absolute positioned
        if (style.position !== "fixed" && style.position !== "absolute") continue;

        // Check if it contains cookie-related text
        const text = normalizeText(overlay.innerText || "");
        if (!containsAny(text, COOKIE_CONTEXT_KEYWORDS)) continue;
        if (containsAny(text, AVOID_KEYWORDS)) continue;

        // Find accept button within
        const btn = findAcceptButtonInContainer(overlay);
        if (btn) return btn;
      }
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STRATEGY 6: IFRAME-BASED CONSENT (some CMPs use iframes)
  // ═══════════════════════════════════════════════════════════════════════════

  function tryIframeConsent() {
    const iframes = document.querySelectorAll("iframe");
    for (const iframe of iframes) {
      // Check if iframe src suggests it's a consent frame
      const src = (iframe.src || "").toLowerCase();
      const consentHosts = [
        "consent", "cookie", "gdpr", "privacy", "cmp",
        "trustarc", "onetrust", "cookiebot", "quantcast",
        "didomi", "sourcepoint",
      ];

      if (!consentHosts.some((h) => src.includes(h))) continue;

      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (!iframeDoc) continue;

        // Try CMP selectors within iframe
        for (const selector of CMP_ACCEPT_SELECTORS) {
          try {
            const el = iframeDoc.querySelector(selector);
            if (el && isVisible(el)) return el;
          } catch (e) { /* cross-origin, skip */ }
        }

        // Try finding accept button generically
        const buttons = iframeDoc.querySelectorAll("button, [role='button'], a");
        for (const btn of buttons) {
          const text = normalizeText(btn.innerText || btn.value || "");
          if (containsAny(text, ACCEPT_PHRASES_STRONG) && !containsAny(text, NEGATIVE_KEYWORDS)) {
            if (isVisible(btn)) return btn;
          }
        }
      } catch (e) {
        // Cross-origin iframe, cannot access
      }
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN ORCHESTRATOR
  // ═══════════════════════════════════════════════════════════════════════════

  function tryAcceptCookies() {
    if (hasBeenHandled) return false;
    if (isLikelyRobotPage()) return false;

    let button = null;

    // Strategy 1: CMP-specific selectors (fastest, most reliable)
    button = tryCMPSelectors();
    if (button) {
      clickButton(button, "CMP selector");
      return true;
    }

    // Strategy 2: Container-based detection
    const containers = findCookieContainers();
    for (const container of containers) {
      button = findAcceptButtonInContainer(container);
      if (button) {
        clickButton(button, "container-based");
        return true;
      }
    }

    // Strategy 3: ARIA/attribute-based detection
    button = tryAriaBasedDetection();
    if (button) {
      clickButton(button, "aria-based");
      return true;
    }

    // Strategy 4: Overlay detection
    button = tryOverlayDetection();
    if (button) {
      clickButton(button, "overlay");
      return true;
    }

    // Strategy 5: Iframe consent
    button = tryIframeConsent();
    if (button) {
      clickButton(button, "iframe");
      return true;
    }

    // Strategy 6: Full-page scan (last resort, strict matching only)
    button = tryFullPageScan();
    if (button) {
      clickButton(button, "full-page scan");
      return true;
    }

    return false;
  }

  function clickButton(el, strategy) {
    try {
      // Simulate a real click sequence
      el.focus();
      el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
      el.click();

      markHandled();

      // Log for debugging (only in dev)
      // console.log(`[IDGAC] Clicked via ${strategy}:`, el.innerText || el.value);
    } catch (e) {
      // If click fails, try alternative
      try {
        el.dispatchEvent(new Event("click", { bubbles: true }));
        markHandled();
      } catch (e2) { /* give up on this element */ }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCHEDULING & OBSERVATION
  // ═══════════════════════════════════════════════════════════════════════════

  let observerActive = false;
  let retryTimer = null;
  let startTime = 0;

  function scheduleRetries() {
    startTime = Date.now();

    // Immediate attempt
    if (tryAcceptCookies()) return;

    // Progressive retries with increasing delays
    const delays = [100, 300, 600, 1000, 1500, 2000, 3000, 5000, 8000, 12000];
    for (const delay of delays) {
      if (delay > CONFIG.maxRetryDuration) break;
      setTimeout(() => {
        if (hasBeenHandled) return;
        tryAcceptCookies();
      }, delay);
    }
  }

  function startObserver() {
    if (observerActive) return;
    observerActive = true;

    const target = document.documentElement || document.body;
    if (!target) return;

    // Debounced handler to prevent excessive processing
    const debouncedHandler = debounce(() => {
      if (hasBeenHandled) {
        observer.disconnect();
        observerActive = false;
        return;
      }
      // Stop observing after max duration
      if (Date.now() - startTime > CONFIG.maxRetryDuration) {
        observer.disconnect();
        observerActive = false;
        return;
      }
      tryAcceptCookies();
    }, CONFIG.debounceMs);

    const observer = new MutationObserver(debouncedHandler);

    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden", "aria-hidden"],
    });

    // Auto-disconnect after max duration to save resources
    setTimeout(() => {
      if (observerActive) {
        observer.disconnect();
        observerActive = false;
      }
    }, CONFIG.maxRetryDuration + 1000);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  function init() {
    // Check if extension is enabled
    try {
      if (chrome && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get({ enabled: true }, (data) => {
          if (!data.enabled) return;
          loadState(() => {
            if (hasBeenHandled) return;
            scheduleRetries();
            startObserver();
          });
        });
        return;
      }
    } catch (e) {
      // Not in extension context (testing), proceed anyway
    }

    // Fallback: run directly
    loadState(() => {
      if (hasBeenHandled) return;
      scheduleRetries();
      startObserver();
    });
  }

  // Start the extension
  init();
})();
