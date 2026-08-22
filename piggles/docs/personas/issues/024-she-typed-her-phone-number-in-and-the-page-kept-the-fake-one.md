# 024 — She typed her phone number in, and the page kept the invented one

**Status:** fixed
**Severity:** major
**Found by:** P01 · Thistle & Rye · act 7 — after acting on [023](023-a-box-that-took-her-words-and-changed-nothing.md)
**Surface:** mypiggles › My Site › Page — the canvas, on any page binding `site.identity.*`
**Filed:** 2026-08-20
**Fixed:** 2026-08-20
**Confirmed by:** P01 · act 7, on the screen

## What happened

[023](023-a-box-that-took-her-words-and-changed-nothing.md) sent her to the right
place: **Your site → How customers reach you**. She typed her phone number, her
email address and 114 Mercer Lane, pressed Save, and got "Your site identity was
saved."

Back on the Contact page, the canvas still read:

> **Call us** (555) 123-4567
> **Email us** hello@yourbusiness.com

A full reload changed nothing. As far as the editor was concerned, the details
she had just entered did not exist.

## What should have happened

The page draws her number the moment it is saved, without touching the page at
all — which is the entire reason those two nodes are bound.

## Why it happened

The builder's canvas resolves bindings against a preview root built in
`lib/studio/preview-data.ts`. Its identity carried **four** fields:

```ts
export interface SiteIdentityPreview {
  name: string;
  tagline: string | null;
  logo: …;
  logoDark: …;
}
```

The live site's identity carries **nine** — those four plus `phone`, `email`,
`address`, `phoneHref` and `emailHref`. The API already returned all of them
(`contact` on `/v1/public/tenants/:slug`); the console's own type for that
payload just did not declare the field, so nothing read it.

An unresolved binding correctly falls back to the words in the tree, and the
words in the tree are the blueprint's invented ones. So a value that was
**missing** rendered exactly like a value that was **set**, which is the shape
this run has now hit four times.

## How to reproduce

Before the fix, every time:

1. **Your site → How customers reach you** — fill in a phone number, Save.
2. **My Site → Page → Contact**, reload the pane.
3. It still shows `(555) 123-4567`.

## Why it matters

The owner did exactly what the product told her to, it reported success, and the
screen contradicted it. The likely next move is to go back and type over the page
itself — which is [023](023-a-box-that-took-her-words-and-changed-nothing.md)'s
dead end — or to conclude the details did not save and enter them somewhere else.

It also hid a second defect for as long as it lasted: with the bindings
unresolved, [025](025-the-link-showed-its-own-address-where-the-phone-number-belonged.md)
could not fire.

## The fix

`SiteIdentityPreview` now mirrors the live site's identity field for field, and
`useSitePreview` reads the `contact` the endpoint was already sending —
composing `phoneHref` with the same `telHref` rule the site uses, because an
attribute binding fills a value verbatim and cannot prefix it.

Trimmed-or-`null`, never `''`: an empty string is a KNOWN-but-empty value that
the resolver fills OVER the authored words, which would blank the node instead of
leaving the placeholder the owner still needs to see.

## Where the fix lives

- `piggles/apps/workbench/lib/studio/preview-data.ts` — `SiteIdentityPreview`
- `piggles/apps/workbench/lib/studio/site-data.ts` — `PublicTenantChrome.contact`,
  `telHref`, `orNull`
