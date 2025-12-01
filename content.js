// I Don't Give a Cookie - content script
// v4.0 - universal engine + per-domain caps + robot-page filter

// ---------- CONFIG ----------

// Max number of total "accept" clicks per domain.
// Protects against infinite redirect loops.
const MAX_TOTAL_ACCEPTS_PER_DOMAIN = 3;

// Domains where we enable an extra strict bottom/top bar fallback
const PRIORITY_DOMAINS = [
  "nytimes.com",
  "msn.com",
  "cnn.com",
  "indiatimes.com",
  "news.google.com",
  "theguardian.com",
  "foxnews.com",
  "finance.yahoo.com",
  "dailymail.co.uk",
  "people.com",
  "news.yahoo.com",
  "news18.com",
  "hindustantimes.com",
  "usatoday.com",
  "substack.com",
  "ndtv.com",
  "cnbc.com",
  "nypost.com",
  "indianexpress.com",
  "apnews.com",
  "cbsnews.com",
  "indiatoday.in",
  "reuters.com",
  "wsj.com",
  "nbcnews.com",
  "newsweek.com",
  "washingtonpost.com",
  "forbes.com",
  "oneindia.com",
  "india.com",
  "businessinsider.com",
  "telegraph.co.uk",
  "independent.co.uk",
  "thehindu.com",
  "abc.net.au",
  "abcnews.go.com",
  "cbc.ca",
  "politico.com",
  "buzzfeed.com",
  "news.com.au",
  "livemint.com",
  "thesun.co.uk",
  "news.sky.com",
  "thehill.com",
  "aljazeera.com",
  "drudgereport.com",
  "bloomberg.com",
  "rediff.com",
  "rt.com"
];

// Text that indicates cookie/privacy context
const COOKIE_CONTEXT_KEYWORDS = [
  "cookie",
  "cookies",
  "consent",
  "gdpr",
  "privacy",
  "tracking",
  "advertising cookies",
  "manage privacy",
  "privacy preferences"
];

// Text that indicates this is NOT a cookie banner (captcha / robot checks)
const AVOID_CONTEXT_KEYWORDS = [
  "not a robot",
  "are you a robot",
  "robot check",
  "captcha",
  "security check",
  "verify you are human",
  "verify you're human",
  "checking your browser",
  "ddos-protection",
  "cloudflare"
];

// Strong "accept all" style phrases
const ACCEPT_KEYWORDS_STRONG = [
  "accept all",
  "accept all cookies",
  "agree and continue",
  "i agree",
  "yes, i agree",
  "allow all",
  "i accept",
  "yes, i accept"
];

// Generic accept-ish words (can appear with other text)
const ACCEPT_KEYWORDS_GENERIC = [
  "accept",
  "i accept",
  "consent",
  "i consent",
  "agree",
  "allow",
  "ok",
  "okay",
  "got it",
  "understood",
  "yes",
  "continue"
];

// Things we do NOT want to click on buttons
const NEGATIVE_BUTTON_KEYWORDS = [
  "manage",
  "preferences",
  "settings",
  "customize",
  "learn more",
  "more info",
  "details",
  "reject",
  "decline",
  "only necessary",
  "necessary cookies",
  "policy",
  "cookie policy",
  "privacy policy",
  // avoid social / external actions
  "facebook",
  "instagram",
  "twitter",
  "x.com",
  "linkedin",
  "youtube",
  "follow us",
  "social media"
];

// ---------- UTILS ----------

function normalizeText(text) {
  return (text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function containsAny(text, keywords) {
  const t = normalizeText(text);
  return keywords.some((kw) => t.includes(kw));
}

function isElementVisible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (
    style.visibility === "hidden" ||
    style.display === "none" ||
    style.opacity === "0"
  ) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isPriorityDomain() {
  const host = window.location.hostname;
  return PRIORITY_DOMAINS.some(
    (d) => host === d || host.endsWith("." + d)
  );
}

// ignore obvious external / social / policy links
function isBadTarget(el, text) {
  const t = normalizeText(text);
  if (containsAny(t, ["facebook", "instagram", "twitter", "x.com", "linkedin", "youtube"])) {
    return true;
  }

  const tag = (el.tagName || "").toUpperCase();
  const href = (el.getAttribute && el.getAttribute("href")) || "";
  const lowerHref = (href || "").toLowerCase();

  // basic social + mail/tel block
  if (href) {
    if (
      lowerHref.startsWith("mailto:") ||
      lowerHref.startsWith("tel:") ||
      lowerHref.startsWith("sms:")
    ) {
      return true;
    }
    if (
      lowerHref.includes("facebook.com") ||
      lowerHref.includes("instagram.com") ||
      lowerHref.includes("twitter.com") ||
      lowerHref.includes("x.com") ||
      lowerHref.includes("linkedin.com") ||
      lowerHref.includes("youtube.com")
    ) {
      return true;
    }
    // avoid links that clearly go to policies / cookie info
    if (
      lowerHref.includes("privacy") ||
      lowerHref.includes("cookie-policy") ||
      lowerHref.includes("cookies-policy") ||
      lowerHref.includes("/cookies") ||
      lowerHref.includes("cookie_settings") ||
      lowerHref.includes("cookiepreferences") ||
      lowerHref.includes("cookie-preferences") ||
      (lowerHref.includes("consent") && lowerHref.includes("policy")) ||
      lowerHref.includes("/policy")
    ) {
      return true;
    }
  }

  // Extra strictness for <a> links:
  // - allow only "button-like" anchors: href empty/#/javascript:
  if (tag === "A") {
    if (!href) return false;
    const trimmed = href.trim();
    const lower = trimmed.toLowerCase();

    if (
      lower === "#" ||
      lower === "" ||
      lower.startsWith("javascript:")
    ) {
      // looks like a JS button, not navigation
      return false;
    }

    // any real navigation link (even same-host) is considered "bad" for Accept
    return true;
  }

  return false;
}

// ---------- PER-DOMAIN STATE ----------

function getDomainKey() {
  return "__IDGAC_ACCEPTED__" + window.location.hostname;
}

function getStoredAcceptCount() {
  try {
    const raw = localStorage.getItem(getDomainKey());
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.count === "number") {
      return parsed.count;
    }
  } catch (e) {
    // ignore
  }
  return 0;
}

function setStoredAcceptCount(count) {
  try {
    localStorage.setItem(
      getDomainKey(),
      JSON.stringify({ count: count, ts: Date.now() })
    );
  } catch (e) {
    // ignore
  }
}

function hasDomainBeenHandled() {
  const stored = getStoredAcceptCount();
  const inPage = window.__IDGAC_CLICK_COUNT || 0;
  return stored + inPage >= MAX_TOTAL_ACCEPTS_PER_DOMAIN;
}

function markDomainHandled() {
  const currentInPage = window.__IDGAC_CLICK_COUNT || 0;
  window.__IDGAC_CLICK_COUNT = currentInPage + 1;

  const stored = getStoredAcceptCount();
  const newTotal = Math.min(
    MAX_TOTAL_ACCEPTS_PER_DOMAIN,
    stored + 1
  );
  setStoredAcceptCount(newTotal);
}

// ---------- CLICKABLE ELEMENT DISCOVERY ----------

function getAllClickables() {
  const selectors = [
    "button",
    "a",
    "[role='button']",
    "input[type='button']",
    "input[type='submit']"
  ];

  const result = [];

  selectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      if (!isElementVisible(el)) return;

      const rawText = el.innerText || el.value || "";
      const text = normalizeText(rawText);
      if (!text) return;

      result.push({ el, text });
    });
  });

  return result;
}

// ---------- COOKIE BANNER CONTAINERS ----------

function getCookieContainers() {
  const containers = [];
  const seen = new Set();

  const candidates = document.querySelectorAll(
    "div, section, aside, dialog, form"
  );

  const viewportWidth =
    window.innerWidth || document.documentElement.clientWidth || 1024;
  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight || 768;

  for (const el of candidates) {
    if (!isElementVisible(el)) continue;

    const rect = el.getBoundingClientRect();
    const area = rect.width * rect.height;

    // Skip very small elements (allow slimmer bars like BBC bottom banner)
    if (rect.width < 200 || rect.height < 50) continue;
    // Skip huge "whole page" containers
    if (area > viewportWidth * viewportHeight * 0.9) continue;

    // Check id/class hints
    const idClass = normalizeText((el.id || "") + " " + (el.className || ""));
    const hasCookieIdClass = containsAny(idClass, [
      "cookie",
      "consent",
      "gdpr",
      "privacy"
    ]);

    // Check text context
    const ctxText = normalizeText(el.innerText || "");
    const mentionsCookies = containsAny(ctxText, COOKIE_CONTEXT_KEYWORDS);
    const looksLikeRobot = containsAny(ctxText, AVOID_CONTEXT_KEYWORDS);

    // Must look like cookies/consent, and must NOT look like a robot / captcha page
    if (!hasCookieIdClass && (!mentionsCookies || looksLikeRobot)) continue;

    const key = el.tagName + "#" + (el.id || "") + "." + (el.className || "");
    if (seen.has(key)) continue;
    seen.add(key);

    // Heuristic score: bigger + overlay / bar-like
    const centerY = rect.top + rect.height / 2;
    const distanceFromCenter = Math.abs(centerY - viewportHeight / 2);
    const distanceFromBottom = Math.abs(
      (rect.top + rect.bottom) / 2 - viewportHeight * 0.9
    );

    const overlayScore = area - distanceFromCenter * 50;
    const barScore = area - distanceFromBottom * 50;

    const score = Math.max(overlayScore, barScore);

    containers.push({ el, score, area });
  }

  containers.sort((a, b) => b.score - a.score);

  return containers.map((c) => c.el);
}

// ---------- BUTTONS INSIDE A CONTAINER ----------

function getButtonsWithin(root) {
  const selectors = [
    "button",
    "a",
    "[role='button']",
    "input[type='button']",
    "input[type='submit']"
  ];

  const result = [];

  selectors.forEach((sel) => {
    root.querySelectorAll(sel).forEach((el) => {
      if (!isElementVisible(el)) return;

      const rawText = el.innerText || el.value || "";
      const text = normalizeText(rawText);
      if (!text) return;

      result.push({ el, text });
    });
  });

  return result;
}

function findAcceptButtonInContainer(container) {
  const clickables = getButtonsWithin(container);
  if (!clickables.length) return null;

  const candidates = [];

  for (const { el, text } of clickables) {
    if (containsAny(text, NEGATIVE_BUTTON_KEYWORDS)) continue;
    if (isBadTarget(el, text)) continue;

    let strength = 0;

    if (containsAny(text, ACCEPT_KEYWORDS_STRONG)) {
      strength = 3;
    } else if (containsAny(text, ACCEPT_KEYWORDS_GENERIC)) {
      if (text.length > 30) continue;
      if (
        (text.includes("read") && text.includes("more")) ||
        text.includes("article") ||
        text.includes("section") ||
        text.includes("home") ||
        text.includes("subscribe") ||
        text.includes("sign in") ||
        text.includes("log in")
      ) {
        continue;
      }
      strength = 2;
    }

    if (strength === 0) continue;

    const rect = el.getBoundingClientRect();
    const area = rect.width * rect.height;
    const tag = (el.tagName || "").toUpperCase();

    // Prefer real buttons/inputs over anchors
    const typeBonus =
      tag === "BUTTON" || tag === "INPUT" ? 2 :
      el.getAttribute("role") === "button" ? 1 : 0;

    candidates.push({ el, strength, area, typeBonus });
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    if (b.strength !== a.strength) return b.strength - a.strength;
    if (b.typeBonus !== a.typeBonus) return b.typeBonus - a.typeBonus;
    return b.area - a.area;
  });

  return candidates[0].el;
}

// ---------- SITE-SPECIFIC HELPERS (ONLY IF GENERIC FAILS) ----------

function findSiteSpecificButton(containers) {
  const host = window.location.hostname;
  const specialDomains = [
    "dailymail.co.uk",
    "news18.com",
    "forbes.com"
  ];

  const isSpecial = specialDomains.some(
    (d) => host === d || host.endsWith("." + d)
  );
  if (!isSpecial) return null;

  // Only look INSIDE cookie containers, and only for strong/explicit phrases
  const targetPhrases = [
    "i accept",
    "accept all",
    "accept",
    "i consent",
    "consent"
  ];

  let best = null;

  for (const container of containers) {
    const clickables = getButtonsWithin(container);

    for (const { el, text } of clickables) {
      if (!containsAny(text, targetPhrases)) continue;
      if (containsAny(text, NEGATIVE_BUTTON_KEYWORDS)) continue;
      if (isBadTarget(el, text)) continue;

      const rect = el.getBoundingClientRect();
      const area = rect.width * rect.height;
      const tag = (el.tagName || "").toUpperCase();
      const typeBonus =
        tag === "BUTTON" || tag === "INPUT" ? 2 :
        el.getAttribute("role") === "button" ? 1 : 0;

      const score = area + typeBonus * 1000;

      if (!best || score > best.score) {
        best = { el, score };
      }
    }
  }

  return best ? best.el : null;
}

// ---------- PRIORITY FALLBACK FOR BOTTOM/TOP BARS ----------

function findPriorityFallbackButton() {
  if (!isPriorityDomain()) return null;

  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight || 768;
  const bodyText = normalizeText(
    (document.body && document.body.innerText) || ""
  );

  if (!containsAny(bodyText, COOKIE_CONTEXT_KEYWORDS)) return null;
  if (containsAny(bodyText, AVOID_CONTEXT_KEYWORDS)) return null;

  const selectors = [
    "button",
    "a",
    "[role='button']",
    "input[type='button']",
    "input[type='submit']"
  ];

  const candidates = [];

  selectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => {
      if (!isElementVisible(el)) return;

      const rawText = el.innerText || el.value || "";
      const text = normalizeText(rawText);
      if (!text) return;

      if (containsAny(text, NEGATIVE_BUTTON_KEYWORDS)) return;
      if (isBadTarget(el, text)) return;

      // For fallback we only trust things that explicitly say "accept" / "agree" / "consent"
      if (
        !(
          text.includes("accept") ||
          text.includes("agree") ||
          text.includes("consent")
        )
      ) {
        return;
      }

      if (text.length > 25) return;

      const rect = el.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;

      const inTopBand = centerY < viewportHeight * 0.3;
      const inBottomBand = centerY > viewportHeight * 0.7;
      if (!inTopBand && !inBottomBand) return;

      const tag = (el.tagName || "").toUpperCase();
      const typeBonus =
        tag === "BUTTON" || tag === "INPUT" ? 2 :
        el.getAttribute("role") === "button" ? 1 : 0;

      candidates.push({
        el,
        centerY,
        area: rect.width * rect.height,
        typeBonus
      });
    });
  });

  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    const bottomThreshold = viewportHeight * 0.5;
    const aIsBottom = a.centerY > bottomThreshold;
    const bIsBottom = b.centerY > bottomThreshold;
    if (aIsBottom !== bIsBottom) {
      return aIsBottom ? -1 : 1;
    }
    if (b.typeBonus !== a.typeBonus) return b.typeBonus - a.typeBonus;
    return b.area - a.area;
  });

  return candidates[0].el;
}

// ---------- MAIN CLICK HELPER ----------

function tryClickCookieAccept() {
  if (hasDomainBeenHandled()) return false;

  // 1) Container-based detection (covers the majority)
  const containers = getCookieContainers();
  for (const container of containers) {
    const btn = findAcceptButtonInContainer(container);
    if (btn) {
      btn.click();
      markDomainHandled();
      return true;
    }
  }

  // 2) Site-specific tweaks for stubborn domains (Daily Mail, News18, Forbes)
  const siteBtn = findSiteSpecificButton(containers);
  if (siteBtn) {
    siteBtn.click();
    markDomainHandled();
    return true;
  }

  // 3) Priority fallback for big news sites (bottom/top bars)
  const fallbackBtn = findPriorityFallbackButton();
  if (fallbackBtn) {
    fallbackBtn.click();
    markDomainHandled();
    return true;
  }

  return false;
}

// ---------- SCHEDULING & OBSERVER ----------

function scheduleAttempts() {
  const maxAttempts = 10;
  for (let i = 1; i <= maxAttempts; i++) {
    const delay = Math.min(2500, 120 * i * i);
    setTimeout(() => {
      if (hasDomainBeenHandled()) return;
      tryClickCookieAccept();
    }, delay);
  }
}

function startObserver() {
  const target = document.documentElement || document.body;
  if (!target) return;

  const observer = new MutationObserver(() => {
    if (hasDomainBeenHandled()) return;
    tryClickCookieAccept();
  });

  observer.observe(target, {
    childList: true,
    subtree: true
  });
}

function init() {
  if (!chrome || !chrome.storage || !chrome.storage.sync) {
    if (!hasDomainBeenHandled()) {
      scheduleAttempts();
      startObserver();
    }
    return;
  }

  chrome.storage.sync.get({ enabled: true }, (data) => {
    if (!data.enabled) return;
    if (hasDomainBeenHandled()) return;
    scheduleAttempts();
    startObserver();
  });
}

init();