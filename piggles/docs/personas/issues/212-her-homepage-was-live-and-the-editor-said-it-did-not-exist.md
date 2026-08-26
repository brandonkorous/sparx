# 212 — Her homepage was live, and the editor said it did not exist

**Status:** fixed and confirmed
**Severity:** blocker
**Found by:** P03 · Juniper Row · act 5
**Surface:** mypiggles › Website › a page — and every page of the tenant's website
**Filed:** 2026-08-25
**Fixed:** 2026-08-25
**Confirmed by:** P03 · Juniper Row · act 5, on screen, page rebuilt and published

## What happened

Devi opened her home page to write it. The editor showed an empty white canvas,
one line in the Layers list — `Page` — and, along the bottom:

```
Nothing saved on this page yet.
```

Her website, at that same moment, was serving a complete homepage:

```
Your work, beautifully online.
Publish your pages, tell your story, and sell when you are ready — all from
one place. This is your homepage; edit every word to make it yours.

  [Browse the shop]  [Learn more]

Shop our products
  The Everyday Tee $42 · Silk twill scarf $58 · Leather-covered belt $72 ·
  Sunday Trouser $110 · Marlow Knit $96 · The Ash Overshirt $128 ·
  Linen Shirtdress $145

Featured
  (the same seven again, in the same order)

Ready when you are.
Add a product, publish a page, or invite your team — start with whatever
comes first.
```

The page instructs her to edit every word. The editor is where she would do
that, and the editor could not see the page.

## What should have happened

The editor opens the page the website is serving.

## Why it matters

Three separate things were wrong at once, and each one on its own would be
enough.

**She cannot edit her own website.** Personas RULE #8 says the website is the
deliverable. Hers was un-authorable — not broken, not erroring, simply invisible
to the one screen built for changing it.

**What she does build would have silently replaced it.** She would have started
from the empty canvas, built a homepage, pressed Save, and only then discovered
that Save was an overwrite of five sections she had never seen. Nothing on the
screen said so.

**It was publishing copy she did not write, in her name.** "Add a product,
publish a page, or invite your team" is Piggles talking to Devi. It was on the
public homepage of a clothing business, addressed to her customers. Same family
as [210](210-her-clothing-shop-was-branded-as-a-catering-company.md): platform
scaffolding reaching a real audience because nobody could see it to take it down.

And the "How your pages do" report scored it:

```
Home — Landing    0 people    0 times opened    Not measured
```

Zero. It is the page every visitor lands on. The traffic is real, it is just
attributed to a row that is not the page being served — so the one screen that
would have told her something was wrong reported nothing, calmly. Another
absence rendered as a measurement, the platform-wide failure this run keeps
re-finding.

## Where it lives

Two starter systems, and the seed still wrote the retired one.

Silica is what the platform renders and what the platform edits. The storefront
reads published silica trees, falling back to the code starter when a property
has published none — `wizeworks/apps/site/lib/silica.ts` says so:

> the storefront still renders silica by falling back to the code `starterSite`
> … so a fresh tenant's site is live from day one instead of blank.

That fallback is right, and it is what her visitors were reading.

But `listOrSeed` in
[page-service.ts](../../../../wizeworks/packages/builder/src/services/page-service.ts)
seeds a property that has no pages from `STARTER_PAGES` — the **legacy** set —
writing `draftTree` and nothing else:

```ts
await tx.builderPage.createMany({
  data: STARTER_PAGES.map((s, i) => ({
    …
    draftTree: asJson(s.tree),
  })),
});
```

Nothing downstream reads that column. The renderer reads silica. The page
switcher reads silica. So the rows exist, are listed, and open empty.

`loadPage` in
[site-service.ts](../../../../wizeworks/packages/builder/src/services/site-service.ts)
completed the trap:

```ts
const stored = row.silicaDraftTree != null;
root: stored ? asNode(row.silicaDraftTree) : stampTree(pageBody([])),
```

`load` — the whole-site half — already handles this correctly, and says why:
_"With no pages at all the studio opens on `starterSite`."_ `loadPage`, its own
docstring's "per-row half of `load`", did not. One half opens the starter; the
other opens nothing. The workbench uses the half that forgets.

**How she got there.** The audit trail is unambiguous about the sequence and
silent about the intent:

```
00:52:37.333  builder.email.deleted   ×2
00:52:37.352  builder.page.deleted    ×4      ← her silica pages
00:52:37.388  sitebuilder.theme.deleted
10:33:43.788  builder.pages.seeded            ← the legacy four
```

`siteService.reset` deletes silica-only page rows, and its docstring promises
"the next `load` returns null and the editor re-opens on the CURRENT starter
seed." It would have — except the next `GET /v1/builder/pages` ran first and
materialized the _retired_ seed, which is not null, so `load` never got the
chance. **The one door back into the old tier was the seed meant to get you out
of it.**

That the door exists at all is the finding. `ops:retire-legacy-tier` was written
to empty this tier, and its header describes Devi's site exactly, months before
she had one:

> a tenant with a real, published, authored Home serves "Your work, beautifully
> online." to every visitor … the site is half platform-generic and half the
> tenant's, and no screen anywhere says so.

A script that drains a pool is not a fix while something is still filling it.

## The fix

Two changes, and they are the same idea from both ends: **the editor and the
website must be looking at one site.**

**1 · A page with no body of its own opens on the body the site is serving.**
`loadPage` now matches a row to the starter the storefront would render for it —
the slugless singleton to the site root, any other singleton by its address, a
record template by its record type — and re-mints the ids, because those trees
are code-authored and shared by every tenant. It carries a new `starter` flag so
the pane can tell "unsaved" from "blank", which `stored` alone could not.

This is what heals every property already in this state, on open, with no
migration and no script run — the same property that made
[210](210-her-clothing-shop-was-branded-as-a-catering-company.md)'s fix worth
choosing.

**2 · The seed stops minting new ones.** `listOrSeed` and `ensureHome` now seed
`starterPages(modules)` as **silica** rows, so a fresh property — or the one
after a reset — gets pages that both the renderer and the editor can see. The
module flags come from the same read `GET /v1/builder/site` does, so a business
that does not sell gets no Shop page and one without Scheduling gets no Book
page. Record pages are deliberately left to `load`'s `ensureRecordPagesTx`:
seeding them from two places is how a property ends up with two rows claiming
`/products/:handle`.

The legacy `draftTree` column is written blank rather than left absent, because
`reset` reads a null `publishedTree` as "silica-only, safe to delete" — which is
what these rows are.

**The first version of this fix was wrong, and it is worth recording.** I matched
a row to its starter by address, treating a slugless singleton as the site root —
which is what every other reader in the platform does, and what `homeWhere` says.
Her About page then opened showing her homepage. The legacy seed writes **no slug
on any page**, so all four of her rows looked like the root. Only the row the
property's home query actually returns gets the root starter now; the rest match
by address, or by name when a legacy row has no address left to identify it with.
The screen caught this, not the types — a defect about two pages being confused
for each other cannot be seen from one of them.

**What the message says now.** "Nothing saved on this page yet" was true about
the database and false about the world, and it was printed over the page her
customers were reading. It is now:

```
This is the page your visitors see. Save it to make it yours.
```

## What it looked like once fixed

The same page id, the same editor, reopened:

```
Page
  Section    Your work, beautifully…  ·  Publish your pages…  ·  Browse the shop  ·  Learn more
  Section    Shop our products  ·  Group ▸ Link ▸ Image / Product name / $0.00 / Sold out
  Section    Featured  ·  Group ▸ …
  Section    Ready when you are.  ·  Add a product, publish…  ·  Get in touch
```

Every section, every word, editable — and the status line reading **"This is the
page your visitors see. Save it to make it yours."**

Devi then wrote it, which is the actual proof. Her homepage is now live at
`/`:

```
Made in small runs.
Everything here is cut and sewn in small batches. When a size goes, it does
not come back.
  [Browse the shop]  [Learn more]

New in
  The Ash Overshirt $128.00 · Linen Shirtdress $145.00

The core range
  The Everyday Tee $42.00 · Sunday Trouser, wide leg $110.00 · Marlow Knit $96.00

Not sure on size?
Tell me what you usually wear and I will tell you which of ours will fit.
I answer these myself.
  [Get in touch]
```

Two product bands on one page, each showing its own group and only its own
group — which also confirms
[211](211-the-block-that-sells-products-could-only-ever-sell-everything.md) end
to end, on a real page, for the first time.

## Rating effect

`Website › a page` in [rating.md](../rating.md) — the pane could not open the
tenant's own page, which is the whole job. Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
