// I Don't Give a Cookie - Universal Cookie Consent Auto-Acceptor
// v2.2.0 - Context-gated detection, single-activation clicks with
// verification, per-site state keyed by the top-level site, and a
// fast path that keeps idle pages cheap.

(() => {
  "use strict";

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGGING
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
    scanWindowMs: 30000,          // How long to keep looking after (re)arming
    scanThrottleMs: 250,          // Min gap between mutation-triggered scans
    retryDelays: [100, 250, 500, 800, 1200, 1800, 2500, 3500, 5000, 7500, 10000, 15000, 20000, 25000],
    verifyStartMs: 600,           // First dismissal check after a click
    verifyEndMs: 2000,            // Give fade-out animations this long
    verifyPollMs: 200,
    clickAttemptsPerBanner: 3,    // Clicks before the CSS fallback kicks in
    maxBannersPerPage: 2,         // e.g. site banner + a second consent step
    maxButtonTextLength: 60,
    minBannerWidth: 150,
    minBannerHeight: 30,
    maxContainerTextLength: 8000, // Banners are short; app shells are not
    maxWallTextLength: 3000,      // Same, for near-fullscreen containers
    maxAncestorWalk: 12,
    maxTextAnchors: 40,
    spaRearmDelay: 1000,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CMP-SPECIFIC ACCEPT BUTTONS (priority order)
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
    ".klaro .cm-btn-accept-all",
    ".klaro .cm-btn-accept",
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
    // Sourcepoint (runs in its own iframe; this script runs there too)
    ".sp_choice_type_11",
    "button.sp_choice_type_ACCEPT_ALL",
    "[data-choice-type='11']",
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
    // TYPO3 Cookie Consent / Cookie Consent by Insites
    ".cc-compliance .cc-btn.cc-allow",
    ".cc-btn.cc-allow",
    ".cc-btn.cc-dismiss",
    // Tarteaucitron
    "#tarteaucitronPersonalize2",
    ".tarteaucitronAllow",
    "#tarteaucitronAllAllowed",
    // Sirdata
    "#sd-cmp button.sd-cmp-3cRQ2",
    // Google Funding Choices
    ".fc-button.fc-cta-consent",
    ".fc-cta-consent",
    // Google's own consent
    "[aria-label='Accept all']",
    "button[jsname='b3VHJd']",
    // Yahoo consent
    "button[name='agree']",
    ".consent-form .accept-all",
    // Microsoft / Bing
    "#bnp_btn_accept",
    "#wcpConsentBannerCtrl button:first-child",
    // Stack Overflow / Stack Exchange
    ".js-accept-cookies",
    ".js-consent-banner-accept",
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
    // Generic IAB TCF / LGPD
    ".cookie-banner-lgpd_accept-button",
    "[data-lgpd-accept]",
    ".consent-accept-all",
    ".cmp-accept-all",
    "#cmp-btn-accept",
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // CMP CONTAINERS (used for verification and the CSS fallback target)
  // ═══════════════════════════════════════════════════════════════════════════

  const CMP_CONTAINER_SELECTORS = [
    "#onetrust-banner-sdk",
    "#onetrust-consent-sdk",
    "#CybotCookiebotDialog",
    "#didomi-host",
    "#didomi-popup",
    ".qc-cmp2-container",
    "#qcCmpUi",
    "#truste-consent-track",
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
    "div[id^='sp_message_container_']",
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
    ".consent-banner",
    "#consent-banner",
    ".ch2-container",
    "#ch2-dialog",
    ".orejime-Notice",
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // CSS FALLBACK RULES (hide banners when clicks fail)
  // ═══════════════════════════════════════════════════════════════════════════

  const CSS_HIDE_SELECTORS = [
    "#onetrust-banner-sdk", "#onetrust-consent-sdk", ".onetrust-pc-dark-filter",
    "#CybotCookiebotDialog", "#CybotCookiebotDialogBodyUnderlay",
    "#didomi-host", "#didomi-popup", ".didomi-popup-backdrop",
    ".qc-cmp2-container", "#qcCmpUi", ".qc-cmp2-overlay",
    "#truste-consent-track", "#truste_overlay", ".truste_overlay", ".truste_box_overlay",
    "#usercentrics-root",
    ".cky-consent-container", ".cky-overlay",
    ".osano-cm-dialog", ".osano-cm-window", ".osano-cm-overlay",
    ".cmplz-cookiebanner",
    "#BorlabsCookieBox",
    "#iubenda-cs-banner",
    ".t-consentPrompt",
    "#hs-eu-cookie-confirmation",
    "#cmpbox", "#cmpbox2", ".cmpboxBGoverlay", ".cmpboxoverlay",
    "#cookie-notice", ".cookie-notice-container",
    "#moove_gdpr_cookie_info_bar",
    "#cookiescript_injected",
    "#tarteaucitron", "#tarteaucitronRoot",
    "#sd-cmp",
    ".fc-consent-root",
    "#consent-bump",
    "#sp-cc",
    "div[id^='sp_message_container_']",
    "#cookie-law-info-bar",
    ".cc-window", ".cc-banner", ".cc-overlay",
    "#gdpr-cookie-message",
    "#cookie-popup",
    ".ch2-container", "#ch2-dialog",
    ".orejime-Notice",
    "[data-idgac-hidden]",
  ];

  const CSS_HIDE_RULES = `
    ${CSS_HIDE_SELECTORS.join(",\n    ")} {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
  `;

  // Classes CMPs put on <html>/<body> to lock scrolling
  const SCROLL_LOCK_CLASSES = [
    "modal-open", "no-scroll", "noscroll", "overflow-hidden",
    "cookie-consent-active", "cmplz-blocked", "cookies-not-accepted",
    "gdpr-active", "didomi-popup-open", "sp-message-open",
    "ot-overflow-hidden", "cmp-open", "cky-modal-open",
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // MULTILINGUAL ACCEPT KEYWORDS
  // ═══════════════════════════════════════════════════════════════════════════

  // Matched as whole words/phrases anywhere in the button text.
  const ACCEPT_PHRASES_STRONG = [
    // English
    "accept all", "accept all cookies", "allow all", "allow all cookies",
    "agree to all", "i agree", "yes, i agree", "agree and continue",
    "i accept", "yes, i accept", "accept & continue", "accept and continue",
    "accept and close", "allow and close", "agree & close",
    "accept recommended", "accept suggested", "accept cookies", "allow cookies",
    // French
    "accepter tout", "tout accepter", "accepter tous les cookies",
    "accepter tous", "j'accepte", "autoriser tout", "tout autoriser",
    "accepter et continuer", "accepter & continuer", "accepter et fermer",
    // German
    "alle akzeptieren", "alle cookies akzeptieren", "alles akzeptieren",
    "alle annehmen", "ich stimme zu", "akzeptieren und weiter",
    "alle zulassen", "zustimmen und weiter", "einverstanden",
    "allen cookies zustimmen", "cookies akzeptieren", "alle erlauben",
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
    "permitir todos",
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
    // Chinese
    "全部接受", "接受所有", "接受所有cookie", "全部允许",
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

  // Matched as whole words anywhere in the button text ("Accept", "Yes, accept").
  const ACCEPT_PHRASES_GENERIC = [
    "accept", "agree", "allow", "consent", "i consent", "got it",
    "understood", "acknowledge",
    "accepter", "autoriser", "d'accord", "j'ai compris",
    "akzeptieren", "zustimmen", "erlauben", "verstanden",
    "aceptar", "de acuerdo", "permitir", "entendido",
    "accetta", "va bene", "sono d'accordo", "consento",
    "aceitar", "entendi",
    "toestaan", "begrepen",
    "akceptuję", "akceptuj", "rozumiem",
    "acceptera", "godkänn", "tillåt", "jag förstår",
    "accepter", "tillad", "forstået",
    "aksepter", "godta", "forstått",
    "hyväksy", "salli", "ymmärrän",
    "přijmout", "souhlasím", "rozumím",
    "acceptă", "sunt de acord",
    "elfogadom", "elfogad", "rendben",
    "αποδοχή", "αποδέχομαι", "συμφωνώ",
    "kabul et", "kabul ediyorum",
    "принять", "принимаю", "согласен",
    "прийняти", "приймаю", "погоджуюсь",
    "同意する", "承認", "許可",
    "同意", "我同意", "接受",
    "동의합니다", "수락", "동의",
    "أوافق", "موافق", "قبول",
    "ยอมรับ",
    "chấp nhận", "đồng ý",
    "terima", "setuju",
    "स्वीकार करें", "सहमत",
  ];

  // Too ambiguous to match inside longer text: only accepted when the
  // button text is exactly this word ("OK", "Close", "Continue").
  const ACCEPT_WORDS_EXACT_ONLY = [
    "ok", "okay", "yes", "continue", "confirm", "close", "dismiss",
    "fermer", "continuer", "weiter", "schließen", "continuar", "cerrar",
    "chiudi", "continua", "fechar", "sluiten", "zamknij", "stäng", "luk",
    "lukk", "sulje", "zavřít", "închide", "bezár", "κλείσιμο", "εντάξει",
    "tamam", "kapat", "хорошо", "закрыть", "закрити", "閉じる", "确定",
    "关闭", "확인", "닫기", "إغلاق", "ตกลง",
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // NEGATIVE KEYWORDS (things we must NOT click)
  // ═══════════════════════════════════════════════════════════════════════════

  const NEGATIVE_KEYWORDS = [
    // English
    "manage", "preferences", "settings", "customize", "customise",
    "learn more", "more info", "more information", "details",
    "reject", "decline", "deny", "refuse", "disagree", "do not agree",
    "don't agree", "only necessary", "necessary only",
    "necessary cookies only", "essential only", "continue without",
    "without accepting", "cookie policy", "privacy policy", "read more",
    "show purposes", "manage options", "cookie settings", "privacy settings",
    "do not sell", "opt out", "opt-out", "save preferences", "save settings",
    "confirm choices", "confirm my choices", "save my choices",
    "cancel", "delete", "remove", "subscribe", "sign in", "sign up",
    "log in", "login", "register", "pay", "buy", "purchase", "checkout",
    "no thanks", "not now",
    // French
    "paramétrer", "paramètres", "personnaliser", "en savoir plus",
    "refuser", "gérer", "plus d'informations", "politique de cookies",
    "continuer sans accepter", "sans accepter", "annuler", "s'abonner",
    // German
    "einstellungen", "anpassen", "mehr erfahren", "ablehnen",
    "verwalten", "nur notwendige", "nur erforderliche",
    "cookie-einstellungen", "datenschutzerklärung", "abbrechen",
    "abonnieren", "ohne zustimmung",
    // Spanish
    "configurar", "personalizar", "más información", "rechazar",
    "gestionar", "solo necesarias", "configuración de cookies", "cancelar",
    // Italian
    "impostazioni", "personalizza", "maggiori informazioni", "rifiuta",
    "gestisci", "solo necessari", "annulla",
    // Portuguese
    "configurações", "definições", "rejeitar", "recusar", "gerenciar",
    // Dutch
    "instellingen", "aanpassen", "meer informatie", "weigeren",
    "beheren", "alleen noodzakelijk",
    // Polish
    "ustawienia", "dostosuj", "więcej informacji", "odrzuć",
    "zarządzaj", "tylko niezbędne",
    // Nordic
    "avvisa", "afvis", "avslå", "hylkää", "inställningar", "indstillinger",
    // Turkish
    "ayarlar", "özelleştir", "daha fazla bilgi", "reddet",
    "yönet", "sadece gerekli",
    // Russian / Ukrainian
    "настройки", "настроить", "подробнее", "отклонить",
    "управлять", "только необходимые", "відхилити", "налаштування",
    // CJK (matched as substrings, so the negated forms of "agree" matter)
    "拒否", "設定", "同意しない", "拒绝", "设置", "不同意", "不接受",
    "거부", "설정", "동의하지 않",
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // COOKIE CONTEXT (text that indicates a cookie/consent banner)
  // ═══════════════════════════════════════════════════════════════════════════

  // Deliberately excludes generic words like "privacy", "terms" or "tracking":
  // those also appear in sign-up and Terms-of-Service dialogs, which we must
  // never answer on the user's behalf.
  const COOKIE_CONTEXT_KEYWORDS = [
    "cookie", "consent", "gdpr", "store and/or access information",
    "similar technologies", "we and our partners",
    "consentement", "traceurs", "stocker et/ou accéder",
    "einwilligung", "speichern und/oder", "wir und unsere partner",
    "consentimiento", "almacenar y/o acceder",
    "consenso", "archiviare e/o accedere",
    "consentimento", "armazenar e/ou aceder",
    "toestemming",
    "ciasteczk", "pliki cookie", "plików cookie",
    "kakor", "samtycke", "samtykke", "informasjonskapsler",
    "eväste", "suostumus",
    "soubory cookie",
    "sütik", "süti",
    "çerez", "cerez",
    "куки", "файлы cookie", "файли cookie",
    "クッキー",
    "쿠키",
    "ملفات تعريف الارتباط", "كوكيز",
    "คุกกี้",
    "कुकी",
  ];

  // id/class fragments that mark an element as a consent container.
  // Not "cmp" (Adobe AEM prefixes every component with cmp-) and not
  // "privacy"/"banner"/"notice" (far too common on ordinary page chrome).
  const CONTAINER_HINTS = [
    "cookie", "consent", "gdpr", "dsgvo", "rgpd", "ccpa", "eprivacy",
    "cerez", "çerez", "consentement",
  ];

  // Challenge pages and widgets we must never touch
  const CAPTCHA_WIDGET_SELECTOR =
    ".g-recaptcha, .h-captcha, .cf-turnstile, [data-sitekey], " +
    "iframe[src*='recaptcha'], iframe[src*='hcaptcha'], iframe[src*='challenges.cloudflare.com']";
  const CHALLENGE_PAGE_SELECTOR =
    "#challenge-form, #challenge-stage, #cf-challenge-running, .cf-browser-verification";
  const CAPTCHA_TEXT = [
    "captcha", "i'm not a robot", "i am not a robot", "verify you are human",
    "prove you're human", "human verification", "robot verification",
  ];

  // Sites where only CMP-specific selectors are used (no heuristics).
  // Kept as a belt-and-braces guard for sites that historically looped.
  const CMP_ONLY_DOMAINS = [
    "x.com", "twitter.com",
    "nytimes.com",
    "vimeo.com",
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // TEXT MATCHING
  // ═══════════════════════════════════════════════════════════════════════════

  // Scripts written without spaces between words: match them as plain
  // substrings. Everything else is matched on word boundaries, so "ok" no
  // longer matches "Book now" and "agree" no longer matches "disagree".
  const NO_SPACE_SCRIPT = /[฀-๿぀-ヿ㐀-鿿豈-﫿가-힯]/;
  const WORD_CHAR =
    "[\\p{Script=Latin}\\p{Script=Cyrillic}\\p{Script=Greek}\\p{Script=Arabic}" +
    "\\p{Script=Hebrew}\\p{Script=Devanagari}\\p{M}\\p{N}]";

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // mode: "word" (both boundaries), "prefix" (start boundary only), "exact"
  function compileMatcher(keywords, mode) {
    const unique = [...new Set(keywords.map((k) => normalizeText(k)))]
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp);
    if (mode === "exact") return new RegExp(`^(?:${unique.join("|")})$`, "u");
    const spaced = [];
    const unspaced = [];
    for (const kw of unique) (NO_SPACE_SCRIPT.test(kw) ? unspaced : spaced).push(kw);
    const tail = mode === "word" ? `(?!${WORD_CHAR})` : "";
    const parts = [];
    if (spaced.length) parts.push(`(?<!${WORD_CHAR})(?:${spaced.join("|")})${tail}`);
    if (unspaced.length) parts.push(`(?:${unspaced.join("|")})`);
    return new RegExp(parts.join("|"), "u");
  }

  function normalizeText(text) {
    return (text || "")
      .toLowerCase()
      .replace(/[‘’ʼ]/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  const RE_STRONG = compileMatcher(ACCEPT_PHRASES_STRONG, "word");
  const RE_GENERIC = compileMatcher(ACCEPT_PHRASES_GENERIC, "word");
  const RE_EXACT = compileMatcher([...ACCEPT_PHRASES_GENERIC, ...ACCEPT_WORDS_EXACT_ONLY], "exact");
  const RE_NEGATIVE = compileMatcher(NEGATIVE_KEYWORDS, "prefix");
  const RE_CONTEXT = compileMatcher(COOKIE_CONTEXT_KEYWORDS, "prefix");
  const RE_CAPTCHA = compileMatcher(CAPTCHA_TEXT, "word");
  const RE_HINT = new RegExp(CONTAINER_HINTS.map(escapeRegExp).join("|"), "i");
  const RE_LEGAL_TEXT = compileMatcher([
    "agreement", "terms of service", "terms of use", "viewer agreement",
    "privacy notice", "legal notice", "end user license",
    "nutzungsbedingungen", "allgemeine geschäftsbedingungen",
    "conditions d'utilisation", "mentions légales",
  ], "prefix");

  // ═══════════════════════════════════════════════════════════════════════════
  // SITE IDENTITY & SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  const IS_TOP = window.top === window;

  function normalizeHost(host) {
    return (host || "").toLowerCase().replace(/^www\./, "");
  }

  // State, stats and the blocklist are keyed by the *top-level* site, so a
  // CMP iframe (Sourcepoint, TrustArc…) is attributed to the page it's on.
  function topLevelHostname() {
    if (IS_TOP) return location.hostname;
    try {
      const origins = location.ancestorOrigins;
      if (origins && origins.length) return new URL(origins[origins.length - 1]).hostname;
    } catch (e) { /* fall through */ }
    try {
      return window.top.location.hostname; // same-origin parents only
    } catch (e) {
      return location.hostname;
    }
  }

  const SITE = normalizeHost(topLevelHostname());

  function hostMatches(site, pattern) {
    const p = normalizeHost(pattern);
    return !!p && (site === p || site.endsWith("." + p));
  }

  const settings = { enabled: true, blocked: false };

  function applyBlocklist(list) {
    settings.blocked = Array.isArray(list) && list.some((p) => hostMatches(SITE, p));
  }

  function canRun() {
    return settings.enabled && !settings.blocked && extensionAlive();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXTENSION PLUMBING
  // ═══════════════════════════════════════════════════════════════════════════

  // After the extension is reloaded/updated, orphaned content scripts keep
  // running with a dead chrome.runtime. Detect that and shut down cleanly.
  function extensionAlive() {
    try {
      return !!(chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  function sendToBackground(action, data = {}) {
    return new Promise((resolve) => {
      if (!extensionAlive()) return resolve(null);
      try {
        chrome.runtime.sendMessage({ action, site: SITE, ...data }, (response) => {
          void chrome.runtime.lastError; // background may be asleep; not an error
          resolve(response || null);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DOM UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    try {
      if (typeof el.checkVisibility === "function") {
        const ok = el.checkVisibility({
          opacityProperty: true, visibilityProperty: true, // current names
          checkOpacity: true, checkVisibilityCSS: true,    // older Chrome
        });
        if (!ok) return false;
      } else {
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
          return false;
        }
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    } catch (e) {
      return false;
    }
  }

  function parentOf(el) {
    if (el.parentElement) return el.parentElement;
    const root = el.getRootNode && el.getRootNode();
    return root && root.host ? root.host : null; // cross shadow boundary
  }

  function classAndId(el) {
    return ((el.id || "") + " " + ((el.getAttribute && el.getAttribute("class")) || "")).toLowerCase();
  }

  function isToggle(el) {
    const type = ((el.getAttribute && el.getAttribute("type")) || "").toLowerCase();
    const role = ((el.getAttribute && el.getAttribute("role")) || "").toLowerCase();
    return type === "checkbox" || type === "radio" || role === "checkbox" || role === "switch";
  }

  function isDisabled(el) {
    return el.disabled === true || (el.getAttribute && el.getAttribute("aria-disabled") === "true");
  }

  // Selectors are validated once so one bad entry can't break the joined query
  function validSelectors(list) {
    const probe = document.createDocumentFragment();
    return list.filter((sel) => {
      try {
        probe.querySelector(sel);
        return true;
      } catch (e) {
        logError("Invalid selector skipped:", sel);
        return false;
      }
    });
  }

  const ACCEPT_SELECTORS = validSelectors(CMP_ACCEPT_SELECTORS);
  const ACCEPT_SELECTOR_JOINED = ACCEPT_SELECTORS.join(",");
  const CONTAINER_SELECTOR_JOINED = validSelectors(CMP_CONTAINER_SELECTORS).join(",");

  // One pass over the tree to find open (and, via chrome.dom, closed) shadow
  // roots. Replaces the old per-selector querySelectorAll("*") walks.
  function collectRoots(start = document) {
    const roots = [start];
    const openOrClosed = (() => {
      try {
        return chrome.dom && chrome.dom.openOrClosedShadowRoot;
      } catch (e) {
        return null;
      }
    })();
    if (start.shadowRoot) roots.push(start.shadowRoot); // start may itself be a host
    for (let i = 0; i < roots.length && roots.length < 100; i++) {
      const walker = document.createTreeWalker(roots[i], NodeFilter.SHOW_ELEMENT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        let sr = n.shadowRoot;
        if (!sr && openOrClosed && n.localName.includes("-")) {
          try { sr = openOrClosed(n); } catch (e) { /* not a host */ }
        }
        if (sr) roots.push(sr);
      }
    }
    return roots;
  }

  function queryAllDeep(roots, selector) {
    const out = [];
    for (const root of roots) {
      try {
        out.push(...root.querySelectorAll(selector));
      } catch (e) { /* skip */ }
    }
    return out;
  }

  // Visible text of an element including its shadow tree (innerText skips
  // shadow content, so append it explicitly).
  function visibleText(el) {
    let text = el.innerText || "";
    try {
      const inner = el.shadowRoot;
      if (inner) for (const child of inner.children) text += " " + (child.innerText || "");
    } catch (e) { /* skip */ }
    return normalizeText(text);
  }

  function buttonText(el) {
    const raw =
      el.innerText || el.value || el.textContent ||
      (el.getAttribute && (el.getAttribute("aria-label") || el.getAttribute("title"))) || "";
    return normalizeText(raw);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TARGET VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  function isBadTarget(el, text) {
    if (!text || text.length > CONFIG.maxButtonTextLength) return true;
    if (RE_NEGATIVE.test(text) || RE_LEGAL_TEXT.test(text)) return true;
    if (isDisabled(el)) return true;

    if (isToggle(el)) return true;

    try {
      if (el.closest && el.closest(CAPTCHA_WIDGET_SELECTOR)) return true;
    } catch (e) { /* skip */ }

    // Anchors: only button-like ones; real links navigate away.
    if ((el.tagName || "").toUpperCase() === "A") {
      const href = (el.getAttribute("href") || "").trim().toLowerCase();
      return !(!href || href === "#" || href === "#!" || href.startsWith("javascript:"));
    }
    return false;
  }

  function isChallengePage() {
    try {
      if (/(^|\.)(hcaptcha\.com|challenges\.cloudflare\.com)$/.test(location.hostname)) return true;
      if (location.pathname.includes("/recaptcha/")) return true;
      return !!document.querySelector(CHALLENGE_PAGE_SELECTOR);
    } catch (e) {
      return false;
    }
  }

  // Is this button part of a cookie/consent UI? Gates generic CMP selectors
  // such as .agree-button or button[name='agree'], which also exist on
  // sign-up forms. Deliberately does not look at <body>: a "Cookie policy"
  // footer link must not make every button on the page eligible.
  function hasConsentContext(el) {
    let node = el;
    for (let depth = 0; node && depth < CONFIG.maxAncestorWalk; depth++) {
      if (node === document.body || node === document.documentElement) break;
      if (RE_HINT.test(classAndId(node))) return true;
      node = parentOf(node);
    }
    const box = floatingAncestor(el);
    if (box && RE_CONTEXT.test(visibleText(box))) return true;
    // Inside a CMP iframe (Sourcepoint, TrustArc…) the whole document is the banner
    return !IS_TOP && RE_CONTEXT.test(normalizeText((document.body && document.body.innerText) || ""));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STRATEGY 1: KNOWN CMP ACCEPT BUTTONS
  // ═══════════════════════════════════════════════════════════════════════════

  function findCMPButton(roots) {
    const hits = queryAllDeep(roots, ACCEPT_SELECTOR_JOINED);
    if (!hits.length) return null;

    for (const selector of ACCEPT_SELECTORS) {
      for (const el of hits) {
        try {
          if (!el.matches(selector) || !isVisible(el) || isDisabled(el) || isToggle(el)) continue;
          const text = buttonText(el);
          if (text && RE_NEGATIVE.test(text)) continue;
          if (!hasConsentContext(el)) continue;
          return { el, container: closestContainer(el), strategy: `CMP selector ${selector}` };
        } catch (e) { /* skip */ }
      }
    }
    return null;
  }

  function closestContainer(el) {
    let node = el;
    for (let depth = 0; node && depth < CONFIG.maxAncestorWalk; depth++) {
      try {
        if (node.matches && node.matches(CONTAINER_SELECTOR_JOINED)) return node;
      } catch (e) { /* skip */ }
      if (node.parentElement === null && node.getRootNode && node.getRootNode().host) {
        node = node.getRootNode().host;
        continue;
      }
      node = node.parentElement;
    }
    return floatingAncestor(el);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STRATEGY 2: CONSENT CONTAINERS (known + text-anchored heuristics)
  // ═══════════════════════════════════════════════════════════════════════════

  // Nearest ancestor that looks like a banner/dialog rather than page content.
  function floatingAncestor(start) {
    let node = start;
    for (let depth = 0; node && depth < CONFIG.maxAncestorWalk; depth++) {
      if (node.nodeType === 1 && node !== document.body && node !== document.documentElement) {
        try {
          if (RE_HINT.test(classAndId(node))) return node;
          const role = node.getAttribute("role");
          if (role === "dialog" || role === "alertdialog" || node.getAttribute("aria-modal") === "true") return node;
          if (node.localName === "dialog" && node.open) return node;
          const style = getComputedStyle(node);
          if (style.position === "fixed" || style.position === "sticky") return node;
          if ((parseInt(style.zIndex, 10) || 0) > 100 && style.position !== "static") return node;
        } catch (e) { /* skip */ }
      }
      node = parentOf(node);
    }
    return null;
  }

  function isPlausibleContainer(el) {
    if (!isVisible(el)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < CONFIG.minBannerWidth || rect.height < CONFIG.minBannerHeight) return false;

    const text = visibleText(el);
    if (!RE_CONTEXT.test(text)) return false;       // must *say* cookies/consent
    if (RE_CAPTCHA.test(text)) return false;
    if (text.length > CONFIG.maxContainerTextLength) return false;

    const vw = window.innerWidth || 1024;
    const vh = window.innerHeight || 768;
    const nearlyFullscreen = rect.width * rect.height > vw * vh * 0.85;
    if (nearlyFullscreen && text.length > CONFIG.maxWallTextLength) return false; // app shell, not a wall
    return true;
  }

  // Cheap pre-check: the page (or a shadow tree) must mention cookies at all.
  function mentionsConsent(roots) {
    for (const root of roots) {
      const host = root === document ? document.body : root;
      if (host && RE_CONTEXT.test(normalizeText((host.textContent || "").slice(0, 200000)))) return true;
    }
    return false;
  }

  function findContainers(roots) {
    const found = [];
    const seen = new Set();
    const add = (el) => {
      if (!el || seen.has(el)) return;
      seen.add(el);
      if (isPlausibleContainer(el)) found.push(el);
    };

    // Known CMP containers
    for (const el of queryAllDeep(roots, CONTAINER_SELECTOR_JOINED)) add(el);

    // Text-anchored: start from text that mentions cookies and walk up to the
    // floating box that contains it. Footer links ("Cookie policy") are
    // ignored naturally because they don't sit in a floating container.
    let anchors = 0;
    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|TEXTAREA)$/.test(parent.tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          return node.data.length > 3 && RE_CONTEXT.test(normalizeText(node.data))
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        },
      });
      for (let t = walker.nextNode(); t && anchors < CONFIG.maxTextAnchors; t = walker.nextNode()) {
        anchors++;
        add(floatingAncestor(t.parentElement));
      }
    }
    return found;
  }

  const CLICKABLE_SELECTOR = [
    "button", "[role='button']", "input[type='button']", "input[type='submit']",
    "a", "[onclick]", "[tabindex='0']",
  ].join(",");

  function findAcceptButtonInContainer(container) {
    const candidates = [];
    for (const el of queryAllDeep(collectRoots(container), CLICKABLE_SELECTOR)) {
      if (!isVisible(el)) continue;
      const text = buttonText(el);
      if (isBadTarget(el, text)) continue;

      let strength = 0;
      if (RE_STRONG.test(text)) strength = 10;
      else if (RE_EXACT.test(text)) strength = 7;
      else if (RE_GENERIC.test(text)) strength = 4;
      if (!strength) continue;

      const tag = (el.tagName || "").toUpperCase();
      let typeBonus = 1;
      if (tag === "BUTTON" || tag === "INPUT") typeBonus = 3;
      else if (el.getAttribute("role") === "button") typeBonus = 2;
      else if (tag === "A") typeBonus = 0;

      let styleBonus = 0;
      try {
        const style = getComputedStyle(el);
        const bg = style.backgroundColor;
        if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") styleBonus += 2;
        if ((parseInt(style.fontWeight, 10) || 400) >= 600) styleBonus += 1;
      } catch (e) { /* skip */ }

      const rect = el.getBoundingClientRect();
      candidates.push({
        el,
        score: strength * 100 + typeBonus * 10 + styleBonus * 5 + Math.min((rect.width * rect.height) / 100, 50),
      });
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].el;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DETECTION PIPELINE
  // ═══════════════════════════════════════════════════════════════════════════

  const cmpOnly = CMP_ONLY_DOMAINS.some((d) => hostMatches(SITE, d));

  // full=false: only the cheap document-level CMP selector check. Used for
  // mutations that add nothing cookie-related (tickers, carousels, ads).
  function findTarget(full = true) {
    if (isChallengePage()) return null;
    const roots = full ? collectRoots() : [document];

    const cmp = findCMPButton(roots);
    if (cmp) return cmp;

    if (cmpOnly || !full) return null;
    if (!mentionsConsent(roots)) return null; // fast path for most pages

    for (const container of findContainers(roots)) {
      const el = findAcceptButtonInContainer(container);
      if (el) return { el, container, strategy: "container" };
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLICK ENGINE
  // ═══════════════════════════════════════════════════════════════════════════

  // One activation per attempt. The old engine fired a synthetic click AND
  // el.click() AND Enter, i.e. 2-3 activations per attempt.
  function activate(el) {
    const rect = el.getBoundingClientRect();
    const base = {
      bubbles: true, cancelable: true, composed: true, view: window,
      clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, button: 0,
    };
    const pointer = { ...base, pointerId: 1, pointerType: "mouse", isPrimary: true };
    // Some CMPs listen for pointer/mouse down/up rather than click
    el.dispatchEvent(new PointerEvent("pointerdown", pointer));
    el.dispatchEvent(new MouseEvent("mousedown", base));
    el.dispatchEvent(new PointerEvent("pointerup", pointer));
    el.dispatchEvent(new MouseEvent("mouseup", base));
    el.click(); // the single real activation (composed, triggers default action)
  }

  function stillShowing(target) {
    if (isVisible(target.el)) return true;
    return !!(target.container && isVisible(target.container) && target.container.contains(target.el));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CSS FALLBACK
  // ═══════════════════════════════════════════════════════════════════════════

  let cssFallbackInjected = false;

  function injectCssFallback(target) {
    try {
      if (target && target.container) target.container.setAttribute("data-idgac-hidden", "");
      if (!document.getElementById("idgac-css-fallback")) {
        const style = document.createElement("style");
        style.id = "idgac-css-fallback";
        style.textContent = CSS_HIDE_RULES;
        (document.head || document.documentElement).appendChild(style);
      }
      hideBlockingBackdrops();
      unlockScroll();
      if (!cssFallbackInjected) {
        cssFallbackInjected = true;
        sendToBackground("cssFallbackUsed");
      }
      log("CSS fallback injected");
    } catch (e) {
      logError("Failed to inject CSS fallback:", e);
    }
  }

  // Empty full-screen fixed layers left behind once the dialog is hidden
  function hideBlockingBackdrops() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const points = [[vw / 2, vh / 2], [10, 10], [vw - 10, vh - 10]];
    for (const [x, y] of points) {
      for (const el of document.elementsFromPoint(x, y)) {
        if (el === document.body || el === document.documentElement) break;
        const style = getComputedStyle(el);
        if (style.position !== "fixed") continue;
        // Decorative full-page layers (video/canvas backgrounds) sit low in
        // the stack; consent backdrops sit on top of the page.
        if ((parseInt(style.zIndex, 10) || 0) < 100) continue;
        if (/^(CANVAS|VIDEO|IMG|IFRAME|PICTURE)$/.test(el.tagName)) continue;
        const r = el.getBoundingClientRect();
        const covers = r.width >= vw * 0.9 && r.height >= vh * 0.9;
        if (covers && (el.textContent || "").trim().length < 20) {
          el.setAttribute("data-idgac-hidden", "");
        }
      }
    }
  }

  function unlockScroll() {
    for (const node of [document.documentElement, document.body]) {
      if (!node) continue;
      for (const cls of SCROLL_LOCK_CLASSES) node.classList.remove(cls);
      if (getComputedStyle(node).overflow === "hidden" && node.style.overflow === "hidden") {
        node.style.overflow = "";
      }
      if (node.style.position === "fixed") node.style.position = "";
    }
  }

  function removeCssFallback() {
    const style = document.getElementById("idgac-css-fallback");
    if (style) style.remove();
    for (const el of document.querySelectorAll("[data-idgac-hidden]")) el.removeAttribute("data-idgac-hidden");
    cssFallbackInjected = false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE MACHINE
  //   idle → scanning → clicking → verifying → scanning (retry) | done | stopped
  // ═══════════════════════════════════════════════════════════════════════════

  const state = {
    phase: "idle",
    armedAt: 0,
    attempts: 0,       // clicks on the current banner
    successes: 0,      // banners dismissed on this page
    lastStrategy: null,
    timers: new Set(),
    observer: null,
    lastScan: 0,
    scanQueued: false,
    fullScanPending: false,
  };

  function later(fn, ms) {
    const id = setTimeout(() => {
      state.timers.delete(id);
      fn();
    }, ms);
    state.timers.add(id);
  }

  function clearTimers() {
    for (const id of state.timers) clearTimeout(id);
    state.timers.clear();
    state.scanQueued = false;
  }

  function arm(reason) {
    if (!canRun()) return;
    log("Scanning armed:", reason);
    clearTimers();
    state.phase = "scanning";
    state.armedAt = Date.now();
    state.attempts = 0;
    scan();
    for (const delay of CONFIG.retryDelays) {
      if (delay < CONFIG.scanWindowMs) later(scan, delay);
    }
    later(() => stop("scan window elapsed"), CONFIG.scanWindowMs);
    startObserver();
  }

  function stop(reason) {
    if (state.phase === "stopped" || state.phase === "done") return;
    log("Scanning stopped:", reason);
    state.phase = reason === "done" ? "done" : "stopped";
    clearTimers();
    stopObserver();
  }

  function scan(full = true) {
    if (state.phase !== "scanning") return;
    if (!canRun()) {
      stop("disabled");
      return;
    }
    state.lastScan = Date.now();
    let target = null;
    try {
      target = findTarget(full);
    } catch (e) {
      logError("Detection error:", e);
    }
    if (!target) return;

    state.phase = "clicking";
    sendToBackground("requestClick").then((res) => {
      if (state.phase !== "clicking") return;
      if (res && res.allowed === false) {
        log("Loop guard: too many clicks on this site recently, backing off");
        stop("loop guard");
        return;
      }
      if (!target.el.isConnected) {
        state.phase = "scanning";
        return;
      }
      try {
        log(`Clicking via ${target.strategy}:`, buttonText(target.el));
        activate(target.el);
      } catch (e) {
        logError("Click failed:", e);
      }
      state.attempts++;
      state.lastStrategy = target.strategy;
      state.phase = "verifying";
      verify(target, CONFIG.verifyStartMs);
    });
  }

  function verify(target, elapsed) {
    later(() => {
      if (state.phase !== "verifying") return;
      if (!stillShowing(target)) return onDismissed();
      if (elapsed + CONFIG.verifyPollMs <= CONFIG.verifyEndMs) {
        return verify(target, elapsed + CONFIG.verifyPollMs);
      }
      onStillVisible(target);
    }, elapsed === CONFIG.verifyStartMs ? elapsed : CONFIG.verifyPollMs);
  }

  function onDismissed() {
    state.successes++;
    state.attempts = 0;
    log("Banner dismissed");
    sendToBackground("bannerDismissed", { strategy: state.lastStrategy });
    if (state.successes >= CONFIG.maxBannersPerPage) {
      stop("done");
    } else {
      state.phase = "scanning"; // watch briefly for a second consent step
    }
  }

  function onStillVisible(target) {
    if (state.attempts < CONFIG.clickAttemptsPerBanner) {
      log(`Banner still visible after attempt ${state.attempts}, retrying`);
      state.phase = "scanning";
      scan();
      return;
    }
    log("Click attempts exhausted, using CSS fallback");
    injectCssFallback(target);
    stop("done");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBSERVATION (throttled, not debounced: a live ticker can't starve it)
  // ═══════════════════════════════════════════════════════════════════════════

  // Does this batch add anything that could be (part of) a consent banner?
  function mutationsLookRelevant(records) {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 3) {
          if (RE_CONTEXT.test(normalizeText(node.data))) return true;
        } else if (node.nodeType === 1) {
          if (node.localName.includes("-") || node.shadowRoot || node.localName === "iframe") return true;
          if (RE_HINT.test(classAndId(node))) return true;
          if (RE_CONTEXT.test(normalizeText((node.textContent || "").slice(0, 5000)))) return true;
        }
      }
    }
    return false;
  }

  function onMutations(records) {
    if (state.phase !== "scanning") return;
    if (mutationsLookRelevant(records)) state.fullScanPending = true;
    if (state.scanQueued) return;
    const wait = Math.max(0, state.lastScan + CONFIG.scanThrottleMs - Date.now());
    state.scanQueued = true;
    later(() => {
      state.scanQueued = false;
      const full = state.fullScanPending;
      state.fullScanPending = false;
      scan(full);
    }, wait);
  }

  function startObserver() {
    if (state.observer) return;
    const target = document.documentElement;
    if (!target) return;
    state.observer = new MutationObserver(onMutations);
    state.observer.observe(target, { childList: true, subtree: true });
  }

  function stopObserver() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPA NAVIGATION (top frame only)
  // ═══════════════════════════════════════════════════════════════════════════

  let lastUrl = location.href;

  function onUrlChange() {
    if (location.href === lastUrl) return;
    log("SPA navigation:", lastUrl, "→", location.href);
    lastUrl = location.href;
    // Acceptance lock: consent already given on this page load stays given.
    if (state.successes > 0 || cssFallbackInjected) return;
    setTimeout(() => arm("spa navigation"), CONFIG.spaRearmDelay);
  }

  function setupSPADetection() {
    if (!IS_TOP) return;
    // Patching history.pushState from a content script does nothing: the
    // page runs in a different JS world. The Navigation API's events do
    // reach us; fall back to polling where it isn't available.
    if (window.navigation && typeof window.navigation.addEventListener === "function") {
      window.navigation.addEventListener("navigatesuccess", onUrlChange);
    } else {
      setInterval(onUrlChange, 1000);
    }
    window.addEventListener("popstate", onUrlChange);
    window.addEventListener("hashchange", onUrlChange);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MESSAGES & SETTINGS CHANGES
  // ═══════════════════════════════════════════════════════════════════════════

  function status() {
    return {
      site: SITE,
      phase: state.phase,
      dismissed: state.successes,
      attempts: state.attempts,
      cssFallback: cssFallbackInjected,
      enabled: settings.enabled,
      blocked: settings.blocked,
    };
  }

  function listen() {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!msg) return false;
      if (msg.action === "reScan") {
        // Explicit user request from the popup: always re-arm.
        if (!canRun()) {
          if (IS_TOP) sendResponse({ ok: false, ...status() });
          return false;
        }
        state.successes = 0;
        arm("popup re-scan");
        if (IS_TOP) sendResponse({ ok: true, ...status() });
        return false;
      }
      if (msg.action === "getStatus" && IS_TOP) {
        sendResponse(status());
        return false;
      }
      return false;
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "sync" && changes.enabled) settings.enabled = changes.enabled.newValue !== false;
      if (area === "local" && changes.blocklist) applyBlocklist(changes.blocklist.newValue);
      if (area === "local" && changes.debug) debugMode = !!changes.debug.newValue;
      if (!changes.enabled && !changes.blocklist) return;

      if (canRun()) {
        if (state.phase === "idle" || state.phase === "stopped") arm("settings changed");
      } else {
        stop("disabled");
        removeCssFallback();
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  function loadSettings() {
    return Promise.all([
      chrome.storage.sync.get({ enabled: true }),
      chrome.storage.local.get({ blocklist: [], debug: false }),
    ]).then(([sync, local]) => {
      settings.enabled = sync.enabled !== false;
      applyBlocklist(local.blocklist);
      debugMode = !!local.debug;
    });
  }

  async function init() {
    if (!extensionAlive()) return;
    listen();
    try {
      await loadSettings();
    } catch (e) {
      logError("Could not load settings, using defaults:", e);
    }
    if (IS_TOP) sendToBackground("pageStart");
    setupSPADetection();
    if (canRun()) arm("page load");
  }

  init().catch((e) => logError("Fatal initialization error:", e));
})();
