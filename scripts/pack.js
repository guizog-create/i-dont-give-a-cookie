// Builds dist/i-dont-give-a-cookie-<version>.zip containing only the files
// the extension needs (no tests, no node_modules). Requires the `zip` CLI.

"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const { version } = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const files = [
  "manifest.json", "background.js", "cmp-api.js", "content.js", "popup.html", "popup.js",
  "domain.js", "psl-rules.js",
  "icons/icon16.png", "icons/icon48.png", "icons/icon128.png",
];

fs.mkdirSync(path.join(root, "dist"), { recursive: true });
const out = path.join("dist", `i-dont-give-a-cookie-${version}.zip`);
fs.rmSync(path.join(root, out), { force: true });
execFileSync("zip", ["-X", out, ...files], { cwd: root, stdio: "inherit" });
console.log(`Wrote ${out}`);
