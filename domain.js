// Registrable domain ("eTLD+1") lookup using the Public Suffix List, so the
// popup can block "bbc.co.uk" (covering www. and news.) rather than one
// hostname, while "someone.github.io" stays separate from other github.io
// sites. Loaded by the popup only; content.js matches the stored entries
// with a simple suffix check.

"use strict";

(function (root) {
  let index = null;

  function buildIndex() {
    const rules = root.IDGAC_PSL_RULES || (typeof require === "function" ? require("./psl-rules.js") : "");
    index = { exact: new Set(), wildcard: new Set(), exception: new Set() };
    for (const rule of rules.split(" ")) {
      if (rule.startsWith("!")) index.exception.add(rule.slice(1));
      else if (rule.startsWith("*.")) index.wildcard.add(rule.slice(2));
      else if (rule) index.exact.add(rule);
    }
  }

  function isIpAddress(host) {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
  }

  // Number of labels in the public suffix of `labels`
  function publicSuffixLength(labels) {
    let best = 1; // implicit "*" rule: the TLD alone
    for (let i = 0; i < labels.length; i++) {
      const candidate = labels.slice(i).join(".");
      const length = labels.length - i;
      if (index.exception.has(candidate)) return length - 1; // exceptions win
      if (index.exact.has(candidate)) best = Math.max(best, length);
      if (i > 0 && index.wildcard.has(candidate)) best = Math.max(best, length + 1);
    }
    return best;
  }

  function registrableDomain(hostname) {
    const host = String(hostname || "").toLowerCase().replace(/\.$/, "");
    if (!host || isIpAddress(host) || !host.includes(".")) return host;
    if (!index) buildIndex();
    const labels = host.split(".");
    const suffixLength = publicSuffixLength(labels);
    if (suffixLength >= labels.length) return host; // host is itself a public suffix
    return labels.slice(-(suffixLength + 1)).join(".");
  }

  root.IDGAC_registrableDomain = registrableDomain;
  if (typeof module === "object" && module.exports) module.exports = { registrableDomain };
})(typeof globalThis !== "undefined" ? globalThis : this);
