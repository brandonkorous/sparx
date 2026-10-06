# 054 — 17 of his parts were refused on the way in, and the editor's page links were relative

**Status:** fixed
**Severity:** blocker
**Found by:** P01 · Gillett Diesel Service · act 3
**Surface:** workbench › Move in (Shopify products); the site editor's link box
**Filed:** 2026-10-01
**Fixed:** 2026-10-01
**Confirmed by:** re-imported his file: 653 products, 777 versions, 0 errors; `07-CC-24V19+`, `#80`, `GDS H1/HX`, `0281 006414` all in, at the file's prices. The link-box half is in silicaui source, **not checked** on screen until the next silicaui release.
**Blocked on:** —

## What happened

The first real import of his Shopify file: 643 of 653 products, 17 rows refused.

- **7 SKUs** refused: `07-CC-24V19+`, `#80`, `#70`, `#68RFE`, `GDS H1/HX`, `GDS SPRING`,
  `0281 006414`. sparx allowed only letters, digits, dot, dash, underscore and
  slash. Two of these are on the persona's own hand-check list.
- **9 products** refused: their web names (handles) are up to 145 characters;
  sparx keeps 127. Two of them differ only by a "-copy" past character 127.
- **1 product** refused: his file weighs a $480 catalytic converter at 27,265,891
  grams. One impossible optional figure failed the whole product.
- The results screen showed each reason as raw validation JSON (field paths,
  regular expressions).

Separately, in the editor's link box (silicaui, now 0.58): builder pages were
offered as bare slugs ("contact", "" for Home), which make RELATIVE links
("contact" from a blog post goes to /blog/contact), and record templates
("/products/:handle") were offered as places a link can go. The "links to this
page" count on page delete compared hrefs to slugs by spelling, so "/contact"
never counted for a page whose slug is "contact".

## What should have happened

A business's own part numbers come across as written. A name or a figure the
platform cannot keep is fitted or left off, with a note, never the reason a
product is missing. Every reason reads as a sentence. A link picked from the
list goes to the page from anywhere on the site.

## The fix

- `commerce-schemas` `Sku`: any printable characters; refuses only control
  characters and a space at either end. Tests: his four, plus what it refuses;
  red with the old rule.
- Importer `fitHandle`: a web name over 127 is cut and given a 7-character code
  from the WHOLE name, so it is stable across runs and two long names never
  collide; a note says so, and the old address redirects to the new one.
- Importer weights: an impossible one (over 10 tonnes, or negative) is left off
  with a note.
- Importer `describeError`: field names in words ("SKU: …"), never JSON.
- silicaui `page-href.ts`: `pageHref`, `isTemplateSlug`, `linksToPage`; the link
  box offers "/contact" and "/" and skips templates; `linksTo` compares
  addresses.

Checks: import-worker 82/82, commerce-schemas 573+, silicaui-builder tsc 0.

## Rating effect

Move in: blocker removed.
