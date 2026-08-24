# 010 — Her bakery's web address is "quiet-haven-3783", and she cannot change it

**Status:** fixed — the new-site half confirmed; the onboarding half awaits a fresh signup
**Severity:** major
**Found by:** P01 · Thistle & Rye · act 3
**Surface:** getpiggles › Your account › Your business address · mypiggles › Domains
**Filed:** 2026-08-19
**Fixed:** 2026-08-19 (the derivation) · 2026-08-24 (offering it)
**Confirmed by:** signed up a fresh business called "The Marrow Review" through the real screens — its address came out `marrow-review.piggles.site`, shown as such on the account page
**Blocked on:** —

## What happened

Marisol types **Thistle & Rye** into the one question onboarding asks about her
business. The tenant is renamed, the site is renamed, the invoice header is
renamed. Her **web address** is not:

> **Your business address**
> Every Piggles business gets one from the start. Point your own domain at it
> whenever you are ready.
>
> **quiet-haven-3783.piggles.site**

That is the address on her account page, in the Site identity pane, in the
Domains list, and on the site a customer would actually reach. Nothing about it
says "bakery", or "Thistle", or anything a person could remember or repeat down
the phone.

Then it gets worse. Opening it in Domains → the address → the whole pane reads:

> **Nothing to set up**
> We look after this address, so there is nothing for you to set up and nothing
> that can break. Every site gets one free, it works from the minute you sign up,
> and it keeps working even after you connect your own domain — **it can never be
> removed, because it is your site's permanent back-up address.**

So it is not a placeholder she can tidy up later. The product tells her, in
plain words, that `quiet-haven-3783` is permanent.

## What should have happened

`thistle-and-rye.piggles.site`. She told the product what the business is called
in the same form; the address is one of the three things that name decides, and
the other two got it.

## How to reproduce

Every time, before the fix:

1. Sign up and complete onboarding with any business name.
2. Open `localhost:3021/account` — "Your business address" is an
   adjective-noun-number phrase.
3. In the console, Domains → the address → no way to change it. Sites lists it as
   read-only text.

## Why it matters

The web address is the thing she gives to customers, prints on a card, and reads
out over the counter. "quiet-haven-3783 dot piggles dot site" is not sayable, and
it makes the site look like a temporary demo rather than her business.

It also undercuts the pitch directly. meetpiggles promises "Your website, and a
Piggles address for it"; the account page says every business "gets one from the
start". Both are true and neither is what she got.

## Where it lives

`wizeworks/packages/auth/src/friendly-slug.ts` generates the placeholder at
sign-up, and its own comment names the step that was supposed to resolve it:

> at sign-up the user doesn't yet know what they're building, so we hand them a
> unique, readable placeholder and **let them personalize it in the onboarding
> Workspace step.**

**Piggles has no Workspace step.** Its onboarding is two questions and a look, by
design (RULE #1 — simplification comes from hierarchy and defaults, not from
capability). The placeholder was correct; the step that was meant to replace it
does not exist here, so it never got replaced.

`piggles/apps/account/app/onboarding/actions.ts` renamed the tenant and the
primary property in one transaction — with a careful comment about not leaving a
business "sending real receipts under a name nobody chose" — and did not touch
the slug, which is the same mistake one field over.

## The fix

New `piggles/apps/account/lib/business-slug.ts`, called from the same transaction
as the two renames, so the name and the address land together or not at all.

- `slugifyBusinessName` — `&` becomes **and**, not nothing: "Thistle & Rye" is
  said "Thistle and Rye", so `thistle-and-rye` is what somebody would type and
  `thistle-rye` is a word nobody uses. Accents fold (Tomás → `tomas`) rather than
  dropping a character. A leading "The"/"A"/"An" is stripped when something
  survives. Capped at 63 characters on a word boundary — a DNS label's limit, and
  the column's.
- `claimBusinessSlug` — takes it only if free. `tenants.slug` is unique across
  **both brands** (one tenant pool, one index), so it asks the whole table.
- **Never fails onboarding.** A taken or unusable name keeps the placeholder
  silently. Nobody is blocked from starting a business because somebody else got
  to "thistle-and-rye" first.

Safe at this moment specifically: it runs seconds after sign-up, before anything
is published and before any customer has seen the old address.

## Confirmed by

> Signed out and signed up a genuinely new business through the real screens —
> `p01.slugcheck@piggles.test`, business name **"The Marrow Review"**, trade
> "Something else". Its account page reads **marrow-review.piggles.site**, and
> the database agrees (`select name, slug from tenants` → `The Marrow Review |
marrow-review`). The leading "The" was stripped, as intended.
>
> Signed back in as Marisol afterwards and confirmed her business is untouched:
> still `Thistle & Rye`, still `quiet-haven-3783`, all data intact.

That verification tenant is deliberately left in place (persona CLAUDE.md — do not
delete records). It is a Piggles tenant named "The Marrow Review" and should not
be confused with **P09**, which will sign up its own account when its run starts.

## What is still open — and it is the part that hurts Marisol

The fix is for businesses created **from now on**. Marisol's address is still
`quiet-haven-3783`, and there is nowhere in the console to change it — the
Domains detail says explicitly that it never can be.

That is a product decision, not a bug to be quietly patched, because the free
address is load-bearing: published sites resolve on it, it is the permanent
fallback after a custom domain is connected, and it is the Better Auth
organisation slug. Three ways to answer it, for Brandon:

1. **A grace window.** The address is editable until the site is first published
   — which is exactly the window where nothing can break, and covers every case
   like Marisol's. Cheapest, and honest with the "permanent back-up address" copy
   because it stays permanent once it matters.
2. **Editable always, with a redirect.** The old address 301s to the new one
   forever. Correct for a business that rebrands, and the most work: a mapping
   table, and the old slug can never be reissued.
3. **Never editable, and say so up front.** Then onboarding must SHOW the address
   it is about to give her, beside the name field, so she sees it while she can
   still influence it. This is the only option that needs an onboarding change
   rather than a console one.

Until one is chosen, an existing business with a placeholder address has no
recovery, and that should not be discovered a second time by P02.

## Decision — 2026-08-24, Brandon

**A web address is an identifier, and identifiers do not change.** So the answer
to "let her change it afterwards" is no, and the redirect/alias machinery this
issue was weighing is not needed.

What IS owed is the chance to set it in the first place:

- **at onboarding**, when the business is created, and
- **when a new site is added** to an existing business.

Today it is generated and never offered, which is the whole reason somebody ends
up living with `quiet-haven-3783`. Asking once, at the only two moments the
answer is free, removes the need to ever change it.

## Built — 2026-08-24

Brandon's decision above, in both places.

### At onboarding

Onboarding was two questions; it is three. Under "What is your business called?"
there is now **Your web address**, filled in from the name as she types it, with
`.piggles.site` shown beside the field rather than described, and the whole thing
checked against the tenant table while she is still looking at it:

> Your web address · **thistle-and-rye** .piggles.site
> ✓ thistle-and-rye.piggles.site is yours.

Four things that make it honest rather than decorative:

1. **The suggestion is visible, so it can be argued with.** The derivation from
   August 19 was correct and invisible; a value nobody sees is a value nobody
   chose, which is the whole of this issue.
2. **A taken address is now an ERROR, not a silent fallback.** It used to keep the
   placeholder when the name was gone — right while the field did not exist, and
   [exactly the wrong thing](../rating.md) now that she is looking at one. Handing
   her a different address without saying so would be this bug one screen later.
   The error names the field and she edits it.
3. **It is checked as she types**, not at submit. Finding out the address is gone
   after answering three other questions is the version of this people abandon.
   Session-gated: an open endpoint answering "does this business exist" is a
   customer list with a keyboard.
4. **Reserved labels are refused** — `customers` above all, since that is the CNAME
   target every custom domain on the platform is pointed at.

The string rules moved to `lib/address-rules.ts` so the browser and the server
share one copy; `lib/business-slug.ts` keeps the half that touches the database,
and the onboarding transaction moved out to `lib/onboarding-save.ts`.

### When a new site is added

The handle field already existed here and explained itself:

> Used in the site's first web address. Cannot be changed afterwards.

A sentence somebody agrees with without ever picturing the result. It now shows
the result, live:

> Your site will be at **workshops.juniper-row.piggles.site**. It cannot be
> changed afterwards, so it is worth a moment now.

The business half of that is read off the address the main site is already served
at, which is exactly how api-rest mints it — and it is `null` rather than a guess
when there is no such row, because a wrong preview of a permanent address is
worse than none.

Before a handle is typed it says what the address will sit under, so the empty
field is not silent either.

## Confirmed — the new-site half

As Devi, at 1296px and again at 360px, in dark:

- Bookings aside, Settings › Sites › New site. Typed **Juniper Row Workshops** and
  the address read `juniper-row-workshops.juniper-row.piggles.site` — stuttery,
  and visibly so, which is the point: shortened the field to `workshops` and
  watched it become `workshops.juniper-row.piggles.site`. Before this she would
  have accepted the first one without ever seeing it.
- No site was created. The address is what was under test, so the field is where
  it was proved.

Finding the preview also found [181](181-she-typed-plant-care-and-the-address-came-out-plantcare.md):
a hyphen could not be typed into that field at all.

## Still owed

**The onboarding half has not been driven yet.** It needs a genuinely new signup,
and `localhost` cookies ignore the port — signing up on :3021 replaces Devi's
console session on :3022. It is queued with
[091](091-the-products-in-her-brand-new-shop-belong-to-another-company.md)'s
fresh-signup check for the end of the P03 run, where one signup confirms both.
Until then this is **not checked** rather than fine.

## Rating effect

getpiggles › Your account — Ease 7 → 8 · mypiggles › Domains › address detail —
Ease 4 ("nothing I can do here, and it will not say why the address is what it
is"), recorded in [rating.md](../rating.md).

The Domains detail's copy is now TRUE rather than merely unhelpful: the address
really is permanent, and it is permanent because she chose it. That pane should
still say WHERE it was chosen, so somebody who does not remember doing it is not
left thinking the product picked for them. Not yet written.
