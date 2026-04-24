# Tenant Triage NYC

Free, independent step-by-step guides for New York City renters dealing with housing problems — from no heat to mold to eviction notices.

**Live site:** [tenanttriage.nyc](https://tenanttriage.nyc)

---

## What this is

Tenant Triage NYC is a single-purpose public-interest site. The goal is to give NYC renters clear, actionable guidance for the most common housing problems — what to do, who to call, what to say, and what to document — in a format that's easier to use than government portals and more structured than a search-engine rabbit hole.

Every guide follows the same action-oriented arc: document the problem, notify the landlord in writing, file a 311/HPD complaint (or, for eviction cases, get a lawyer through NYC's Right to Counsel), and escalate if needed. Scenarios include severity pickers that tailor the content to the tenant's specific situation, prefilled message templates and phone scripts, and callouts for the situations where standard advice doesn't apply (undocumented tenants, retaliation risk, rent-regulated status, asthma-related health pathways, etc.).

### What makes this different from existing resources

NYC has strong tenant protections. The problem isn't a lack of rights — it's that tenants don't know how to exercise them. Existing resources tend to be either informational without being actionable (Met Council's fact sheets, HPD's website) or tool-focused without providing context (JustFix's letter-sending tool). Tenant Triage NYC bridges the gap: it gives tenants both the legal context *and* the ready-made artifacts (emails, phone scripts, reference numbers, violation lookups) to act on it.

The site is also designed to be defensible in a post-LLM world. An LLM can summarize tenant rights, but it can't look up a specific building's current HPD violations, generate a fillable complaint letter that auto-populates across the page, or provide verified phone numbers for free legal services. The format — a web guide, not a chatbot — means it's findable by non-LLM-users, shareable as a URL, and citable by tenant organizations and legal aid providers.

---

## Live HPD violation lookup

Each repair scenario includes an inline address lookup tool that lets tenants see their building's real violation history without leaving the page. The tool chains two free, public NYC APIs:

1. **[NYC Planning Labs GeoSearch](https://geosearch.planninglabs.nyc/)** — a Pelias-based geocoder that provides address autocomplete against the city's authoritative Property Address Directory (PAD). Returns a BBL (Borough-Block-Lot) identifier for each building.

2. **[NYC Open Data — Housing Maintenance Code Violations](https://data.cityofnewyork.us/Housing-Development/Housing-Maintenance-Code-Violations/wvxf-dwi5)** (Socrata SODA API) — the same dataset that powers HPDOnline, queryable by BBL. Returns violation records with class, status, inspection date, and description.

The lookup runs entirely in the browser. No backend, no server, no authentication required. An optional Socrata app token (free from [NYC Open Data](https://data.cityofnewyork.us/)) raises the rate limit for production traffic.

### Data processing pipeline

The raw HPD data is designed for city inspectors, not tenants. The lookup tool includes several processing layers to make the data readable:

- **Status translation.** HPD statuses like `NOV SENT OUT` and `FIRST NO ACCESS TO RE-INSPECT VIOLATION` are mapped to plain English ("Notice sent to landlord", "HPD inspector could not access apartment") and classified as open, closed, or dismissed for color-coded state pills. Unknown statuses fall back to sentence-cased display and log a `console.warn` for future mapping.

- **Verb-anchored description parsing.** HPD violation descriptions begin with a legal citation chain of variable length and format, followed by an imperative verb and the actual description of what needs fixing. The parser scans for the first known HPD action verb (~55 verbs: repair, provide, abate, install, etc.) and treats everything from that verb onward as the description. A fallback heuristic catches unknown verbs by looking for the first pure-letter, non-citation word after citation material (numbers, §, code references). If both passes fail, the full text is shown sentence-cased — the failure mode is "show too much," never "show too little."

- **Sentence case conversion.** All HPD text is stored in ALL CAPS. A `toSentenceCase()` utility lowercases everything and then re-uppercases ~30 known acronyms (HPD, NYC, DEC, DHCR, NYCHA, IPM, etc.) and apartment designators (Apt 4B, Floor 3).

- **Location splitting.** Apartment orientation text ("located at Apt 4K, 5th story, 3rd apartment from north at east") is split into a secondary line below the main description to reduce visual noise while preserving the information.

- **Progressive loading.** The first 10 violations display immediately. A "Show 20 more" button expands inline, with a permanent fallback link to HPDOnline.

### Adding new status values

HPD occasionally introduces new status strings. When an unknown status appears, the lookup logs it to `console.warn` and the debug panel. To add a new status:

1. Open `lookup.js` (or the `<script>` block in `lookup-test.html`)
2. Find the `STATUS_MAP` object
3. Add the new status string as a key, with a `{ label: '...', state: 'open'|'closed'|'dismissed' }` value
4. Commit and deploy

A quarterly audit of distinct `currentstatus` values in the Socrata dataset is recommended post-launch. This could be automated with a GitHub Action that queries the API and opens an issue when new values appear. See the `TODO` comment above `STATUS_MAP` in the code.

---

## How it's built

Plain static HTML/CSS/JS — no framework, no build step, no server-side logic. Each page is self-contained: its styles are in an inline `<style>` block and its JS is at the bottom of the document. The only shared assets are `lookup.js` and `lookup.css` (the HPD address-lookup component) and a single CNAME file for the custom domain.

Deployed via GitHub Pages from the `main` branch. HTTPS is enforced. Nothing to configure to ship beyond merging to `main`.

### Running locally

```bash
cd tenant-triage-nyc
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000). Edits to HTML/CSS/JS show up on refresh — no hot reload, no build.

The `file://` protocol will not work for the address lookup tool because browsers block cross-origin fetch requests from `file://` URLs. You must use a local HTTP server.

### Project structure

```
/
├── index.html                  # Homepage: search, scenario list, hero
├── about.html                  # About / mission
├── free-help.html              # Directory of free NYC tenant legal services
├── walkthrough.html            # Room-by-room apartment inspection tool
├── lookup.js                   # Shared HPD address-lookup component
├── lookup.css                  # Styles for the lookup component
├── lookup-test.html            # Dev page for testing the lookup in isolation
├── sidebar.js                  # Scroll-spy + sticky TOC sidebar
├── sidebar.css                 # Styles for the sidebar component
├── print.css                   # Shared print stylesheet (letter-first)
├── review.js                   # Site-wide ?review mode for content verification
├── og-image-template.html      # Template for generating the OG share image
├── scenarios/
│   ├── appliances.html
│   ├── eviction-notice.html
│   ├── heat-hot-water.html
│   ├── lead-paint.html
│   ├── leaks-plumbing.html
│   ├── lease-non-renewal.html
│   ├── mold.html
│   ├── pests.html
│   └── retaliation.html
├── CNAME                       # Custom domain for GitHub Pages
└── robots.txt
```

---

## Design system

### Typography

**Public Sans** throughout. The site uses a single typeface at multiple weights to establish hierarchy without visual noise.

- H1: weight 900, letter-spacing -0.035em, `clamp(2.25rem, 5.5vw, 3.25rem)`
- Body: 18px / 1.65 line-height
- Step titles: weight 800, 1.625rem
- Labels and meta: weight 700–800, uppercase, tracked

### Color tokens

```
--bg: #ffffff                    White (intentional — not cream)
--bg-soft: #f5f3ef               Warm light gray (read-first boxes, pickers)
--ink: #111111                   Near-black body text
--ink-soft: #3d3d3d              Secondary text
--ink-faded: #6b6b6b             Tertiary text, dates, meta

--accent: #0d7377                Teal (links, active states, wordmark accent)
--accent-deep: #08494c           Dark teal (link text, hover)
--accent-soft: #e3f0f0           Light teal (backgrounds, hover fills)
--accent-bright: #5eb6b9         Lighter teal (for use ON dark backgrounds)

--protect: #2a4a7f               Cool blue ("you are protected" callouts)
--protect-soft: #eaeff7          Light blue (protect callout background)

--warning-ink: #7a3a0a           Warm amber text (warning callouts)
--warning-bg: #fff4e6             Light amber (warning callout background)
--warning-rule: #e8a35a          Amber border
```

**Critical design rule:** The accent color (teal) must live in a different semantic family from the warning color (amber). Warm-toned accents (coral, orange, chartreuse) were tested and rejected because they conflated with the warning callout system. Do not change the accent to a warm color.

### Component vocabulary

Each scenario page assembles from a shared set of components:

1. **Site header** — wordmark "Tenant Triage NYC" + 2px ink border-bottom
2. **Breadcrumbs** — `/` separators, current page bolded
3. **Reading label** — small teal pill below breadcrumbs ("Pest infestation guide")
4. **H1 + standfirst + meta bar** — reading time, last-verified date, print link
5. **"Read this first" box** — warm gray background, ink-black left border
6. **Rights box** — near-black background, white text, optional severity/class table
7. **Severity/type picker** — adaptive context picker (radiogroup buttons). For mold = severity classes; for pests = pest type; for eviction = process stage. Always includes a "show me everything" default.
8. **HPD address lookup** — inline address autocomplete + violation results (see above)
9. **Steps** — numbered, each with time chip, H3 title, "why this matters" italic lede, ordered instructions, templates or scripts, "what to expect"
10. **Email template** — code-style block with copy button, fillable `<input class="fill">` fields that auto-sync via `data-field` attributes
11. **Spoken script** — blockquote-style with larger fillable inputs, "say it in your own words" framing
12. **Reference number capture** — input in Step 3 that recalls in Step 4 via shared `data-field`
13. **Callouts** — `.callout-protect` (blue, rights/protections), `.callout-warning` (amber, risks/traps)
14. **Help list** — phone numbers in accent-deep, descriptions below
15. **Related scenarios grid** — teal hover state
16. **Sources footer** — primary sources preferred, verification date, error-reporting link
17. **Disclaimer** — "This isn't legal advice" with org referrals

### Verify tags

Inline legal claims that haven't been independently confirmed are marked with `<span class="verify-tag">Verify</span>`. The tag renders as a visible red flag (white text on `#c8292e` background, flag glyph prefix). These tags are visible to users on the live site — they signal that a specific claim should be independently verified before being relied upon. The goal is transparency: rather than quietly publishing unconfirmed legal guidance, the site tells users exactly which claims still need expert review.

```css
.verify-tag {
  background: #c8292e; color: #fff;
  font-size: 0.7rem; font-weight: 800;
  letter-spacing: 0.05em; text-transform: uppercase;
  padding: 0.15rem 0.5rem;
}
.verify-tag::before { content: "⚑ "; }
```

---

## Scenario page pattern

All scenario pages share the same structural template. To add a new scenario, fork the closest existing page and adapt the content rather than starting from scratch.

The shared structure is documented in the component vocabulary above. Two structural notes:

- **Eviction is different.** Its severity picker represents stages of the eviction process rather than types of a problem, and its "steps" are centered on legal procedure (getting a lawyer through Right to Counsel, showing up to court, filing an Order to Show Cause) rather than HPD enforcement.

- **The 5-step skeleton holds across all repair scenarios.** Document → notify landlord → 311 complaint → check status → escalate. About 60% of the content is shared; 40% is scenario-specific (which violations apply, what IPM or remediation requirements exist, scenario-specific callouts).

---

## Content guardrails

Everything on this site gives legal-adjacent guidance. Two conventions exist to protect accuracy:

1. **Verify tags.** Inline legal claims that haven't been independently confirmed are marked with a visible red tag. These are visible to users on the live site as a transparency measure — they tell users which specific claims still need expert confirmation and should be independently checked before being relied upon.

2. **Disclaimer.** Every scenario page closes with a "This isn't legal advice" disclaimer pointing tenants to free legal organizations listed on the page.

### Sources

Sources are cited at the bottom of each scenario page in a `<div class="sources">`. Prefer primary sources (NYC Housing Maintenance Code, Local Laws, Rent Stabilization Code) over summaries from advocacy organizations, except where advocacy-org guidance is the most actionable for a tenant (e.g., Met Council's "Getting Repairs" page).

### Equity callouts

Every repair scenario includes:

- **Undocumented tenants callout** (protect, flagged DRAFT) — NYC agencies don't ask immigration status; free confidential legal resources listed (ActionNYC via 311, Make the Road NY, NY Immigration Coalition, NYC Commission on Human Rights). Pending review by immigration advocacy organization before removing DRAFT flag.
- **Retaliation callout** (warning) — always includes market-tenant note: tenants who are not rent-stabilized or rent-controlled have fewer protections against non-renewal and should consult Met Council before filing. This applies to every repair scenario.
- **Asthma callout** (protect) — rewritten per scenario to explain the specific connection (cockroach/mouse allergens for pests, mold spores for mold). Points to NYC Health Dept's Healthy Neighborhoods Program for free in-home environmental inspections via doctor referral or 311.

---

## Writing style

- Second person, addressed to the tenant in their current situation
- Action-oriented: what to do, in what order, with what evidence
- Honest about what the law actually protects vs. what enforcement looks like in practice
- Callouts for groups the default advice doesn't fully serve (undocumented tenants, market-rate tenants, tenants with elevated risk factors like asthma or young children)
- No legalese if a plain-English equivalent exists; legalese in parentheses when the term of art matters for navigating the system
- "An honest note" framing when the guidance needs to acknowledge limits or uncertainty

---

## Scope

This site covers private-market NYC rental housing. NYCHA tenants and Section 8 voucher holders have additional layers of protection and process that aren't fully covered yet — scenarios that apply to those tenants include notes but don't replace NYCHA-specific guidance.

---

## Verified facts

Key legal facts referenced across scenarios (verified April 2026):

- **Heat season:** Oct 1 – May 31. Day (6am–10pm) ≥68°F if outside <55°F. Night (10pm–6am) ≥62°F. Hot water 365 days/yr, 120°F minimum.
- **Mold/pests (Local Law 55 of 2018):** Class A <10 sq ft → 90 days. Class B 10–29 sq ft → 30 days. Class C 30+ sq ft → 21 days. IPM required; NYS DEC-licensed pest professional required for pesticide application.
- **Pests:** Mice/rats/roaches = Class C (21 days). Bedbugs = Class B (30 days).
- **Bedbugs (Local Law 69 of 2017):** Annual bedbug history report required; landlords must disclose to tenants; reports publicly available on HPDOnline.
- **Met Council hotline:** 212-979-0611, Mon & Wed 1:30–8 PM, Fri 1:30–5 PM.
- **Anti-retaliation:** NY Real Property Law §223-b. Applies to good-faith complaints about housing conditions.

---

## Contributing

Contributions, corrections, and scenario requests are welcome via [GitHub Issues](../../issues).

If you're a tenant lawyer, housing advocate, or immigration legal services provider and want to review the legal content or the equity callouts, please open an issue or reach out directly. The verify tags exist specifically to flag content that needs expert eyes before launch.

---

## Disclaimer

Tenant Triage NYC is an independent public-interest guide. It is not legal advice, not an official government resource, and not a substitute for a lawyer. If you need legal advice for your specific situation, contact one of the free legal help organizations linked from each scenario page.

---

## License

[MIT](LICENSE) 

---

## Credits

Made by [Holly Gibbs](https://github.com/hollygibbs).
