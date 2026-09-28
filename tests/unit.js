// Fast unit tests (no browser): registrable-domain lookup and site rules.

"use strict";

const fs = require("fs");
const path = require("path");
const { registrableDomain } = require("../domain.js");
const { validateRules } = require("../rules.js");

const cases = [
  ["www.bbc.co.uk", "bbc.co.uk"],
  ["news.bbc.co.uk", "bbc.co.uk"],
  ["bbc.co.uk", "bbc.co.uk"],
  ["a.b.example.com", "example.com"],
  ["example.com", "example.com"],
  ["WWW.Example.COM.", "example.com"],
  ["someone.github.io", "someone.github.io"], // private-section suffix
  ["github.io", "github.io"],                 // a public suffix itself
  ["co.uk", "co.uk"],
  ["www.city.kawasaki.jp", "city.kawasaki.jp"], // exception rule
  ["a.b.kawasaki.jp", "a.b.kawasaki.jp"],       // wildcard rule *.kawasaki.jp
  ["x.y.a.b.kawasaki.jp", "a.b.kawasaki.jp"],
  ["shop.example.com.br", "example.com.br"],
  ["xn--80ak6aa92e.com", "xn--80ak6aa92e.com"],
  ["www.xn--80ak6aa92e.xn--p1ai", "xn--80ak6aa92e.xn--p1ai"], // punycode TLD (.рф)
  ["127.0.0.1", "127.0.0.1"],
  ["localhost", "localhost"],
  ["unknown-tld.zzzz", "unknown-tld.zzzz"],
];

let failed = 0;
for (const [host, want] of cases) {
  const got = registrableDomain(host);
  if (got !== want) {
    failed++;
    console.log(`  ✗ registrableDomain(${host}) = ${got}, expected ${want}`);
  }
}
// Site rules: the shipped file must be fully valid
const shipped = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "rules", "sites.json"), "utf8"));
const shippedResult = validateRules(shipped);
let checks = cases.length + 2;
if (shippedResult.errors.length) {
  failed++;
  console.log(`  \u2717 rules/sites.json has errors:\n    ${shippedResult.errors.join("\n    ")}`);
}
// …and the validator must reject bad rules
const bad = validateRules({ sites: [
  { domains: ["ok.com"], reason: "fine" },
  { domains: ["www.x.com"], reason: "www" },
  { domains: ["https://y.com"], reason: "scheme" },
  { domains: ["z.com"] },
  { domains: ["w.com"], reason: "r", mode: "aggressive" },
  { domains: ["v.com"], reason: "r", accept: "#not-a-list" },
  { domains: ["ok.com"], reason: "duplicate" },
] });
if (bad.valid.length !== 1 || bad.errors.length !== 6) {
  failed++;
  console.log(`  \u2717 validator accepted ${bad.valid.length} rule(s) / reported ${bad.errors.length} error(s), expected 1 / 6`);
}

// Crawl classification, using real cases from the first nightly runs
const { classify, isReviewed, loadReviewed } = require("../scripts/crawl.js");
const page = (url, banner) => ({ ok: true, finalUrl: url, banner: { present: banner, items: [] } });
const act = (strategy, label = "") => ({ event: "action", strategy, label });
const crawlCases = [
  // lidl.de: OneTrust API used, control detector saw nothing -> detector gap
  ["lidl API, no control banner", page("https://www.lidl.de/", false), page("https://www.lidl.de/", false),
    [act("CMP API onetrust")], "accepted-unconfirmed"],
  // bbc.co.uk: Sourcepoint's own button inside its iframe
  ["bbc CMP selector", page("https://www.bbc.co.uk/", false), page("https://www.bbc.co.uk/", false),
    [act("CMP selector .sp_choice_type_11", "accept and continue")], "accepted-unconfirmed"],
  // derstandard.at: consent wall redirects back within the same site
  ["derstandard same-site redirect", page("https://www.derstandard.at/consent/tcf/", true),
    page("https://www.derstandard.at/", false), [act("CMP selector .sp_choice_type_11", "einverstanden")], "accepted"],
  // a heuristic click where nobody saw a banner stays suspicious
  ["heuristic click, no banner", page("https://wp.pl/", false), page("https://wp.pl/", false),
    [act("container", "akceptuję i przechodzę do serwisu")], "suspicious"],
  // leaving the site after any action is suspicious
  ["cross-site navigation", page("https://a.example/", true), page("https://shop.other.example/", false),
    [act("CMP selector #x", "accept")], "suspicious"],
  ["missed", page("https://x.example/", true), page("https://x.example/", true), [], "missed"],
  ["no banner", page("https://x.example/", false), page("https://x.example/", false), [], "no-banner"],
];
for (const [name, control, withExt, activity, want] of crawlCases) {
  checks++;
  const got = classify(control, withExt, activity);
  if (got !== want) {
    failed++;
    console.log(`  \u2717 crawl classify (${name}) = ${got}, expected ${want}`);
  }
}
const reviewed = loadReviewed();
const reviewedCases = [
  ["wp.pl reviewed action", "https://www.wp.pl/", [act("container", "akceptuję i przechodzę do serwisu")], true],
  ["wp.pl different action", "https://www.wp.pl/", [act("container", "ok")], false],
  ["other site, same action", "https://onet.pl/", [act("container", "akceptuję i przechodzę do serwisu")], false],
];
for (const [name, url, activity, want] of reviewedCases) {
  checks++;
  if (isReviewed(url, activity, reviewed) !== want) {
    failed++;
    console.log(`  \u2717 crawl isReviewed (${name}) should be ${want}`);
  }
}

console.log(`unit: ${checks - failed}/${checks} passed`);
if (failed) process.exit(1);
