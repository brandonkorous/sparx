# 089 — Her salon's web address is "swift-horizon-4860", and it goes nowhere

**Status:** open (cause fixed; the rows already drifted are queued behind the pipeline)
**Severity:** major
**Found by:** P02 · Halo & Hem · act 5
**Surface:** mypiggles › My Site › Your site · Domains — and getpiggles › Your account
**Filed:** 2026-08-21
**Fixed:** 2026-08-21 — for new businesses, and for the two apps disagreeing
**Confirmed by:** — (Nia's own row is repaired by the migration below, which is not mine to run)
**Blocked on:** pipeline — the data repair is authored and dry-run, and the release applies it

## What happened

Nia opened My Site to put a booking page on her website, and read the first
sentence on the pane:

> The name, logo, and links people see across `swift-horizon-4860.piggles.site`

Her salon is called Halo & Hem. She typed that into onboarding, and the console
uses it everywhere else — the pane is even titled **Halo & Hem**. The web
address is a random word, another random word, and a number.

Following it to **Domains** confirms it, and closes the door:

| Address                           | Badges           |
| --------------------------------- | ---------------- |
| `swift-horizon-4860.piggles.site` | Main · Always on |

Opening that address gives her one card, and no field:

> **Nothing to set up**
> We look after this address, so there is nothing for you to set up and nothing
> that can break. … **it can never be removed, because it is your site's
> permanent back-up address.**

So the product tells her, in plain words, that `swift-horizon-4860` is
permanent. The only two buttons on the pane are **Get a domain** and **Connect a
domain**, both about a domain she would have to go and buy.

## And the two apps disagree about what it even is

This is the part that turns an ugly address into a wrong one. **Her account page
on getpiggles says something different:**

| Screen                               | The address it shows              |
| ------------------------------------ | --------------------------------- |
| getpiggles › Your account            | `halo-and-hem.piggles.site`       |
| mypiggles › My Site › Your site      | `swift-horizon-4860.piggles.site` |
| mypiggles › Domains, and its "Visit" | `swift-horizon-4860.piggles.site` |

Two screens of the same product, two addresses for one salon. They are read from
two different places — the account page builds a string out of the business
slug, the console reads the `domains` row — and nothing reconciles them.

## Which one actually works

The console's is the dead one.

A `*.piggles.site` host is **self-describing**: the site renderer decodes the
tenant straight out of the hostname and, by design, never falls through to the
`domains` table for it
([wizeworks/apps/site/lib/site-context.ts](../../../../wizeworks/apps/site/lib/site-context.ts)
— `if (zoneRoute) return zoneRoute;`, with `SPARX_ZONE_DOMAINS=sparx.zone,piggles.site`
in the deployed config). So the address that works is the one built from the
business slug, and the address stored against her site decodes to a tenant that
does not exist.

Proved against the running site renderer, using the zone this dev deployment
owns so the same decode path is exercised:

| Host requested                  | Response           |
| ------------------------------- | ------------------ |
| `halo-and-hem.sparx.zone`       | **200** — her site |
| `swift-horizon-4860.sparx.zone` | **404**            |

The dev site app is not configured with `piggles.site` in its zone list, so a
`*.piggles.site` request there falls through to the `domains` table and inverts
the result. That is a local configuration gap, not the behaviour that ships; the
decode above is what the deployed config produces.

## What should have happened

**One address, and it is her business's name.** Onboarding is the moment the
business name is first known, and it already renames three things with it: the
tenant, the site, the slug. The web address her site is served at should be the
fourth, so every screen quoting it quotes the same live host.

## How to reproduce

Every time, on any Piggles business signed up after issue
[010](010-her-bakerys-web-address-is-quiet-haven-3783.md)'s fix.

1. Sign up at `:3021`, business name **Halo & Hem**, and finish onboarding.
2. `mypiggles` › My Site › **Your site**. Read the first sentence.
3. Compare it with `getpiggles` › Your account.

Read back from the database, across every Piggles business in the pool:

| Business          | Business slug      | The address stored on its site    |
| ----------------- | ------------------ | --------------------------------- |
| Halo & Hem        | `halo-and-hem`     | `swift-horizon-4860.piggles.site` |
| The Marrow Review | `marrow-review`    | `mighty-spruce-5400.piggles.site` |
| Wildroot Flowers  | `wildroot-flowers` | `wildroot-flowers.piggles.site`   |
| Thistle & Rye     | `quiet-haven-3783` | `quiet-haven-3783.piggles.site`   |

Two of the four are split. Wildroot Flowers matches because it was never renamed
— it was born with that name. Thistle & Rye matches because it signed up before
#010, so both halves stayed on the placeholder: wrong, but at least consistent.

## Why it matters

**The web address is the product.** A salon's site exists to be typed into a
phone, printed on a card, and pasted into an Instagram bio. Nia gets one that is
unmemorable and unexplainable, and that is about to have a booking page published
onto it.

Then it gets worse than ugly. The address the console shows her, and the one
behind its **Visit** button, is the one that does not resolve. If she puts that
on a card, her clients get nothing at all. She has no way to find that out,
because the only two screens that could tell her disagree and neither mentions
the other.

And it is silent ([[feedback_absent_behaves_like_fine]]): a random address looks
exactly like a deliberate one, and a dead address looks exactly like a working
one until somebody types it.

## Where it lives

Two sources for one fact, and nothing keeping them together.

1. **The row is written from the placeholder and never revisited.**
   [wizeworks/packages/auth/src/provision-tenant.ts](../../../../wizeworks/packages/auth/src/provision-tenant.ts)
   creates the canonical domain as `` host: `${input.slug}.${zone}` `` at
   sign-up, when the only slug that exists is the generated placeholder, because
   sign-up asks for an email and a password and not for a business name.
2. **Onboarding renames the slug but not the row.**
   [piggles/apps/account/lib/business-slug.ts](../../../apps/account/lib/business-slug.ts)'s
   `claimBusinessSlug` updates `tenants.slug` inside the rename transaction. It
   does not touch `domains`.
3. **The account page composes a string instead of reading the row.**
   [piggles/apps/account/app/account/page.tsx](../../../apps/account/app/account/page.tsx)
   renders `{tenant?.slug}.{PRODUCT.tenantSites.suffix}`, which is why it looks
   right while the stored row is wrong, and why nobody noticed.

## This is the other half of #010, and why its confirmation missed it

[010](010-her-bakerys-web-address-is-quiet-haven-3783.md) is the same defect,
found by Marisol, fixed on 2026-08-19. Its fix claimed the **business slug**,
which was the right first move. Its confirmation then read the slug back:

> Its account page reads **marrow-review.piggles.site**, and the database agrees
> (`select name, slug from tenants`).

Both of those are the composed string and the column it is composed from — one
source, checked twice. The `domains` row was never read, and The Marrow Review's
is `mighty-spruce-5400.piggles.site` to this day.

That is the lesson worth keeping: **a fix confirmed against the value it wrote
has not been confirmed.** The address a customer reaches lives somewhere else,
and that somewhere else is what should have been read.

## The fix

**Made, in two parts.**

**1. The address follows the business name.**
[piggles/apps/account/lib/business-slug.ts](../../../apps/account/lib/business-slug.ts)
now claims the `domains` host in the same transaction as the slug, so the two
can never be renamed apart. Three details worth keeping:

- It runs **even when the slug did not move**. The old guard returned early on
  `wanted === currentSlug`, which is exactly Nia's shape — her slug was already
  right and her host was already stale, so a short-circuit would have skipped the
  half that was wrong.
- A named site keeps its own label: `<site>.<business>.<zone>` is re-minted as
  such rather than flattened to `<business>.<zone>`.
- Best-effort per row, like the slug claim. `domains.host` is globally unique
  across both brands, so an address somebody else holds leaves that row alone
  rather than failing a sign-up.

**2. The two apps read one source.** The account page rendered
`{tenant.slug}.{suffix}` — the same fact, composed rather than read, which is why
it looked right while the stored row was wrong. It now reads the canonical
`subdomain` row, the same one the console reads. If they ever drift again it is
visible instead of invisible.

**3. The businesses already split** —
[20270403000000_piggles_site_address_follows_the_business_name](../../../../wizeworks/packages/db/prisma/migrations/20270403000000_piggles_site_address_follows_the_business_name/migration.sql).
Authored, **not run** (personas CLAUDE.md — author the file, the pipeline applies
it). Dry-run as a `SELECT` against the dev database, it picks exactly the two
drifted rows and no others:

| before                            | after                        |
| --------------------------------- | ---------------------------- |
| `swift-horizon-4860.piggles.site` | `halo-and-hem.piggles.site`  |
| `mighty-spruce-5400.piggles.site` | `marrow-review.piggles.site` |

It is idempotent, it touches `subdomain` rows only, it skips any row whose
corrected address is already claimed, and it stops at Piggles. **sparx tenants
have the same drift** — `seedcheck` is on `keen-falcon-3126.sparx.zone` — and
repairing those is not this migration's to make: their sites are live on those
hosts, and reaching into the other product's data is what the brand boundary
forbids. Flagged for sparx rather than fixed here.

## What is still open

Nia's own address until the release runs, and one thing after that.

**An owner still cannot change the free address.** The Domains pane offers "Get a
domain" and "Connect a domain" and states the free one can never be changed. With
the fix above, a business renamed at onboarding gets the right address and a
business renamed _later_ would too — but there is no "later" screen, so a name
change after onboarding leaves the address behind again. Whether to build one is
a product decision:

- **A field on the Domains pane**, uniqueness-checked, offered while the site is
  unpublished and no custom domain is attached. Answers "I renamed my salon" and
  "I never liked what I typed on day one", and it would have to answer the same
  question for sparx.
- **Reconcile on rename only** — the address always follows the business name,
  with no field at all. Consistent with the fix above and nothing new to explain;
  but an owner whose name is right and whose address is not has nothing to press.

## Rating effect

`My Site › Your site` and `Domains` are scored in [rating.md](../rating.md) with
this as their gap.
