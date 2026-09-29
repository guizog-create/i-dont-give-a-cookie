// I Don't Give a Cookie - CMP "accept all" APIs
//
// Loaded by the background service worker (importScripts). When content.js
// has decided that a CMP's banner is visibly on screen on an allowed site,
// the background runs cmpAcceptAll() in that frame's page world with
// chrome.scripting.executeScript. Nothing is left resident in the page, so
// a site cannot probe for the extension or trigger these calls itself.
//
// The function is serialized and executed in the page: it must stay
// self-contained (no references to anything outside its own body).

"use strict";

function cmpAcceptAll(cmp) {
  const isFn = (f) => typeof f === "function";
  const handlers = {
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
  try {
    return Object.prototype.hasOwnProperty.call(handlers, cmp) ? !!handlers[cmp]() : false;
  } catch (e) {
    return false;
  }
}

const CMP_API_IDS = [
  "onetrust", "cookiebot", "didomi", "usercentrics", "klaro",
  "consentmanager", "cookiescript", "tarteaucitron", "cookieconsent",
];

if (typeof self !== "undefined") {
  self.IDGAC_cmpAcceptAll = cmpAcceptAll;
  self.IDGAC_CMP_API_IDS = CMP_API_IDS;
}
