# 067 — The error page on her website introduced itself with a label

**Status:** fixed
**Severity:** design
**Found by:** P01 · Thistle & Rye · act 8 (crashing the page was my own doing)
**Surface:** thistleandrye.piggles.site › any page that throws
**Filed:** 2026-08-21
**Fixed:** 2026-08-21
**Confirmed by:** P01 · Marisol · on screen 2026-08-21

## What happened

I overwrote the storefront's DOM while building a test harness and tripped its
error boundary. It rendered:

> **SOMETHING WENT WRONG**
> This store couldn't load

The first line is uppercase mono, above the heading, introducing it. That is an
eyebrow, which root RULE #2 bans outright — and this is platform chrome in
`wizeworks/apps/site`, not tenant content, so the ban reaches it. Both error
boundaries had one.

Reading them properly turned up three more things in the same forty lines:

- **"This store couldn't load."** Thistle & Rye is a bakery with a shop, so it
  happens to read alright — but a publisher and a CRM-only team render this same
  file, and neither has a store. Content and/or commerce is a CORE rule.
- **Faded readable text.** The explanation was `opacity-70` and the reference
  code `opacity-50`, both text a person is meant to read (RULE #3).
- **Body text at 15px, actions at 14px**, under the platform's 16px floor. The
  reset button was hand-built from raw `btn btn-primary` classes and the second
  action was a bare underlined anchor, where the not-found page beside it uses
  real components.

## What should have happened

The same page `not-found.tsx` already is, one file over: the heading carries
itself, the ink is real, the type clears the floor, and the words do not assume
what kind of business this is.

## How to reproduce

Make any page under `wizeworks/apps/site` throw during render. Every time.

## Why it matters

It is a tenant's customer, on a tenant's website, at the moment something has
gone wrong — the one screen where the shop most needs to look like it is still
run by someone competent. And "SOMETHING WENT WRONG" in mono caps reads as a
stack trace to a person who did not ask for one.

## Where it lives

- [wizeworks/apps/site/app/error.tsx](../../../../wizeworks/apps/site/app/error.tsx)
- [wizeworks/apps/site/app/global-error.tsx](../../../../wizeworks/apps/site/app/global-error.tsx)

## The fix

Both rewritten against `not-found.tsx` as the house exemplar — same layout, same
voice, same reader.

`error.tsx` renders inside the tenant's layout, so it uses the real components:
`<Button color="primary" size="lg">` for Try again, and a colorless
`<ButtonLink size="lg">` for the way out — no color and no variant, since the
escape from an error has no meaning to carry and `neutral` is not mine to choose.
Ink is `text-base-content` throughout, body is `text-lg`.

`global-error.tsx` keeps its inline styles, and that is deliberate: it only fires
when the ROOT layout threw, at which point Next has replaced the document and no
stylesheet, theme or token exists to reach for. It is the one file in the app
where an inline rule is the only thing that can work, and the header comment now
says so. Its palette stays light and hardcoded because the tenant's theme died
with the layout — a dark-mode reader gets a light card for the seconds it is up,
which is noted in the file rather than papered over.

The reference code is now worded as the errand it is — _"If you let them know,
quote a1b2c3."_ — instead of a field name, because reading it to the shop is the
only thing a customer can do with it.

## Confirmed by

Re-run on 2026-08-21 against a route made to throw on purpose (added, looked at,
deleted). The page reads:

> # This page didn't load
>
> Something went wrong at our end, not yours. Trying again often works — and if it
> doesn't, the rest of the site is still here.
>
> **[Try again]** [Go to the front page]
>
> If you let them know, quote 2968949585.

Measured on the page rather than eyeballed:

- **no eyebrow** — nothing above the heading
- **`fadedReadableText: []`** — no `opacity-*`, `text-soft` or `text-muted` on anything readable
- **`Try again → btn btn-primary btn-lg`** and **`Go to the front page → btn btn-lg`** — a real primary, and a colorless second action
- no mention of a store

And it renders inside **her** header, footer, type and colors, which is the part
that makes it read as her shop having a bad moment rather than the software
breaking.
