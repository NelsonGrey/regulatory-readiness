# Marketing Site — Vision & Handoff Spec

**Document type:** Vision / build handoff
**Version:** 0.1
**Status:** Proposed — ready for implementation handoff (Codex)
**Last updated:** August 31, 2026
**Owner:** Mark Nelson

Related: [ENGINE_CONCEPT.md](../ENGINE_CONCEPT.md) · [engine/BUSINESS_REQUIREMENTS.md](../engine/BUSINESS_REQUIREMENTS.md) · [ARCHITECTURE_AWS.md](../ARCHITECTURE_AWS.md) · [adr/0001-cloud-platform-aws.md](../adr/0001-cloud-platform-aws.md) · pack #1: [packs/eaa-accessibility/](../packs/eaa-accessibility/)

> This document is the brief for the **public, pre-login website** ("the marketing site"). It is deliberately prescriptive about *what the site must say and how it must behave*, and gives a recommended technical shape. The IA, messaging, and guardrails are binding; the framework choice is a strong recommendation with stated alternatives.

---

## 1. What the marketing site is — and is not

**Is:** the public front door. Its job is to make a specific, time-pressured buyer understand — in one visit — what the product does, why the "readiness, not compliance" framing is a feature and not a hedge, and how to start (book a concierge readiness sprint or a demo). It is the SEO surface for regulation-deadline searches, the trust surface (security, data handling, accessibility), and the home of a small amount of editorial content (deadline briefings, method notes).

**Is not:**

- Not the app. No workspace, no login form, no tenant data. "Sign in" is a link to the operator app.
- Not a self-serve signup funnel. The commercial entry is a **paid, concierge-assisted Regulatory Readiness Sprint** ([BRD §12](../engine/BUSINESS_REQUIREMENTS.md)); the primary CTA books that, not a free trial. Design so a "Start free" path can be added later without a rebuild.
- Not a docs site. Engine/pack docs stay in-repo for now.
- Not a place for invented social proof. No fake testimonials, customer logos, counters, or urgency timers — ever (see §4).

---

## 2. Positioning the site must communicate

Pulled from [BRD §3](../engine/BUSINESS_REQUIREMENTS.md) and [ENGINE_CONCEPT](../ENGINE_CONCEPT.md); do not re-invent it.

- **Category:** regulatory evidence readiness.
- **Positioning statement:** *For small and mid-size organizations that must prepare information for a regulation, the Regulatory Readiness Engine collects evidence from internal owners and outside parties, maps it to versioned requirements, and produces a reviewable export. Unlike single-regulation point tools, generic document repositories, or enterprise data platforms, it makes missing information, contradictions, provenance, and source changes explicit before publication — and does so for multiple regulations on one platform.*
- **The honesty hook (the site's spine):** we will never tell you that you are "compliant". We show you exactly what is **evidenced, missing, conflicting, stale, conditional, or not yet required**, per requirement, with a source behind every approved value — and hand you a dated package you can give to an auditor, authority, customer, or filing system.
- **One engine + a library of packs.** Adding a regulation is adding a pack (data + declared rules), not a fork. First pack: **EU Accessibility Act readiness (Ireland)** — enforcement live since 28 June 2025.
- **Concierge-first.** The first engagement is a scoped sprint with an assisted review call, not an unvalidated subscription.

### Draft homepage narrative (copy is not final; tone and claims are)

> **Headline (candidates):**
> - "Get your regulatory evidence in order — before the deadline."
> - "Know exactly what's evidenced, what's missing, and what's contradictory."
> - "Readiness you can hand to an auditor. Not a compliance badge."
>
> **Subhead:** One system to decompose a regulation into concrete requirements, work out which apply, collect answers from your team and your suppliers, keep originals separate from claims, and export a dated, source-linked package. First: the EU Accessibility Act, for services and products sold in Ireland.
>
> **Primary CTA:** Book a readiness sprint · **Secondary CTA:** See how it works

---

## 3. Who is visiting

Marketing-site visitors map to the [BRD personas](../engine/BUSINESS_REQUIREMENTS.md#5-personas-and-stakeholders). Prioritise the first two.

| Visitor | Arrives via | Wants in 30 seconds | Site answers with |
| --- | --- | --- | --- |
| **Compliance / Operations Manager** (runs the project) | Search ("European Accessibility Act Ireland", "EN 301 549 evidence", "accessibility statement Ireland deadline"), referral | "Does this reduce my deadline risk, and what does it actually produce?" | Pack page, "How it works", the sprint deliverables list, FAQ |
| **Org Admin / founder / GM** (owns budget + relationship) | Homepage, referral, "about" | "Is this credible, safe with our data, and worth the spend?" | Homepage proof section, Security/Trust page, Accessibility statement, transparent pricing range |
| **Technical Approver** (engineering/quality) | Pack page deep-link, blog | "Is the requirements model real and rigorous, or marketing?" | "How it works" diagrams (readiness state machine, evidence→claim→approved), pack methodology, source-review gate |
| **External Contributor** (supplier/agency) | A contributor link (not the marketing site) | — | Out of scope — contributor links open the app portal, not the marketing site |
| **Auditor / consultant / partner** | "About", Security, blog | "What exactly does an export contain, and what does it *not* assert?" | Trust page, export description, the limitation statement |

---

## 4. Non-negotiable guardrails

These are product invariants, not style preferences. They are testable and must be enforced in CI.

### 4.1 Language discipline

The product forbids "compliant / certified / approved / registered" framing ([pack copy.md](../packs/eaa-accessibility/copy.md), release-copy scan AC-023). **The marketing site is held to the same bar.**

- **Forbidden on the marketing site** (extends the pack list): "compliant", "compliance made easy", "become / get compliant", "guaranteed compliance", "compliance guaranteed", "certified", "audit-proof", "audit passed", "risk-free", "fully accessible", "100% accessible", "instantly compliant", "one line of code", "meets all legal requirements", "legal compliance", "we make you compliant".
- **Permitted:** "readiness", "evidence", "prepare / preparation", "based on control snapshot {key}", "meets the requirements checked under EN 301 549 V3.2.1", "conformance evidence prepared to WCAG 2.1 Level AA", "known limitations".
- Every page that describes an outcome carries, or links within one scroll to, the **limitation statement**: *"This is a preparation and evidence record — not a certification, a conformity assessment, or a legal opinion. Responsibility for compliance remains with the organization."*
- **Deliverable:** a repo lint (`pnpm --filter @rre/marketing lint:copy` or a shared script) that scans all rendered copy — MDX content, `.astro` files, and any `copy.ts`/`content/` strings — for the forbidden list and fails CI on a match. Model it on the product's release-copy scan. Keep the forbidden list in one shared module so the product and the site cannot drift.

### 4.2 Honesty of proof

- No testimonials, named customers, or logo walls until they are real and permissioned. Until then: omit the section, or use an explicit "we're in paid pilots — talk to a reference" line.
- No fabricated metrics ("saves 200 hours", "10,000 controls checked") without a cited basis. Directional claims from the BRD (e.g. "replaces €5k–50k of agency remediation work") are allowed if attributed as an estimate.
- Pricing: show the **directional sprint range (EUR 750–1,500 per entity per regulation)** rather than "contact us for pricing". Transparency is on-brand. Mark it "indicative, confirmed after a scoping call".
- No dark patterns: no countdown timers, no pre-ticked consent, no fake scarcity, no "roach motel" newsletter signup, no interstitial that blocks content.

### 4.3 Accessibility of the site itself

Pack #1 is the EU Accessibility Act. **An inaccessible marketing site would be disqualifying.** Treat WCAG 2.2 AA as a build requirement, not a polish pass:

- Semantic landmarks, one `h1` per page, correct heading order, skip link, visible focus, logical tab order.
- Colour contrast ≥ 4.5:1 (text) / 3:1 (UI + large text); never colour-only signalling.
- All interactive islands operable by keyboard; `prefers-reduced-motion` respected; no autoplaying motion.
- Forms: programmatic labels, error text tied to fields, no reliance on placeholder-as-label.
- Ship a real **Accessibility statement** page for the site (see §9), and keep it honest.
- **CI gates:** automated `axe`/`pa11y` run on the built output (zero serious/critical), plus a manual keyboard + screen-reader pass in each milestone's definition of done.

### 4.4 Privacy

- EU audience, Irish jurisdiction. Default to **cookieless analytics** (no consent banner needed) and no non-essential cookies at launch. If a third-party embed later sets cookies, add a compliant granular consent banner (reject = default) — but design v1 to avoid it.
- Any form states its purpose and lawful basis at the point of collection; no pre-ticked boxes; a link to the privacy notice beside every submit button.

---

## 5. Information architecture

Slugs are proposals — pick readable, keyword-aware URLs. `[content]` = MDX/collection entry; `[page]` = mostly-static template.

| Route | Type | Purpose | Key sections | Primary CTA |
| --- | --- | --- | --- | --- |
| `/` | page | The pitch in one screen + scannable depth below | Hero; the honesty hook (evidenced/missing/conflicting/stale, visual); "one engine + packs"; how it works (3–4 steps); who it's for; comparison table; pack teaser; trust strip; CTA band | Book a readiness sprint |
| `/how-it-works` | page | The method, with real diagrams | Decompose → decide applicability → assign → collect (team + suppliers, no account) → separate evidence from claims → resolve conflicts → measure readiness honestly → export → re-assess on change. Diagrams: readiness state machine; evidence → assertion → approved-claim lineage; the pack model | Book a readiness sprint |
| `/platform` (or `/product`) | page | For the evaluator who wants substance | Versioned control catalog; deterministic applicability (unknowns → "conditional", never a guess); review gates (no automated approval); conflict engine; scoped no-account contributor links; immutable snapshots + portable export; audit + tenant isolation. Each ties to a one-line "why it matters" | Talk to us |
| `/packs` | `[content]` index | The regulation library + roadmap | Pack cards (status: available / in discovery / hold); "adding a regulation is a pack, not a fork"; short roadmap, **no dates** | Browse the EAA pack |
| `/packs/eu-accessibility-act` (alias `/accessibility-act-readiness`) | `[content]` | **SEO workhorse** for pack #1 | What the EAA requires; who's in scope (services vs products; Ireland S.I. 636/2023); the 28 June 2025 date; what "readiness" means here (permitted phrasing only); what the sprint delivers for this pack (evidence matrix vs EN 301 549 / WCAG 2.1 AA; missing/conflict report; accessibility-statement draft + evidence index; assisted review call); **what it does not do** (certify, guarantee conformity, give a legal opinion, decide disproportionate burden); FAQ; sources (EN 301 549 V3.2.1; Directive (EU) 2019/882; S.I. 636/2023) | Book an EAA readiness sprint |
| `/pricing` | page | The concierge offer, transparently | Sprint scope + directional range (EUR 750–1,500 / entity / regulation); what's included/excluded (no specialist legal, lab, or metric work); "subscription later, after pilots"; contributors never pay | Book a scoping call |
| `/security` (or `/trust`) | page | Data-handling credibility | EU region (eu-west-1); per-tenant isolation (Postgres row-level security); immutable evidence store; tokens stored hashed; no evidence text or tokens in logs; customer data export + deletion; audited, time-bound support access; sub-processors list; responsible-disclosure contact. **Mark anything not yet built as "roadmap".** Source of truth: [ARCHITECTURE_AWS.md](../ARCHITECTURE_AWS.md), [TECHNICAL_REQUIREMENTS.md](../engine/TECHNICAL_REQUIREMENTS.md) | Contact security |
| `/accessibility` | page | The site's own WCAG 2.2 AA statement | Standard targeted; known limitations; how to report a barrier + response-time commitment; last-tested date | — |
| `/about` | page | Who is behind it + why | The thesis (publication infra is commoditising; the preparation layer is underserved); the founder; principles ([BRD §3.4](../engine/BUSINESS_REQUIREMENTS.md)); how packs are governed (two-person source-review gate) | Talk to us |
| `/blog` + `/blog/[slug]` | `[content]` | Regulation-deadline briefings, method notes, changelog highlights | Index with tags; article template; author + date; "not legal advice" note | Subscribe to deadline briefings |
| `/contact` | page | Catch-all | Scheduling link (sprint / demo), email, "for existing customers: sign in", security/press addresses | — |
| `/legal/privacy`, `/legal/cookies`, `/legal/terms`, `/legal/dpa`, `/legal/sub-processors` | `[content]` | Binding legal text | Standard legal-doc layout; "last updated"; owner supplies final wording (see §12) | — |
| `/404`, `/500` | page | Friendly recovery | Search or nav back to `/`, `/packs`, `/how-it-works` | — |
| `sitemap.xml`, `robots.txt`, `/rss.xml` | generated | SEO / syndication | — | — |

**Global chrome**

- **Header:** wordmark → `/`; nav (How it works · Platform · Packs · Pricing · Security · Blog); "Sign in" (ghost link → app URL); "Book a sprint" (primary button). Mobile: disclosure menu (keyboard-operable island).
- **Footer:** condensed nav; legal links; company legal name + registered address; "Regulatory evidence readiness — not legal advice, conformity assessment, or authority approval."; responsible-disclosure + press email; analytics/privacy note.

---

## 6. Messaging framework (for whoever writes final copy)

- **Value props (lead with these):** (1) See the true state per requirement — evidenced / missing / conflicting / stale — never an average that hides risk. (2) Collect from suppliers and colleagues without giving them an account or a training session. (3) Keep originals, assertions, and approved claims distinct, with a source behind every approved value. (4) Export a dated, portable package — no lock-in. (5) When the regulation changes, see which requirements and entities are affected before deciding to migrate.
- **Objection handling:** "Isn't this just a checklist?" → versioned control catalog + deterministic applicability + conflict detection + provenance. · "We'll use a spreadsheet." → spreadsheets don't assign ownership, detect contradictions, enforce review states, scope external access, or produce an audit trail ([BRD §4.3](../engine/BUSINESS_REQUIREMENTS.md)). · "Can't AI just read our PDFs?" → extraction produces *proposals*; a person accepts or rejects, and a proposal with no source location can't be accepted. · "Will you make us compliant?" → no — legal responsibility stays with you; we make readiness and gaps explicit and defensible.
- **Comparison table** (straight from [BRD §4.3](../engine/BUSINESS_REQUIREMENTS.md)): vs single-regulation point tool · enterprise GRC / data space · PIM/PLM/QMS · shared drive/spreadsheet · compliance consultant. One row per, "their strength" / "the gap we close".
- **Proof we can make now:** the method (diagrams), the pack-governance gate, the security posture, the directional cost comparison, transparent pricing. **Not** customer names or metrics until real.

---

## 7. Conversion

- **Primary action everywhere:** "Book a readiness sprint" / "Book a scoping call" → a scheduling flow.
- **MVP (launch before any backend):** link to a scheduling tool (Cal.com self-hosted preferred for data residency, or a SaaS scheduler). Lazy-load any embed **after** click so it sets no cookies on page load.
- **Target (M5):** native form → `POST /marketing/v1/leads` on the existing Fastify API:
  - New `lead` table — **no tenant / no RLS** (leads exist before a tenant does); columns: id, email, name, org, message, pack_interest, source/UTM, consent flag + text shown, created_at.
  - On insert, `enqueue('lead.captured', …)` on the existing transactional outbox; a notifier (SES email + optional Slack) consumes it. Reuses the [outbox pattern](../adr/0004-audit-and-outbox.md); no new infra shape.
  - Spam controls: honeypot field, per-IP rate limit, Cloudflare Turnstile (script is deferred, no cookie).
  - Never log the message body with PII beyond what's needed; store consent context.
- **Secondary action:** "Subscribe to deadline briefings" (email only; double opt-in; same `lead`/newsletter treatment; unsubscribe link mandatory).
- Track `source`/`utm_*` on every CTA click (via the cookieless analytics custom-event API), not via cookies.

---

## 8. Design direction

- **Feel:** editorial and high-trust — closer to a professional-services or legal-tech site than a gradient-blob SaaS page. Strong typography, generous whitespace, one restrained accent, real diagrams instead of stock photography. **No stock photos of people. No logo walls.**
- **Tokens:** reuse the app's palette so the two properties are visibly one brand — `--accent: #1c4e80` (navy), `--danger: #a3261d`, ground `#fafafa`, ink `#1a1a1a`, `--muted: #5c5c5c`, `--border: #d8d8d8`. Put these in a shared **`packages/brand`** (CSS custom properties + a `tokens.ts`) consumed by both `apps/web` and `apps/marketing`; do not copy-paste.
- **Type:** a system font stack is acceptable for v1 (matches the app). If a webfont is added: self-host, `font-display: swap`, subset, with a real fallback stack and no CLS.
- **Theme:** light and dark parity, matching the app's theming approach (explicit toggle wins; otherwise follow `prefers-color-scheme`). Every colour defined as a token on `:root`.
- **Components:** header, footer, hero, value section, step/stepper, comparison table, pack card + grid, FAQ accordion (island), CTA band, offer/pricing card, diagram figure (with a text alternative), legal-doc layout, blog list + article, callout/limitation banner, 404. Keep the set small and reuse it.
- **Diagrams:** author as inline SVG or Mermaid rendered at build time; each has a caption and a concise text description for non-visual users. Candidates: the readiness state machine; evidence → assertion → approved-claim; entity facts → applicability → per-control status; "one engine, many packs".
- **Motion:** subtle, optional, disabled under reduced-motion. No parallax, no scroll-jacking.

---

## 9. Content model

- Author content as **MDX content collections** with typed frontmatter (schema-validated at build):
  - `packs/` — `title`, `slug`, `regulation`, `jurisdiction`, `status` (`available` | `discovery` | `hold`), `enforcementDate`, `summary`, `sources[]`, body.
  - `posts/` — `title`, `slug`, `date`, `author`, `tags[]`, `summary`, `draft`, body.
  - `legal/` — `title`, `slug`, `lastUpdated`, body.
  - `site` config — nav items, footer, company legal name/address, app URL, scheduler URL, social/press emails.
- Mostly-static pages keep copy in the `.astro` file or a colocated `copy.ts` — **all of it reachable by the forbidden-phrase lint**.
- Structure collections as locale-keyed (`en/…`) from day one so later i18n is cheap. **No i18n in v1** (English; Ireland).
- No CMS. Content changes are PRs, reviewed like code.

---

## 10. SEO & metadata

- Per-page `<title>`, meta description, canonical URL, `og:*` + `twitter:*`. Build-time **OG image generation** (templated per page/pack).
- `sitemap.xml` + `robots.txt` (allow all; disallow nothing sensitive — there is nothing sensitive). `rss.xml` for the blog.
- **JSON-LD:** `Organization` (site-wide), `WebSite` + `SearchAction` if search exists, `FAQPage` on pages with a real FAQ, `Article` on blog posts, `BreadcrumbList` on nested pages. `SoftwareApplication` is acceptable on `/platform` **only** with honest, non-"compliance" descriptions.
- Clean semantic HTML; descriptive link text (no "click here"); image `alt` everywhere; heading hierarchy.
- Performance is an SEO and credibility feature: Lighthouse targets in §14.

---

## 11. Analytics & consent

- **Cookieless** web analytics: Plausible (self-host on existing infra, or cloud), Umami, or Cloudflare Web Analytics. **Not GA4.**
- No consent banner at launch (no non-essential cookies). Still publish `/legal/cookies` explaining that only strictly-necessary storage is used.
- Custom events for CTA clicks, form submits, scheduler opens — via the analytics event API, no cookies, no PII.
- If a future embed needs cookies: add a granular, reject-by-default consent manager and gate the embed behind it.

---

## 12. Legal & trust pages

The site must ship these; **the owner supplies binding wording** — do not invent legal terms.

| Page | v1 content | Who finalises |
| --- | --- | --- |
| `/legal/privacy` | Data collected (form + analytics), purpose, lawful basis, retention, rights, controller identity + contact, transfers | Owner / counsel |
| `/legal/cookies` | "Strictly necessary only" statement; analytics is cookieless | Owner |
| `/legal/terms` | Website terms of use (not the product MSA) | Owner / counsel |
| `/legal/dpa` | Data-processing terms for customers (link or PDF) | Owner / counsel |
| `/legal/sub-processors` | Table: name, purpose, region. Keep current | Owner (maintained) |
| `/security` | Prose from [ARCHITECTURE_AWS.md](../ARCHITECTURE_AWS.md) + [TECHNICAL_REQUIREMENTS.md](../engine/TECHNICAL_REQUIREMENTS.md); "roadmap" tags on anything unbuilt; disclosure contact | Owner reviews claims |
| `/accessibility` | The site's own WCAG 2.2 AA statement; known issues; report path + SLA | Build team drafts, owner approves |

Codex should scaffold these with clearly-marked placeholder text (`> TODO: owner to supply`) and correct structure/routing/metadata, so nothing ships with silent gaps.

---

## 13. Technical shape (recommendation)

### 13.1 Where it lives

A **new workspace app: `apps/marketing`** in this monorepo. Rationale: separate audience, SEO needs (pre-rendered HTML, per-page metadata), a tiny JS budget, no auth/app code, independent deploy cadence, cheap static hosting. Add a shared **`packages/brand`** for tokens.

Rejected: adding public routes to `apps/web`. It is a client-rendered SPA behind a tenant `Shell`; it would hurt SEO, ship app/auth code to anonymous visitors, and couple release cadence.

### 13.2 Framework

**Recommended: Astro** (with `@astrojs/react` for the few interactive islands — mobile nav, FAQ accordion, lead form). Content collections + MDX fit the content model; near-zero JS by default; excellent Lighthouse out of the box; clean fit with pnpm workspaces and the existing Vite/TS toolchain.

**Acceptable alternative:** Next.js with static export (`output: 'export'`) if the implementer is materially more fluent in it. Everything in §§1–12, 14–16 is framework-agnostic; only §13.3–13.5 change.

**Not recommended:** a second Vite SPA (SEO), or a heavyweight CMS.

### 13.3 Shared code

- `packages/brand` — CSS custom properties (`brand.css`) + `tokens.ts`; imported by `apps/marketing` and progressively adopted by `apps/web`.
- A shared **forbidden-phrase module** (e.g. `packages/contracts` or a small `packages/copy-guard`) exporting the list + a `scan(text)` helper, used by the product's release-copy check *and* the marketing copy lint. Single source of truth.
- Reusing `@rre/ui` React components is optional and low priority (it currently carries `@rre/domain` types); prefer marketing-local components.

### 13.4 Hosting & deploy (AWS, cost-aware — matches [ADR 0001](../adr/0001-cloud-platform-aws.md))

- **S3 (private) + CloudFront (OAC) + ACM cert + Route 53**, region **eu-west-1**. Static output; long-cache hashed assets, short-cache HTML, invalidate on deploy.
- Alternative: **AWS Amplify Hosting** (simpler, has a free tier) if the team prefers managed CI/CD over the S3+CloudFront wiring.
- **Domains:** apex/`www` → marketing (pick one canonical, 301 the other); `app.` → operator app; contributor links keep opening the app (`/contribute/:token`) — a short `go.`/`link.` subdomain is a later nicety.
- Provision buckets/distribution via `infra/` (Terraform/CDK, consistent with the repo) — a `marketing` stack.

### 13.5 CI

Add a `marketing` job (or `.github/workflows/marketing.yml`):

- `pnpm --filter @rre/marketing lint` + `lint:copy` (forbidden-phrase scan) + `typecheck`
- `astro build` (or `next build && next export`)
- `axe`/`pa11y-ci` against the built output — **zero serious/critical**
- `@lhci/cli` with the budget in §14 on `/`, `/how-it-works`, `/packs/eu-accessibility-act`
- On `staging` → deploy to the staging bucket + invalidate; on `main` → production bucket + invalidate. Same three-branch model as the rest of the repo (`develop` → `staging` → `main`).

### 13.6 Env / config

`PUBLIC_SITE_URL`, `PUBLIC_APP_URL`, `PUBLIC_SCHEDULER_URL`, `PUBLIC_ANALYTICS_DOMAIN`/`_SRC`, `MARKETING_LEADS_ENDPOINT` (M5). Deploy secrets: `AWS_ROLE_ARN`, `MARKETING_BUCKET`, `CLOUDFRONT_DIST_ID`. No secrets in the client bundle.

---

## 14. Definition of done

**Per page**

- Copy uses only permitted phrasing; `lint:copy` passes; the limitation statement is present or within one scroll.
- WCAG 2.2 AA: keyboard-complete, visible focus, landmarks, heading order, contrast, labelled forms with tied errors, `alt` text, reduced-motion honoured. `axe` clean.
- Responsive 320–1920 px, no horizontal scroll, no CLS.
- Metadata complete: title, description, canonical, OG/Twitter, JSON-LD where applicable.
- All **content** readable with JavaScript disabled (islands are enhancement only).
- Light + dark parity.

**Global (launch)**

- Lighthouse (mobile) on key pages: **Performance ≥ 95, Accessibility 100, Best-Practices 100, SEO ≥ 95**; total blocking time < 150 ms; JS shipped on `/` < ~30 KB gzip.
- `sitemap.xml`, `robots.txt`, `rss.xml` valid; OG images render.
- Manual screen-reader pass (VoiceOver or NVDA) on `/`, `/how-it-works`, `/packs/eu-accessibility-act`, one form.
- Legal/trust pages present (placeholders clearly marked); footer has legal entity + address.
- Analytics firing; no cookies set on load (verify in devtools).
- Staging deploy green; production deploy runbook written.

---

## 15. Build sequence

| Milestone | Scope | Exit |
| --- | --- | --- |
| **M0 — Scaffold** | `apps/marketing` (Astro + React islands), `packages/brand` tokens, shared forbidden-phrase module wired to `lint:copy`, header/footer, CI job, staging deploy pipeline, placeholder home | CI green; staging URL live |
| **M1 — Core pages** | `/`, `/how-it-works` (with diagrams), `/platform`, `/about`, `/contact` (scheduler link), `/404`; component set + design system; theme parity | Pages meet per-page DoD |
| **M2 — Packs + content** | Content collections (`packs/`, `posts/`); `/packs` index; `/packs/eu-accessibility-act` (full, SEO-tuned); FAQ + comparison-table components; `/blog` + first post; `/pricing` | EAA page ranks-ready; content model documented |
| **M3 — Trust & legal** | `/security`, `/accessibility` (real statement), `/legal/*` scaffolds with marked placeholders | All routes exist; claims reviewed by owner |
| **M4 — SEO / analytics / a11y hardening** | sitemap, robots, rss, JSON-LD, OG image generation, cookieless analytics + events, `axe` + Lighthouse in CI, manual SR pass | Global DoD met on staging |
| **M5 — Lead capture + launch** | `POST /marketing/v1/leads` (+ `lead` table, `lead.captured` outbox notifier), native form replacing the scheduler link as primary; production deploy on `main` | Live on the primary domain; leads arriving |

M0–M4 can ship the site on staging (or a soft-launch domain) using the scheduler link. M5 is independent and can trail.

---

## 16. Open decisions for the owner

1. **Product / brand name + domain(s).** "Regulatory Readiness Engine" is a placeholder, not trademark-cleared ([ENGINE_CONCEPT](../ENGINE_CONCEPT.md)). The site can't launch publicly without a cleared name and a domain. Interim: build under a codename, keep the wordmark a single swappable component + token.
2. **Legal entity name + registered address** for the footer and legal pages (NelsonGrey, or a new company?).
3. **Who drafts binding legal copy** (privacy / terms / DPA). Codex scaffolds structure only.
4. **Scheduling tool:** Cal.com self-hosted (data residency, no third-party cookies) vs a SaaS scheduler.
5. **Analytics tool:** Plausible (self-host vs cloud) / Umami / Cloudflare.
6. **Publish the pricing range?** Recommendation: yes — show EUR 750–1,500 / entity / regulation, marked indicative.
7. **Tease pack #2 (CRA)?** Recommendation: a "more packs" section with a short roadmap and **no dates**; keep `/packs` honest about status.
8. **Hosting:** S3 + CloudFront (recommended) vs Amplify Hosting.

---

## 17. Explicit non-goals (v1)

- No login, workspace, or tenant data on the marketing site.
- No self-serve signup / free-trial funnel (concierge-first).
- No live-chat widget.
- No gated content requiring a form to read.
- No CMS / content admin UI — content is MDX in the repo.
- No public docs/status site (later).
- No i18n / localisation (English, Ireland) — but structure content so it's cheap to add.
- No customer logos, testimonials, or metrics until real and permissioned.
