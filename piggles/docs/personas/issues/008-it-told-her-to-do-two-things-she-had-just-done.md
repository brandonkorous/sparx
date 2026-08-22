# 008 — Her first screen told her to do two things she had just done, using two words she has never heard

**Status:** fixed
**Severity:** major
**Found by:** P01 · Thistle & Rye · act 4
**Surface:** mypiggles › Home › Get set up
**Filed:** 2026-08-19
**Fixed:** 2026-08-19
**Confirmed by:** re-ran P01 act 4 — "Get set up" went from **2 of 6 done · 33%** to **4 of 6 done · 67%**, "Add your first page" and "Choose a template" both ticked, and the buttons now read "Open Content" and "design your own in My Site"
**Blocked on:** —

## What happened

Ninety seconds after finishing onboarding, Marisol opens **Get set up** — the
first thing the console offers a new business. It says **2 of 6 done, 33%**, and
lists four things left to do. Two of them she did during signup:

| It says                                                  | What is actually true                                                  |
| -------------------------------------------------------- | ---------------------------------------------------------------------- |
| ☐ Add your first page — _Open CMS_                       | Her site already has **five pages**, installed by the template         |
| ☐ Choose a template — _"design your own in the Builder"_ | She chose one — `sparx-restaurant-cafe` — and it is installed and live |

And the two words on those rows are **CMS** and **Builder**. "CMS" is in
`BANNED_IN_PRODUCT_COPY` in `@piggles/config` — the enforceable half of
piggles/CLAUDE.md RULE #3 — and "Builder" is sparx's name for the screen this
console calls **My Site**.

A third row is false in a smaller way: **"Set your site address — Purchase a
domain or connect one you already own."** She already has an address; the account
app told her so ("Every Piggles business gets one from the start"), and the Site
identity pane shows it. And a console that says "purchase" is a console edging
into knowing a price, which RULE #2 says it must never do.

## What should have happened

The checklist reflects what is true about her business, in her words. A list that
tells her to redo work she has done is a list she stops reading — and CLAUDE.md's
own verdict table is explicit: _"works · it told her nothing happened, and
something did · **broken**"_.

Worse than useless, actually: the CTA beside "Choose a template" is **Browse
templates**, which installs a blueprint. Following the instruction would have
stamped a second template over the site she already had.

## How to reproduce

Every time, from a brand-new account:

1. Sign up, complete onboarding, pick any trade and any template.
2. In the console, open **Home → Get set up**.
3. It reads 2 of 6 / 33%, with "Add your first page" and "Choose a template"
   unticked, and the CTA labelled "Open CMS".

Confirmed against the API directly — `GET /v1/tenant/onboarding/progress`
returned `"pageCount": 0` for a tenant with five rows in `builder_pages`, and
`completed.template: false` for a tenant with an `installed` row in
`tenant_blueprint_installs`.

## Why it matters

This is the first screen of the product. It is where a new customer decides
whether the software knows what is going on. Both faults say the same thing to
her — _it did not notice_ — and one of them invites her to overwrite her site.

## Where it lives

Two separate causes, which is why it presented as one confusing screen.

**The words** are api-rest's: `/v1/tenant/onboarding/progress` composes the
titles, descriptions and CTA labels server-side and hands them over as strings
(`wizeworks/services/api-rest/src/routes/v1/tenant.ts`). That service serves both
brands, so its copy is sparx's copy, and Piggles rendered it verbatim.

**The two wrong ticks** are signals that look at the wrong thing:

- `first-page` counted `contentEntry` where `typeKey='page'` — **CMS** pages
  only. A blueprint install creates **builder** pages, so a five-page site
  counted as zero.
- `theme` read `state.completed.template`, a flag written by the dashboard
  wizard's template step and by nothing else. A tenant furnished through
  `/internal/tenant/furnish` — which is how Piggles chooses a template, at signup
  — installs a blueprint and never touches that flag.

Both are brand-blind bugs. A sparx tenant who installed a blueprint was being
told the same two things.

## The fix

**The words — in Piggles, not in the shared service.** New
`piggles/apps/workbench/lib/onboarding/piggles-words.ts`, applied in
`useOnboardingProgress`. Editing api-rest's strings would re-word sparx's
checklist too, and sparx's customers really do say CMS and Builder — those are its
product names. One service, two vocabularies, so the translation belongs on the
Piggles side of the wire. It sits beside `surfaceForHref`, which already
translates the other half of the same payload for the same reason.

It maps through `LEXICON` rather than literals (CMS → Content, Builder → My Site,
CRM → Customers, storefront → shop), and rewrites the domain sentence to start
from the address she already has.

**The two ticks — in the shared service, because both brands were wrong.**
`tenant.ts`:

- `first-page` now counts CMS pages **plus** builder pages. To the person reading
  it a page is a page; which model holds it is our business, not theirs.
- `theme` is now `state.completed.template || an install row exists`. The row is
  the honest signal — if a blueprint was installed, a template was chosen,
  whichever route did it. The flag is still honoured, so nothing that used to
  read done stops reading done.

## Confirmed by

> Re-ran P01 act 4 as Marisol. Opened Home → **Get set up**: **4 of 6 done, 67%**
> (it was 2 of 6, 33%). "Add your first page" and "Choose a template" both carry
> a tick. The remaining two — site address and payments — are genuinely not done.
> The template row now reads "…or design your own in **My Site**", the page row's
> button reads "**Open Content**", and the address row reads "You already have
> one. Use your own web address instead whenever you are ready."
> No occurrence of "CMS", "Builder" or "Purchase a domain" anywhere in the pane's
> text.

## Rating effect

mypiggles › Home › Get set up — Design 7, Ease 3 → 8 (recorded in
[rating.md](../rating.md)).
