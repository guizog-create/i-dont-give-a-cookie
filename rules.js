// Site-rule validation, shared by background.js (importScripts) and
// tests/unit.js (require). Invalid rules are dropped with a reason rather
// than breaking the whole file.

"use strict";

(function (root) {
  const MODES = new Set(["default", "cmp-only", "off"]);
  const DOMAIN_RE = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/;

  function stringList(value) {
    return Array.isArray(value) && value.every((v) => typeof v === "string" && v.trim() !== "");
  }

  function validateRule(rule) {
    if (!rule || typeof rule !== "object") return "not an object";
    if (!stringList(rule.domains) || !rule.domains.length) return "domains must be a non-empty string list";
    const badDomain = rule.domains.find((d) => !DOMAIN_RE.test(d));
    if (badDomain) return `invalid domain "${badDomain}" (lowercase, no scheme, no www)`;
    if (rule.domains.some((d) => d.startsWith("www."))) return "domains must not start with www.";
    if (typeof rule.reason !== "string" || !rule.reason.trim()) return "reason is required";
    if (rule.mode !== undefined && !MODES.has(rule.mode)) return `unknown mode "${rule.mode}"`;
    for (const key of ["accept", "hide"]) {
      if (rule[key] !== undefined && !stringList(rule[key])) return `${key} must be a list of CSS selectors`;
    }
    return null;
  }

  function validateRules(data) {
    const valid = [];
    const errors = [];
    const sites = data && Array.isArray(data.sites) ? data.sites : null;
    if (!sites) return { valid, errors: ["top level must be { version, sites: [] }"] };
    const seen = new Set();
    sites.forEach((rule, i) => {
      const error = validateRule(rule);
      if (error) return errors.push(`sites[${i}]: ${error}`);
      const dup = rule.domains.find((d) => seen.has(d));
      if (dup) return errors.push(`sites[${i}]: "${dup}" already has a rule`);
      rule.domains.forEach((d) => seen.add(d));
      valid.push({
        domains: rule.domains,
        mode: rule.mode || "default",
        accept: rule.accept || [],
        hide: rule.hide || [],
        reason: rule.reason,
      });
    });
    return { valid, errors };
  }

  root.IDGAC_validateRules = validateRules;
  if (typeof module === "object" && module.exports) module.exports = { validateRules };
})(typeof globalThis !== "undefined" ? globalThis : this);
