# Tenancy and Domain Architecture

## Principle

Customer-hosted/public tenant content should live on a separate registrable domain from the platform/auth brand to protect cookie, reputation, SEO, and content isolation boundaries.

## Preferred tenant pattern

If available:

- `*.piggles.site` — tenant sites
- `customers.piggles.site` — CNAME target for custom domains
- `piggles.site` — apex redirect to `meetpiggles.com`

Example: `bobsbarber.piggles.site`

## Platform domains

- `meetpiggles.com`
- `getpiggles.com`
- `mypiggles.com`
- `api.mypiggles.com`
- `mcp.mypiggles.com`
- `status.meetpiggles.com`

## Email infrastructure

Preferred if available:

- `piggles.email`
- `mail.piggles.email`

## SEO satellite domains

- `pigglescms.com`
- `pigglescrm.com`
- `pigglesemail.com`
- `pigglesb2b.com`
- `pigglessite.com`
- `pigglesstore.com`
- `pigglesbookings.com`
- `pigglesapi.com`
- `pigglesmcp.com`

**These are real content surfaces, not parked redirects.** They exist to capture demand
the main sites structurally cannot: people do search "best CMS for a small business" and
"CRM software", and `meetpiggles.com` will never rank for those because it refuses to
speak in software categories. The satellites speak the technical vocabulary, translate it
to plain language, and hand the reader to Piggles. Category words live here so they never
have to live on the product surfaces.

Do not fragment canonical docs across these domains.

### Never 301 a satellite to a page

A 301 tells a search engine the URL is permanently somewhere else. The engine follows it,
indexes the destination, and the satellite never appears in a result — there is no page
there to rank. So a satellite that redirects accomplishes **nothing** toward capturing
category search: the destination ranks on `meetpiggles.com`'s own merits exactly as it
would have if the domain had never been bought.

Satellites host real indexable content or they are dead weight.

**Defensive registrations are the opposite case.** Misspellings, `.net` variants and typo
domains exist to deny them to someone else and to catch mistyped URLs; those should all
301 to canonical. Two different jobs — do not let the treatments blur.

### What they must be to stay safe

A cluster of domains that all funnel to one product is, structurally, what search engines
class as **doorway pages** — and that is a manual-action risk, not a theoretical one. The
line between a doorway and a legitimate topical site is whether the thing is independently
useful:

- Each satellite is a genuine standalone resource — real explanatory depth on its subject,
  useful to someone who never signs up.
- **No duplicated content between satellites**, and none copied from `meetpiggles.com`.
  Overlapping subjects get a canonical tag pointing at one owner.
- Conversion is present but is not the only purpose. A page that is a headline and a signup
  button is a doorway however it is worded.
- One shared consent, analytics, legal and sitemap setup, so nine surfaces do not become
  nine compliance gaps.

### The cost nobody has priced yet

Nine new domains all start at **zero** authority and each needs its own backlink profile.
A `meetpiggles.com/guides/cms` subfolder inherits whatever authority the main domain has;
`pigglescms.com` inherits nothing. For a pre-launch brand with no authority anywhere, that
is nine uphill climbs instead of one, and the compounding runs the wrong way.

The subfolder alternative gets most of the same benefit — a `/guides/` namespace may use
technical words even while the product surfaces do not, because that is where technical
searchers land. The satellites are still defensible: exact-match domains carry residual
weight, they can be sold or spun off, and they keep category vocabulary fully off the
brand. But the trade is real and should be a decision rather than a default. If in doubt,
launch one satellite, measure it against an equivalent subfolder, and expand on evidence.

### How to build them

**As Piggles sites, on a `system` tenant — not as new apps.**

One WizeWorks-owned tenant, flagged `system`, holding one **site** per satellite (the
platform is already multi-site per tenant). Staff sign into `mypiggles.com` as that tenant
and build them with Piggles' own builder and CMS, attaching each domain through the normal
custom-domain flow.

The platform already owns every hard part: the `Domain` model handles custom hostnames with
TXT verification at `_sparx-verify.<host>`, a `pending → verifying → verified → active`
lifecycle, canonical/`www` handling and certificate automation; `wizeworks/apps/site` already serves
tenant sites by hostname; the CMS already edits them.

So each satellite is a site on a WizeWorks-owned tenant with its domain attached the normal
way. That gives:

- **Zero new deploy targets.** No new pods, no new pipeline stages, no per-domain routing
  code — nine hostnames on infrastructure that already exists.
- **Editable without a deploy.** Marketing writes content in Piggles instead of opening a PR.
- **A real dogfooding proof.** "Our own marketing runs on Piggles" is worth more than a
  claim on a features page.

The owning tenant carries the `system` flag (see
[BILLING_RULES.md](../commercial/BILLING_RULES.md)), so nine sites' storage never trips a
capacity meter.

Building these as nine Next apps would be nine pods for nine content sites. Building them as
one multi-domain Next app would mean re-implementing custom-domain verification and
certificate issuance that the platform already does. Neither is warranted.
