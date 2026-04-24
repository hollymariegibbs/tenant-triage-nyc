# Security Policy

## Scope

Tenant Triage NYC is a static site (HTML, CSS, JS) hosted on GitHub Pages
with no backend, no authentication, and no user data storage. The site makes
client-side API calls to two public NYC data services:

- **NYC Planning Labs GeoSearch** — address autocomplete
- **NYC Open Data (Socrata)** — HPD violation lookups

No user input is stored, transmitted to a server, or persisted between sessions.

## Supported Versions

There are no versioned releases. The `main` branch is deployed directly to
[tenanttriage.nyc](https://tenanttriage.nyc) via GitHub Pages. The live site
is always the current and only supported version.

## Reporting a Vulnerability

If you find a security issue, please report it privately by emailing
**security@tenanttriage.nyc**. Do not open a public GitHub issue for
security vulnerabilities.

Please include:

- A description of the issue and where it occurs
- Steps to reproduce, if applicable
- Any potential impact you've identified

I'll acknowledge your report within 72 hours and follow up with next steps.
If the issue is confirmed, I'll push a fix as quickly as possible and credit
you in the commit message (unless you prefer to remain anonymous).

## Known Attack Surface

Given the static architecture, the realistic security concerns are:

- **XSS via API responses** — user-supplied addresses are sent to NYC
  GeoSearch, and the returned data is rendered in the DOM. Input and
  output are sanitized, but if you find a bypass, that's a valid report.
- **Dependency-free JS** — the site uses no frameworks or npm packages,
  which limits supply chain risk but means all sanitization is hand-rolled.
- **Third-party API availability** — GeoSearch and Socrata are public city
  services outside our control. Outages or changes to their APIs could
  affect the lookup tool but are not security vulnerabilities in this project.

## Out of Scope

- Content accuracy (legal information, phone numbers, etc.) — report these
  as regular GitHub issues, not security reports.
- Vulnerabilities in NYC GeoSearch or NYC Open Data APIs — report those to
  the City of New York directly.
- Issues that require physical access to a user's device.
