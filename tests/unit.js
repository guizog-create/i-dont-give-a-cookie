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

console.log(`unit: ${checks - failed}/${checks} passed`);
if (failed) process.exit(1);
