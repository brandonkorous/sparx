# 273 — Her Shop page was not in her list of pages

**Status:** worked around for her site · open as a defect
**Severity:** major
**Found by:** P03 · Juniper Row · RULE #8 — reading /shop as a visitor
**Surface:** mypiggles › My Site › Page, against the blueprint install record
**Filed:** 2026-08-26

## What happened

`/shop` is the first item in her navigation and the page every customer passes
through. It read:

```
Shop
Everything we currently have available.
All products
```

Platform copy, in the vendor's voice, on the busiest page of her website — and
**no Shop page in her page list**, so there was nothing to open and nothing to
edit. Home, Each blog post, Each product, About, Each collection, Each category,
Size guide. No Shop, no Cart, no Search, no Contact, no Journal.

The code that writes that sentence knows it is meant to be hers.
[commerce.ts](../../../../wizeworks/packages/silica-catalog/src/commerce.ts)'s
`shopHeader` was written to fix a different bug and says so:

> "A page that is not a record template must not carry record binds, which is why
> this one is **plain text the tenant edits in the studio** rather than a bind
> that can fail to nothing."

She could not edit it in the studio, because the page it lives on was not there.

## What the install record says

Both blueprints this tenant installed define a Shop page, and both recorded it as
installed:

```
sparx                          home, about, blog, book, contact, shop, wholesale
sparx-retail-apparel-minimal   home, about, cart, collections, contact,
                               journal, search, shop, commerce.product
```

Sixteen `tenant_blueprint_install_artifacts` rows of `kind = 'page'`, every one
with a `ref_id` and every one `detached = false` — the record's way of saying
"this page is ours and we still manage it".

**Not one of those sixteen ref_ids resolves to a page that exists.** There is one
property, ten pages under it, and zero overlap. Her pages are named in the
platform's own style ("Home — Landing", "Each blog post", "Each product"), which
is not either blueprint's naming.

**I could not determine what removed them,** and I am not going to assert a cause
I have not proven: two installs twenty-eight minutes apart on a development
database that has also been seeded is more than one candidate. What is not in
doubt is the end state and what it cost her.

## Why it matters beyond the copy

- **A primary nav destination was un-editable and invisible.** Not "hard to find"
  — absent from the only list of her pages.
- **The blueprint's update machinery is pointed at nothing.** `refId` is the
  correlation key the three-way merge uses to find the live row
  ([blueprint-baseline.ts](../../../../wizeworks/services/api-rest/src/lib/blueprint-baseline.ts)),
  and sixteen of them point at deleted rows while still claiming to be managed. A
  blueprint update has nothing to merge into for every page in the design.
- **It contradicts what the code starter does.** `starterPages` installs Shop,
  Cart and Search as real editable pages with exactly this header. So whether an
  owner can edit their own shop page depends on which path built their site,
  which is not a difference anyone chose.

## Worked around for her site

Typing "Shop" into **Name a new page** built the right page immediately: the
`Shop` heading, the standfirst, and the `Product listing · live region` core —
and the editor's footer said **"This is the page your visitors see. Save it to
make it yours."** That recognition is good work and it is what made this a
five-minute repair.

Her standfirst now reads:

> Everything here is cut and sewn in the studio, six of each size in a run. When a
> size sells out it stays out until I make the next one.

Live, with all seven products, the size and color facets working, and its own
search title and description. That is a repair on one tenant, not a fix.

## Also seen on the same page

The listing core renders its own **"All products"** heading directly under her
`Shop` heading and her sentence — two headings in a row saying the same thing,
the second of them the platform's. On a page that now has a real standfirst it
reads as a leftover. Not filed separately; it belongs with whoever takes this one.

## Related

Same family as [270] — the console describing the platform's own default as an
absence — but the other way round: here the default really was all she had, and
nothing told her.

[[feedback_never_present_absence_as_measurement]], and [[feedback_data_is_a_deploy_stage]]:
an install that reports sixteen artifacts installed has to be able to say whether
they are still there.

## Rating effect

The page list, in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
