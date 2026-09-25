# Site rules

`sites.json` holds per-site fixes as data, so fixing a site doesn't need a code change.
The background validates it and hands it to the content script (see `background.js`).

| Field | Required | Meaning |
|---|---|---|
| `domains` | yes | Registrable domains; each also covers its subdomains |
| `reason` | yes | Why the rule exists (shown in the popup, keeps the list auditable) |
| `mode` | no | `default` (normal), `cmp-only` (known CMP selectors and APIs only, no heuristics), `off` (never act) |
| `accept` | no | CSS selectors for this site's accept button, tried before anything else (still must be visible and enabled) |
| `hide` | no | CSS selectors hidden as soon as the page loads. Only for banners that are purely informational: hiding does **not** record consent |

Every change must keep `npm test` green (`tests/unit.js` validates this file).
When you add a rule because of a real site, add a fixture reproducing it in `tests/fixtures/`.
