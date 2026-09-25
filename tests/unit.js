// Fast unit tests (no browser): registrable-domain lookup.

"use strict";

const { registrableDomain } = require("../domain.js");

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
console.log(`unit: ${cases.length - failed}/${cases.length} passed`);
if (failed) process.exit(1);
