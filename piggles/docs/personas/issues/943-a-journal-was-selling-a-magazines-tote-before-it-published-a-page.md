# 943 — A journal was selling a magazine's tote before it published a page

**Status:** fixed (act 6)
**Severity:** major
**Found by:** P09 · The Marrow Review · act 6, looking at her site before building it
**Surface:** her public site, and the design installer (`api-rest` `blueprint-installer.ts`, both consoles' Ready-made sites)
**Filed:** 2026-10-07
**Fixed:** 2026-10-07
**Confirmed by:** P03's test business Juniper Row Mending, a design added to a new site with its products left as drafts, then put on sale by the design's Publish
**Blocked on:** —

## What happened

Rosalind had published nothing: no page, no design. Her site at
`the-marrow-review` was the platform's starter, "Welcome. Have a look around the
shop", and under **Shop our products** it sold ten things with Add to cart:
The Meridian Tote ($26), The Meridian Quarterly annual membership ($96), Rowan
Enamel Mug ($18) and seven more. Her journal sells nothing; her persona file
says a basket or a price on this site is the finding.

They were the example products of the two designs on her site: six from the
starter laid down at signup, four from **Longform Literary**, the look she
picked. Both installs were still drafts. The design page itself says:
"Everything comes in as drafts you can change, and nothing is live until you
publish it."

The installer wrote each new product with the status the design declared,
`active`. Only the design's own **Publish it live** was meant to turn products
on; its code says so ("Products → active"). Articles already worked that way
(issue 377): drafts at install, published by go-live. Products never did, so
every signup that picked a look with products put somebody else's merchandise on
sale on its public site.

## The fix

- A product the installer creates is a **draft**, and the result records the
  status the design gave it (`declaredStatus`), the same arrangement as articles.
- **Publish it live** turns on the products the design declared `active`.
  Installs recorded before this carry no `declaredStatus` and were installed
  active already, so nothing changes for them.
- A product reused from an earlier install is untouched, as before.

## Proof

- On screen, Juniper Row Mending (a test business): Ready-made sites, Couture
  Serif, **A new site** named Mending Atelier, **Make the site**. Its 12 example
  products: **draft 12**. The same design installed on Juniper Row before the
  fix: active 12. **Publish it live on Mending Atelier**: **active 12**.
- api-rest typechecks; the installer, baseline and example-check unit tests pass
  (19). The example check reads a draft as different from the design's
  `active`, which is right: nobody can see a draft, and it reports the product
  once go-live has made it what the design shipped. No unit test reaches product
  creation; the integration suites need the database and were not run.

## Not changed

- Rosalind's ten products were made before the fix and are still on sale. She
  takes them down herself in act 6.
