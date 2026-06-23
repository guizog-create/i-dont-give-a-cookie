// I Don't Give a Cookie - Universal Cookie Consent Auto-Acceptor
// v2.0.0 - Hardened production engine with click verification, CSS fallback,
// SPA support, error recovery, and bulletproof detection pipeline.

(() => {
  "use strict";

  // ═══════════════════════════════════════════════════════════════════════════
  // GLOBAL ERROR BOUNDARY
  // ═══════════════════════════════════════════════════════════════════════════

  const EXTENSION_ID = "IDGAC";
  let debugMode = false;

  function log(...args) {
    if (debugMode) console.log(`[${EXTENSION_ID}]`, ...args);
  }

  function logError(...args) {
    if (debugMode) console.error(`[${EXTENSION_ID}]`, ...args);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  const CONFIG = {
    maxClicksPerDomain: 5,
    debounceMs: 200,
    maxRetryDuration: 30000,      // Extended from 15s to 30s for slow CMPs
    retryInterval: 500,
    maxButtonTextLength: 60,
    minBannerWidth: 150,
    minBannerHeight: 30,
    clickVerifyDelay: 600,        // Wait this long after click to verify dismissal
    clickRetryAttempts: 3,        // Max click retries before CSS fallback
    spaCheckInterval: 1000,       // How often to check for SPA navigation
    observerReactivateDelay: 2000, // Delay before reactivating observer after SPA nav
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CMP-SPECIFIC SELECTORS (Direct ID/class targeting for known platforms)
  // ═══════════════════════════════════════════════════════════════════════════

  const CMP_ACCEPT_SELECTORS = [
    // OneTrust
    "#onetrust-accept-btn-handler",
    ".onetrust-close-btn-handler",
    // Cookiebot (Cybot)
    "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
    "#CybotCookiebotDialogBodyButtonAccept",
    "#CybotCookiebotDialogBodyLevelButtonAccept",
    "a#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
    // Didomi
    "#didomi-notice-agree-button",
    "[data-testid='didomi-notice-agree-button']",
    ".didomi-continue-without-agreeing",
    // Quantcast Choice
    ".qc-cmp2-summary-buttons button[mode='primary']",
    "[data-tracking-opt-in-accept]",
    ".qc-cmp-button[data-tracking-opt-in-accept='true']",
    // TrustArc (Truste)
    "#truste-consent-button",
    ".trustarc-agree-btn",
    ".pdynamicbutton .call",
    // Usercentrics
    "#uc-btn-accept-banner",
    "[data-testid='uc-accept-all-button']",
    "button[data-testid='uc-accept-all-button']",
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
    "a._brlbs-btn-accept-all",
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
    "button[title='ACCEPT ALL']",
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
    ".fc-button.fc-cta-consent",
    ".fc-cta-consent",
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
    // Orejime
    ".orejime-Button--save",
    // CookieHub
    ".ch2-allow-all-btn",
    "#ch2-dialog-actions .ch2-btn-primary",
    // Cookieinfo.net
    "#cookie-consent-accept",
    // Piwik PRO
    "[data-ppms-consent-accept-all]",
    // Sharethis
    ".st-cmp-accept-all",
    // Optanon (legacy OneTrust)
    ".optanon-allow-all",
    "#optanon-allow-all",
    // UniConsent
    ".unic-consent .unic-btn-accept",
    // Crownpeak
    "#cpDivBtnAcceptAll",
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // CMP CONTAINER SELECTORS
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
    ".ch2-container",
    "#ch2-dialog",
    ".orejime-Notice",
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
    "[aria-label*='cookie' i]",
    "[aria-label*='consent' i]",
    "[role='dialog'][aria-label*='cookie' i]",
    "[role='dialog'][aria-label*='privacy' i]",
    "[role='alertdialog']",
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // CSS FALLBACK RULES (hide banners when clicks fail)
  // ═══════════════════════════════════════════════════════════════════════════

  const CSS_HIDE_RULES = `
    #onetrust-banner-sdk,
    #onetrust-consent-sdk,
    #CybotCookiebotDialog,
    #CybotCookiebotDialogBody,
    .CybotCookiebotDialogActive,
    #didomi-host,
    #didomi-popup,
    .qc-cmp2-container,
    #qcCmpUi,
    #truste-consent-track,
    #truste_overlay,
    .cky-consent-container,
    .osano-cm-dialog,
    .osano-cm-window,
    .cmplz-cookiebanner,
    #BorlabsCookieBox,
    #iubenda-cs-banner,
    .t-consentPrompt,
    #hs-eu-cookie-confirmation,
    #cmpbox,
    #cmpbox2,
    #cookie-notice,
    .cookie-notice-container,
    #moove_gdpr_cookie_info_bar,
    #cookiescript_injected,
    #tarteaucitron,
    #sd-cmp,
    .fc-consent-root,
    #consent-bump,
    #sp-cc,
    .evidon-consent-button,
    #cookie-law-info-bar,
    .cc-window,
    .cc-banner,
    #gdpr-cookie-message,
    #cookie-popup,
    .ch2-container,
    #ch2-dialog,
    .orejime-Notice {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
      height: 0 !important;
      overflow: hidden !important;
    }
    /* Remove overlay/backdrop that blocks page interaction */
    #onetrust-consent-sdk ~ div[class*='overlay'],
    .cmpboxBGoverlay,
    .cmpboxoverlay,
    #truste_overlay,
    .qc-cmp2-overlay,
    .didomi-popup-backdrop,
    .osano-cm-overlay,
    .cc-overlay,
    body.cmplz-blocked,
    body.cookies-not-accepted,
    body.cookie-consent-active {
      overflow: auto !important;
    }
    body.cmplz-blocked,
    body.cookies-not-accepted {
      position: static !important;
      overflow: auto !important;
    }
  `;

  // ═══════════════════════════════════════════════════════════════════════════
  // MULTILINGUAL ACCEPT KEYWORDS
  // ═══════════════════════════════════════════════════════════════════════════

  const ACCEPT_PHRASES_STRONG = [
    // English
    "accept all", "accept all cookies", "allow all", "allow all cookies",
    "agree to all", "i agree", "yes, i agree", "agree and continue",
    "i accept", "yes, i accept", "accept & continue", "accept and continue",
    "accept and close", "allow and close", "agree & close",
    "accept recommended", "accept suggested",
    // French
    "accepter tout", "tout accepter", "accepter tous les cookies",
    "accepter tous", "j'accepte", "autoriser tout", "tout autoriser",
    "accepter et continuer", "accepter & continuer", "accepter et fermer",
    // German
    "alle akzeptieren", "alle cookies akzeptieren", "alles akzeptieren",
    "alle annehmen", "ich stimme zu", "akzeptieren und weiter",
    "alle zulassen", "zustimmen und weiter", "einverstanden",
    "allen cookies zustimmen", "cookies akzeptieren",
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
    "tüm çerezlere izin ver",
    // Russian
    "принять все", "принять все cookies", "согласен со всеми",
    // Ukrainian
    "прийняти всі", "прийняти все",
    // Japanese
    "すべて許可", "すべて受け入れる", "全て許可", "すべてのcookieを許可",
    "すべて同意",
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
    "confirm choices", "confirm my choices", "save my choices",
    // French
    "paramétrer", "paramètres", "personnaliser", "en savoir plus",
    "refuser", "gérer", "plus d'informations", "politique de cookies",
    // German
    "einstellungen", "anpassen", "mehr erfahren", "ablehnen",
    "verwalten", "nur notwendige", "nur erforderliche",
    "cookie-einstellungen", "datenschutzerklärung",
    // Spanish
    "configurar", "personalizar", "más información", "rechazar",
    "gestionar", "solo necesarias", "configuración de cookies",
    // Italian
    "impostazioni", "personalizza", "maggiori informazioni", "rifiuta",
    "gestisci", "solo necessari",
    // Dutch
    "instellingen", "aanpassen", "meer informatie", "weigeren",
    "beheren", "alleen noodzakelijk",
    // Polish
    "ustawienia", "dostosuj", "więcej informacji", "odrzuć",
    "zarządzaj", "tylko niezbędne",
    // Turkish
    "ayarlar", "özelleştir", "daha fazla bilgi", "reddet",
    "yönet", "sadece gerekli",
    // Russian
    "настройки", "настроить", "подробнее", "отклонить",
    "управлять", "только необходимые",
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // COOKIE CONTEXT KEYWORDS (text that indicates a cookie banner)
  // ═══════════════════════════════════════════════════════════════════════════

  const COOKIE_CONTEXT_KEYWORDS = [
    // English
    "cookie", "cookies", "consent", "gdpr", "privacy", "data protection",
    "personal data", "tracking", "analytics", "advertising cookies",
    "functional cookies", "performance cookies", "third party",
    "third-party", "we use cookies", "this site uses cookies",
    "this website uses cookies", "browsing experience",
    // French
    "cookies", "consentement", "confidentialité", "données personnelles",
    "nous utilisons des cookies", "ce site utilise des cookies",
    // German
    "cookies", "einwilligung", "datenschutz", "personenbezogene daten",
    "wir verwenden cookies", "diese website verwendet cookies",
    "diese seite verwendet cookies",
    // Spanish
    "cookies", "consentimiento", "privacidad", "datos personales",
    "utilizamos cookies", "este sitio utiliza cookies",
    // Italian
    "cookie", "consenso", "privacy", "dati personali",
    "utilizziamo i cookie", "questo sito utilizza cookie",
    // Portuguese
    "cookies", "consentimento", "privacidade", "dados pessoais",
    "utilizamos cookies", "este site utiliza cookies",
    // Dutch
    "cookies", "toestemming", "privacy", "persoonsgegevens",
    "wij gebruiken cookies", "deze website gebruikt cookies",
    // Polish
    "ciasteczka", "pliki cookie", "zgoda", "prywatność",
    "dane osobowe", "używamy plików cookie",
    // Swedish
    "kakor", "cookies", "samtycke", "integritet",
    // Danish
    "cookies", "samtykke", "privatlivspolitik",
    // Norwegian
    "informasjonskapsler", "samtykke", "personvern",
    // Finnish
    "evästeet", "suostumus", "tietosuoja",
    // Czech
    "soubory cookie", "souhlas", "ochrana osobních údajů",
    // Hungarian
    "sütik", "cookie-k", "hozzájárulás", "adatvédelem",
    // Turkish
    "çerez", "çerezler", "cerez", "cerezler", "onay", "gizlilik",
    "kişisel veri",
    // Russian
    "куки", "файлы cookie", "согласие", "конфиденциальность",
    "персональные данные",
    // Ukrainian
    "файли cookie", "згода", "конфіденційність",
    // Japanese
    "クッキー", "cookie", "同意", "プライバシー",
    // Chinese
    "cookie", "隐私", "同意", "个人数据", "数据保护",
    // Korean
    "쿠키", "동의", "개인정보",
    // Arabic
    "ملفات تعريف الارتباط", "كوكيز", "الخصوصية", "موافقة",
    // Thai
    "คุกกี้", "ความยินยอม", "ความเป็นส่วนตัว",
    // Vietnamese
    "cookie", "quyền riêng tư", "đồng ý",
    // Indonesian
    "cookie", "privasi", "persetujuan",
    // Hindi
    "कुकी", "गोपनीयता", "सहमति",
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // AVOID KEYWORDS (pages where we should NOT act)
  // ═══════════════════════════════════════════════════════════════════════════

  const AVOID_KEYWORDS = [
    "captcha", "recaptcha", "i'm not a robot", "i am not a robot",
    "verify you are human", "prove you're human", "human verification",
    "robot verification", "security check", "access denied",
    "please verify", "challenge", "hcaptcha",
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
    if (!el.isConnected) return false;
    try {
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
    } catch (e) {
      return false;
    }
  }

  function isInViewport(el) {
    try {
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth || document.documentElement.clientWidth;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      return (
        rect.top < vh + 100 &&
        rect.bottom > -100 &&
        rect.left < vw + 100 &&
        rect.right > -100
      );
    } catch (e) {
      return false;
    }
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

  function querySelectorAllDeep(selector, root = document, maxDepth = 3) {
    const results = [];
    if (maxDepth <= 0) return results;

    try {
      const found = root.querySelectorAll(selector);
      found.forEach((el) => results.push(el));
    } catch (e) { /* invalid selector */ }

    // Traverse shadow DOMs (with depth limit to prevent infinite recursion)
    try {
      const allElements = root.querySelectorAll("*");
      for (const el of allElements) {
        if (el.shadowRoot) {
          const shadowResults = querySelectorAllDeep(selector, el.shadowRoot, maxDepth - 1);
          shadowResults.forEach((r) => results.push(r));
        }
      }
    } catch (e) { /* skip */ }

    return results;
  }

  function querySelectorDeep(selector, root = document, maxDepth = 3) {
    if (maxDepth <= 0) return null;

    try {
      const found = root.querySelector(selector);
      if (found) return found;
    } catch (e) { /* skip */ }

    try {
      const allElements = root.querySelectorAll("*");
      for (const el of allElements) {
        if (el.shadowRoot) {
          const found = querySelectorDeep(selector, el.shadowRoot, maxDepth - 1);
          if (found) return found;
        }
      }
    } catch (e) { /* skip */ }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  const STATE_KEY = "__IDGAC__" + window.location.hostname;
  let clickCount = 0;
  let hasBeenHandled = false;
  let cssFallbackInjected = false;
  let lastUrl = window.location.href;
  let extensionEnabled = true;
  let siteBlocked = false;

  function markHandled() {
    clickCount++;
    if (clickCount >= CONFIG.maxClicksPerDomain) {
      hasBeenHandled = true;
    }
    // Persist state
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          [STATE_KEY]: { count: clickCount, ts: Date.now() },
        });
      }
    } catch (e) {
      try {
        localStorage.setItem(STATE_KEY, JSON.stringify({ count: clickCount, ts: Date.now() }));
      } catch (e2) { /* ignore */ }
    }
    // Notify background script
    notifyBackground("bannerDismissed", { hostname: window.location.hostname });
  }

  function loadState(callback) {
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([STATE_KEY, "blocklist", "debug"], (data) => {
          if (chrome.runtime.lastError) {
            callback();
            return;
          }
          if (data && data[STATE_KEY]) {
            const stored = data[STATE_KEY];
            // Reset if older than 24 hours
            if (stored.ts && Date.now() - stored.ts > 86400000) {
              clickCount = 0;
            } else {
              clickCount = stored.count || 0;
            }
            if (clickCount >= CONFIG.maxClicksPerDomain) {
              hasBeenHandled = true;
            }
          }
          // Check blocklist
          if (data && data.blocklist) {
            const hostname = window.location.hostname;
            if (Array.isArray(data.blocklist) && data.blocklist.some(
              (pattern) => hostname === pattern || hostname.endsWith("." + pattern)
            )) {
              siteBlocked = true;
            }
          }
          // Debug mode
          if (data && data.debug) {
            debugMode = true;
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
  // BACKGROUND COMMUNICATION
  // ═══════════════════════════════════════════════════════════════════════════

  function notifyBackground(action, data = {}) {
    try {
      if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action, ...data }, () => {
          // Ignore errors (background may not be listening)
          if (chrome.runtime.lastError) { /* expected */ }
        });
      }
    } catch (e) { /* not in extension context */ }
  }

  // Listen for messages from background
  try {
    if (chrome && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === "reScan") {
          // Background requested a re-scan (e.g., after SPA navigation)
          hasBeenHandled = false;
          clickCount = 0;
          cssFallbackInjected = false;
          scheduleRetries();
          startObserver();
          sendResponse({ ok: true });
        } else if (msg.action === "getStatus") {
          sendResponse({
            handled: hasBeenHandled,
            clicks: clickCount,
            url: window.location.href,
          });
        } else if (msg.action === "toggleSite") {
          siteBlocked = msg.blocked;
          if (siteBlocked && cssFallbackInjected) {
            removeCssFallback();
          }
          sendResponse({ ok: true });
        }
        return true; // Keep channel open for async response
      });
    }
  } catch (e) { /* not in extension context */ }

  // ═══════════════════════════════════════════════════════════════════════════
  // TARGET VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  function isBadTarget(el, text) {
    const t = normalizeText(text);

    if (containsAny(t, NEGATIVE_KEYWORDS)) return true;
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
      "/policy", "/terms", "/legal", "/datenschutz", "/impressum",
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
      return true; // Real navigation link
    }

    return false;
  }

  function isLikelyRobotPage() {
    try {
      const bodyText = normalizeText(
        (document.body && document.body.innerText) || ""
      ).substring(0, 3000); // Only check first 3000 chars for performance
      return containsAny(bodyText, AVOID_KEYWORDS);
    } catch (e) {
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STRATEGY 1: CMP-SPECIFIC SELECTORS
  // ═══════════════════════════════════════════════════════════════════════════

  function tryCMPSelectors() {
    for (const selector of CMP_ACCEPT_SELECTORS) {
      try {
        const el = querySelectorDeep(selector);
        if (el && isVisible(el)) {
          const text = normalizeText(el.innerText || el.value || el.textContent || "");
          // Verify it's not a negative button
          const rejectWords = [
            "reject", "decline", "deny", "refuse", "ablehnen", "refuser",
            "rechazar", "rifiuta", "weigeren", "odrzuć", "reddet", "отклонить",
          ];
          if (!containsAny(text, rejectWords)) {
            return el;
          }
        }
      } catch (e) { /* selector may be invalid in context */ }
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STRATEGY 2: CONTAINER-BASED DETECTION
  // ═══════════════════════════════════════════════════════════════════════════

  function findCookieContainers() {
    const containers = [];
    const seen = new WeakSet();

    // Known CMP containers
    for (const selector of CMP_CONTAINER_SELECTORS) {
      try {
        const elements = querySelectorAllDeep(selector);
        for (const el of elements) {
          if (seen.has(el) || !isVisible(el)) continue;
          seen.add(el);
          containers.push(el);
        }
      } catch (e) { /* skip invalid selector */ }
    }

    // Heuristic scan for unknown banners
    try {
      const candidates = document.querySelectorAll(
        "div, section, aside, dialog, form, [role='dialog'], [role='alertdialog'], [role='banner']"
      );

      const vw = window.innerWidth || document.documentElement.clientWidth || 1024;
      const vh = window.innerHeight || document.documentElement.clientHeight || 768;

      for (const el of candidates) {
        if (seen.has(el) || !isVisible(el)) continue;

        const rect = el.getBoundingClientRect();
        if (rect.width < CONFIG.minBannerWidth || rect.height < CONFIG.minBannerHeight) continue;
        if (rect.width * rect.height > vw * vh * 0.85) continue;

        const idClass = normalizeText((el.id || "") + " " + (el.className || "").toString());
        const hasCookieHint = containsAny(idClass, [
          "cookie", "consent", "gdpr", "privacy", "banner", "notice",
          "compliance", "dsgvo", "rgpd", "ccpa", "eprivacy",
          "cerez", "çerez", "datenschutz", "consentement", "confidentialit",
          "privacidad", "consenso", "toestemming", "ciasteczk",
          "kakor", "samtycke", "eväste", "souhlas", "süti",
          "gizlilik", "куки", "согласие",
          "クッキー", "쿠키", "คุกกี้", "كوكيز", "कुकी",
        ]);

        const innerText = normalizeText((el.innerText || "").substring(0, 2000));
        const mentionsCookies = containsAny(innerText, COOKIE_CONTEXT_KEYWORDS);
        const looksLikeRobot = containsAny(innerText, AVOID_KEYWORDS);

        if (!hasCookieHint && !mentionsCookies) continue;
        if (looksLikeRobot) continue;

        // Check positioning
        const style = window.getComputedStyle(el);
        const position = style.position;
        const zIndex = parseInt(style.zIndex) || 0;
        const isOverlay = position === "fixed" || position === "sticky" || zIndex > 100;
        const isBottomBar = rect.bottom > vh * 0.7 && rect.height < vh * 0.4;
        const isTopBar = rect.top < vh * 0.3 && rect.height < vh * 0.4;

        // Only add if it looks like an overlay/banner (not inline content)
        if (hasCookieHint || isOverlay || isBottomBar || isTopBar) {
          seen.add(el);
          containers.push(el);
        }
      }
    } catch (e) { /* skip heuristic scan on error */ }

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
      "div[role='button']",
      "[tabindex='0']",
    ];

    const clickables = [];

    for (const sel of clickableSelectors) {
      try {
        let elements;
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
      } catch (e) { /* skip */ }
    }

    if (!clickables.length) return null;

    // Score each clickable
    const candidates = [];

    for (const { el, text } of clickables) {
      if (isBadTarget(el, text)) continue;

      let strength = 0;

      if (containsAny(text, ACCEPT_PHRASES_STRONG)) {
        strength = 10;
      } else if (matchesExact(text, ACCEPT_PHRASES_GENERIC)) {
        strength = 7;
      } else if (containsAny(text, ACCEPT_PHRASES_GENERIC)) {
        // Filter out false positives for generic matches
        if (
          text.includes("article") || text.includes("section") ||
          text.includes("home") || text.includes("subscribe") ||
          text.includes("sign") || text.includes("log") ||
          text.includes("register") || text.includes("download") ||
          text.includes("newsletter") || text.includes("shop") ||
          text.includes("buy") || text.includes("cart")
        ) {
          continue;
        }
        strength = 4;
      }

      if (strength === 0) continue;

      const rect = el.getBoundingClientRect();
      const area = rect.width * rect.height;
      const tag = (el.tagName || "").toUpperCase();

      let typeBonus = 0;
      if (tag === "BUTTON" || tag === "INPUT") typeBonus = 3;
      else if (el.getAttribute("role") === "button") typeBonus = 2;
      else if (tag === "A") typeBonus = 0;
      else typeBonus = 1;

      // Prefer elements with prominent styling
      let styleBonus = 0;
      try {
        const style = window.getComputedStyle(el);
        const bgColor = style.backgroundColor;
        if (bgColor && bgColor !== "rgba(0, 0, 0, 0)" && bgColor !== "transparent") {
          styleBonus += 2;
        }
        // Primary/CTA buttons tend to be bolder
        const fontWeight = parseInt(style.fontWeight) || 400;
        if (fontWeight >= 600) styleBonus += 1;
      } catch (e) { /* skip */ }

      candidates.push({
        el,
        score: strength * 100 + typeBonus * 10 + styleBonus * 5 + Math.min(area / 100, 50),
      });
    }

    if (!candidates.length) return null;
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
      "[role='button'][aria-label*='accept' i]",
      "[role='button'][aria-label*='agree' i]",
      "button[data-action='accept']",
      "button[data-action='agree']",
      "button[data-consent='accept']",
      "button[data-cookieconsent='accept']",
      "a[data-action='accept']",
      "a[data-consent='accept']",
      "[data-cy='cookie-accept']",
      "[data-testid*='accept']",
      "[data-testid*='agree']",
    ];

    for (const selector of ariaSelectors) {
      try {
        const el = querySelectorDeep(selector);
        if (el && isVisible(el)) {
          const text = normalizeText(el.innerText || el.value || el.getAttribute("aria-label") || "");
          if (!containsAny(text, NEGATIVE_KEYWORDS.slice(0, 40))) {
            return el;
          }
        }
      } catch (e) { /* skip */ }
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STRATEGY 4: OVERLAY/BACKDROP DETECTION
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
      try {
        const overlays = document.querySelectorAll(sel);
        for (const overlay of overlays) {
          if (!isVisible(overlay)) continue;

          const style = window.getComputedStyle(overlay);
          const rect = overlay.getBoundingClientRect();
          const vw = window.innerWidth || 1024;
          const vh = window.innerHeight || 768;

          if (rect.width < vw * 0.8 || rect.height < vh * 0.8) continue;
          if (style.position !== "fixed" && style.position !== "absolute") continue;

          const text = normalizeText((overlay.innerText || "").substring(0, 2000));
          if (!containsAny(text, COOKIE_CONTEXT_KEYWORDS)) continue;
          if (containsAny(text, AVOID_KEYWORDS)) continue;

          const btn = findAcceptButtonInContainer(overlay);
          if (btn) return btn;
        }
      } catch (e) { /* skip */ }
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STRATEGY 5: IFRAME-BASED CONSENT
  // ═══════════════════════════════════════════════════════════════════════════

  function tryIframeConsent() {
    try {
      const iframes = document.querySelectorAll("iframe");
      for (const iframe of iframes) {
        const src = (iframe.src || "").toLowerCase();
        const consentHosts = [
          "consent", "cookie", "gdpr", "privacy", "cmp",
          "trustarc", "onetrust", "cookiebot", "quantcast",
          "didomi", "sourcepoint", "consentmanager",
        ];

        if (!consentHosts.some((h) => src.includes(h))) continue;

        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          if (!iframeDoc) continue;

          for (const selector of CMP_ACCEPT_SELECTORS) {
            try {
              const el = iframeDoc.querySelector(selector);
              if (el && isVisible(el)) return el;
            } catch (e) { /* cross-origin */ }
          }

          const buttons = iframeDoc.querySelectorAll("button, [role='button'], a");
          for (const btn of buttons) {
            const text = normalizeText(btn.innerText || btn.value || "");
            if (containsAny(text, ACCEPT_PHRASES_STRONG) && !containsAny(text, NEGATIVE_KEYWORDS)) {
              if (isVisible(btn)) return btn;
            }
          }
        } catch (e) { /* cross-origin iframe */ }
      }
    } catch (e) { /* skip */ }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STRATEGY 6: FULL-PAGE SCAN (strict, last resort)
  // ═══════════════════════════════════════════════════════════════════════════

  function tryFullPageScan() {
    try {
      const bodyText = normalizeText(
        (document.body && document.body.innerText || "").substring(0, 5000)
      );
      if (!containsAny(bodyText, COOKIE_CONTEXT_KEYWORDS)) return null;
      if (isLikelyRobotPage()) return null;

      const selectors = ["button", "[role='button']", "input[type='button']", "input[type='submit']"];

      const vh = window.innerHeight || document.documentElement.clientHeight || 768;
      const candidates = [];

      for (const sel of selectors) {
        const elements = querySelectorAllDeep(sel);
        for (const el of elements) {
          if (!isVisible(el) || !isInViewport(el)) continue;

          const rawText = el.innerText || el.value || el.textContent || "";
          const text = normalizeText(rawText);
          if (!text || text.length > 30) continue;
          if (isBadTarget(el, text)) continue;

          // Only strong accept phrases for full-page scan
          if (!containsAny(text, ACCEPT_PHRASES_STRONG)) continue;

          const rect = el.getBoundingClientRect();
          const area = rect.width * rect.height;
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
    } catch (e) {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLICK ENGINE (with verification and retry)
  // ═══════════════════════════════════════════════════════════════════════════

  let pendingVerification = null;

  function clickButton(el, strategy) {
    try {
      log(`Attempting click via ${strategy}:`, el.innerText || el.value);

      // Method 1: Full mouse event sequence (most realistic)
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      const eventOptions = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
      };

      el.dispatchEvent(new PointerEvent("pointerdown", eventOptions));
      el.dispatchEvent(new MouseEvent("mousedown", eventOptions));
      el.dispatchEvent(new PointerEvent("pointerup", eventOptions));
      el.dispatchEvent(new MouseEvent("mouseup", eventOptions));
      el.dispatchEvent(new MouseEvent("click", eventOptions));

      // Method 2: Direct click as fallback
      el.click();

      // Method 3: Focus + Enter (for keyboard-accessible buttons)
      try {
        el.focus();
        el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
        el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
      } catch (e) { /* skip */ }

      markHandled();
      log(`Click successful via ${strategy}`);

      // Schedule verification
      scheduleClickVerification(el, strategy);

    } catch (e) {
      logError(`Click failed via ${strategy}:`, e);
      // Fallback: try simple click
      try {
        el.dispatchEvent(new Event("click", { bubbles: true }));
        markHandled();
        scheduleClickVerification(el, strategy);
      } catch (e2) {
        logError("All click methods failed");
      }
    }
  }

  function scheduleClickVerification(clickedEl, strategy) {
    if (pendingVerification) clearTimeout(pendingVerification);

    pendingVerification = setTimeout(() => {
      pendingVerification = null;
      verifyBannerDismissed(clickedEl, strategy);
    }, CONFIG.clickVerifyDelay);
  }

  function verifyBannerDismissed(clickedEl, strategy) {
    // Check if the banner is still visible
    const bannerStillVisible = isBannerStillVisible();

    if (bannerStillVisible) {
      log("Banner still visible after click, attempting recovery...");

      if (clickCount < CONFIG.clickRetryAttempts) {
        // Try clicking again with a different approach
        retryClick(strategy);
      } else {
        // All click attempts exhausted — inject CSS fallback
        log("Click retries exhausted, injecting CSS fallback");
        injectCssFallback();
      }
    } else {
      log("Banner successfully dismissed");
    }
  }

  function isBannerStillVisible() {
    // Check if any known banner container is still visible
    for (const selector of CMP_CONTAINER_SELECTORS.slice(0, 50)) {
      try {
        const el = document.querySelector(selector);
        if (el && isVisible(el)) {
          const rect = el.getBoundingClientRect();
          if (rect.height > 50 && rect.width > 200) {
            return true;
          }
        }
      } catch (e) { /* skip */ }
    }
    return false;
  }

  function retryClick(previousStrategy) {
    log("Retrying cookie acceptance...");
    // Reset handled state to allow another attempt
    hasBeenHandled = false;
    // Try the full detection pipeline again
    setTimeout(() => {
      tryAcceptCookies();
    }, 300);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CSS FALLBACK (hide banners when clicks fail)
  // ═══════════════════════════════════════════════════════════════════════════

  function injectCssFallback() {
    if (cssFallbackInjected) return;
    cssFallbackInjected = true;

    try {
      const style = document.createElement("style");
      style.id = "idgac-css-fallback";
      style.textContent = CSS_HIDE_RULES;
      (document.head || document.documentElement).appendChild(style);

      // Also remove body scroll locks that banners often apply
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.documentElement.style.overflow = "";

      // Remove common body classes that lock scrolling
      const lockClasses = [
        "modal-open", "no-scroll", "overflow-hidden", "cookie-consent-active",
        "cmplz-blocked", "cookies-not-accepted", "gdpr-active",
      ];
      for (const cls of lockClasses) {
        document.body.classList.remove(cls);
        document.documentElement.classList.remove(cls);
      }

      log("CSS fallback injected");
      notifyBackground("cssFallbackUsed", { hostname: window.location.hostname });
    } catch (e) {
      logError("Failed to inject CSS fallback:", e);
    }
  }

  function removeCssFallback() {
    const style = document.getElementById("idgac-css-fallback");
    if (style) {
      style.remove();
      cssFallbackInjected = false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN ORCHESTRATOR
  // ═══════════════════════════════════════════════════════════════════════════

  function tryAcceptCookies() {
    if (hasBeenHandled) return false;
    if (siteBlocked) return false;
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

    // Strategy 6: Full-page scan (last resort)
    button = tryFullPageScan();
    if (button) {
      clickButton(button, "full-page scan");
      return true;
    }

    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPA NAVIGATION DETECTION
  // ═══════════════════════════════════════════════════════════════════════════

  function setupSPADetection() {
    // Method 1: Listen for popstate (back/forward)
    window.addEventListener("popstate", onSPANavigation);

    // Method 2: Listen for hashchange
    window.addEventListener("hashchange", onSPANavigation);

    // Method 3: Patch History API to detect pushState/replaceState
    try {
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;

      history.pushState = function (...args) {
        originalPushState.apply(this, args);
        setTimeout(onSPANavigation, 100);
      };

      history.replaceState = function (...args) {
        originalReplaceState.apply(this, args);
        setTimeout(onSPANavigation, 100);
      };
    } catch (e) { /* skip if patching fails */ }

    // Method 4: Periodic URL check as ultimate fallback
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        onSPANavigation();
      }
    }, CONFIG.spaCheckInterval);
  }

  function onSPANavigation() {
    const newUrl = window.location.href;
    if (newUrl === lastUrl) return;

    log("SPA navigation detected:", lastUrl, "→", newUrl);
    lastUrl = newUrl;

    // Reset state for new page
    hasBeenHandled = false;
    cssFallbackInjected = false;
    // Don't reset clickCount — keep per-domain limit

    // Re-scan after a delay (give new page content time to render)
    setTimeout(() => {
      scheduleRetries();
      startObserver();
    }, CONFIG.observerReactivateDelay);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCHEDULING & OBSERVATION
  // ═══════════════════════════════════════════════════════════════════════════

  let observer = null;
  let observerActive = false;
  let startTime = 0;

  function scheduleRetries() {
    startTime = Date.now();

    // Immediate attempt
    if (tryAcceptCookies()) return;

    // Progressive retries with increasing delays (extended to 30s)
    const delays = [100, 250, 500, 800, 1200, 1800, 2500, 3500, 5000, 7500, 10000, 15000, 20000, 25000];
    for (const delay of delays) {
      if (delay > CONFIG.maxRetryDuration) break;
      setTimeout(() => {
        if (hasBeenHandled || siteBlocked) return;
        tryAcceptCookies();
      }, delay);
    }
  }

  function startObserver() {
    if (observerActive) return;
    observerActive = true;

    const target = document.documentElement || document.body;
    if (!target) return;

    const debouncedHandler = debounce(() => {
      if (hasBeenHandled || siteBlocked) {
        disconnectObserver();
        return;
      }
      if (Date.now() - startTime > CONFIG.maxRetryDuration) {
        disconnectObserver();
        return;
      }
      tryAcceptCookies();
    }, CONFIG.debounceMs);

    observer = new MutationObserver(debouncedHandler);

    observer.observe(target, {
      childList: true,
      subtree: true,
      // Only watch childList changes (not attributes) for performance
    });

    // Auto-disconnect after max duration
    setTimeout(() => {
      disconnectObserver();
    }, CONFIG.maxRetryDuration + 1000);
  }

  function disconnectObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    observerActive = false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  function init() {
    try {
      if (chrome && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get({ enabled: true }, (data) => {
          if (chrome.runtime.lastError) {
            // Extension context lost, still try to run
            startEngine();
            return;
          }
          if (!data.enabled) {
            extensionEnabled = false;
            return;
          }
          startEngine();
        });
        return;
      }
    } catch (e) {
      // Not in extension context (testing)
    }

    // Fallback: run directly
    startEngine();
  }

  function startEngine() {
    loadState(() => {
      if (hasBeenHandled || siteBlocked) return;
      scheduleRetries();
      startObserver();
      setupSPADetection();
    });
  }

  // Start with global error boundary
  try {
    init();
  } catch (e) {
    logError("Fatal initialization error:", e);
    // Even if init fails, try a basic scan after a delay
    setTimeout(() => {
      try { tryAcceptCookies(); } catch (e2) { /* give up */ }
    }, 2000);
  }
})();
