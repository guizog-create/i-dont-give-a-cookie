// I Don't Give a Cookie - page-world bridge to CMP JavaScript APIs
//
// Runs in the page's own JavaScript world ("world": "MAIN"), where CMP
// globals such as window.OneTrust are visible (the isolated content script
// cannot see them). It never acts on its own: content.js sends a request
// only when that CMP's banner is visibly on screen and the site is allowed,
// and verifies the result afterwards (falling back to clicking).

(() => {
  "use strict";

  const REQUEST = "idgac:cmp-api-request";
  const RESPONSE = "idgac:cmp-api-response";

  // Captured at document_start, before page scripts can tamper with them
  const parse = JSON.parse;
  const stringify = JSON.stringify;
  const dispatch = EventTarget.prototype.dispatchEvent;
  const listen = EventTarget.prototype.addEventListener;
  const Custom = CustomEvent;

  const isFn = (f) => typeof f === "function";

  // Each handler returns true when it found and invoked the CMP's own
  // "accept all" API. Only documented public APIs are used.
  const HANDLERS = {
    onetrust() {
      const ot = window.OneTrust;
      if (!ot || !isFn(ot.AllowAll)) return false;
      ot.AllowAll();
      return true;
    },
    cookiebot() {
      const cb = window.Cookiebot;
      if (!cb || !isFn(cb.submitCustomConsent)) return false;
      cb.submitCustomConsent(true, true, true); // preferences, statistics, marketing
      if (isFn(cb.hide)) cb.hide();
      return true;
    },
    didomi() {
      const d = window.Didomi;
      if (!d || !isFn(d.setUserAgreeToAll)) return false;
      d.setUserAgreeToAll();
      return true;
    },
    usercentrics() {
      const uc = window.UC_UI;
      if (!uc || !isFn(uc.acceptAllConsents)) return false;
      const done = () => { if (isFn(uc.closeCMP)) uc.closeCMP(); };
      const result = uc.acceptAllConsents();
      if (result && isFn(result.then)) result.then(done, () => {});
      else done();
      return true;
    },
    klaro() {
      const k = window.klaro;
      if (!k || !isFn(k.getManager)) return false;
      const manager = k.getManager();
      if (!manager || !isFn(manager.changeAll) || !isFn(manager.saveAndApplyConsents)) return false;
      manager.changeAll(true);
      manager.saveAndApplyConsents();
      return true;
    },
    consentmanager() {
      if (!isFn(window.__cmp)) return false;
      window.__cmp("setConsent", 1); // 1 = accept all
      return true;
    },
    cookiescript() {
      const cs = window.CookieScript;
      if (!cs || !cs.instance || !isFn(cs.instance.acceptAllAction)) return false;
      cs.instance.acceptAllAction();
      return true;
    },
    tarteaucitron() {
      const t = window.tarteaucitron;
      if (!t || !t.userInterface || !isFn(t.userInterface.respondAll)) return false;
      t.userInterface.respondAll(true);
      return true;
    },
    cookieconsent() {
      const cc = window.CookieConsent; // orestbida/cookieconsent v3
      if (!cc || !isFn(cc.acceptCategory)) return false;
      cc.acceptCategory("all");
      if (isFn(cc.hide)) cc.hide();
      return true;
    },
  };

  listen.call(document, REQUEST, (event) => {
    let request;
    try {
      request = parse(event.detail);
    } catch (e) {
      return;
    }
    if (!request || typeof request.cmp !== "string") return;

    let ok = false;
    try {
      const handler = Object.prototype.hasOwnProperty.call(HANDLERS, request.cmp) && HANDLERS[request.cmp];
      ok = !!(handler && handler());
    } catch (e) {
      ok = false;
    }
    dispatch.call(document, new Custom(RESPONSE, { detail: stringify({ id: request.id, ok }) }));
  });
})();
