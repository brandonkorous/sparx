# 263 — The starter left two pieces of itself on her live site

**Status:** fixed (her site) · open (the starter)
**Severity:** major
**Found by:** P03 · Juniper Row · RULE #8 — building out the site
**Surface:** mypiggles › My Site › Page, and › Header & footer
**Filed:** 2026-08-26
**Blocked on:** scope — the tenant-side repair is done and confirmed; the starter itself is the fix that matters and is bigger than this run

## What happened

Two pieces of the starter were still on her published site, and both had been
visible to every visitor since the day it went live.

### 1. Her About page was registered as a second home page

Her page list:

| Page           | Address                            | Status       |
| -------------- | ---------------------------------- | ------------ |
| Home — Landing | **Your front page** · _Also About_ | Live         |
| About          | **Your front page** · _Also Home_  | Not live yet |

Both were installed with **no address at all**. A page with no address is the
front page — the settings panel says so in as many words, and correctly:

> "Empty means this is your home page — the first thing people see. Give it an
> address like "/about" if it is not."

So the starter installed a page called About and never told it where to live.
`/about` was a 404, and her own navigation links to it from every page.

### 2. Her footer advertised Piggles

```
Juniper Row
Everything you publish and sell, in one place.
```

That is the PLATFORM's product tagline, in the footer of a clothing label's
website, on every page. She had already written her own tagline — _"Made here,
in small runs."_ — in her site settings; the footer does not read it.

Also on the About page itself, a whole second section: **"What you can do here —
Publish / Sell / Grow"**, three cards of Piggles marketing copy about what the
software does, sitting under a heading a customer clicked expecting to read
about her.

## Why it matters

- **"Not live yet" was hiding a broken link, not an unwritten page.** Her nav has
  About on every page. It went nowhere.
- **A tenant's footer is not advertising space.** RULE #8 is explicit that the
  footer carries hours, address, socials and legal links, "not the seed's
  defaults". This one carried the vendor's slogan instead of her address.
- Both are the same shape as the design-refresh notice she gets on Home: content
  COPIED into a site at install, which no later fix reaches. It is why the copy
  has to be right when it is stamped.

## What I did as Devi

- Gave About the address `about`, wrote her real story (_"Made by me, in
  Denver"_), and deleted the Publish/Sell/Grow section. Published.
- Rewrote the footer blurb to her own details — where she works, when the studio
  is open, and how to reach her — and published the site layout.

Confirmed on the live site: `/about` serves her page; `/` is the only front page
now; and all three published pages carry the new footer with no trace of the old
tagline. The layout took about 150 seconds to appear, which is the tenant
payload's five-minute cache doing what it says — the Publish button's own words
are "your site catches up within a few minutes", so nothing here misled her.

## What is NOT fixed

**The starter still does both to the next business that installs it.** The two
repairs above are hers alone; nothing about the starter changed.

The fixes are small and both belong in the starter content:

- the installed About page needs `slug: 'about'`, so it is not a second front
  page the moment it is stamped;
- the footer blurb needs to be the tenant's own tagline (`brand.tagline`, which
  she had already filled in) or empty, never the platform's slogan;
- the About page's second section is Piggles marketing and should not ship into
  a tenant's site at all — a starter may leave a page to be written, but it must
  not leave the vendor's advertising in it.

Left as `open` rather than fixed in this run because it is the seeded blueprint
rather than the surface under test, and it wants checking against the other
starters at the same time — this run only proves the apparel one.

## Also seen while here, and not filed separately

`properties.brand_override.businessName` for Juniper Row reads **"Saffron & Sage
Catering"** — another business's name, left in her brand record by the same
install path. Nothing renders it today, which is the only reason it is not its
own issue; it is the third instance of the same cause.

## Related

Same family as the "design your site was built from has been refreshed" notice
([258]'s 360px defect lives on it): blueprint content is copied, so a fix to the
catalog never reaches a site already built from it.

## Rating effect

The page list and Header & footer, in [rating.md](../rating.md). Recorded in the
run log of [03-juniper-row.md](../03-juniper-row.md).
