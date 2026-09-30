# 850 — One line said HTML was allowed, and five readers disagreed

**Status:** fixed
**Severity:** **major** — the contract for a field every shop's product page is built on was written down twice, differently, and the permissive copy was the one the writers obeyed
**Found by:** P03 · act 295, closing the "measured, not swept" note left open at the bottom of [848](848-the-shopper-read-the-html.md)
**Surface:** `commerce_products.description` and everything that reads or writes it
**Filed:** 2026-09-26
**Fixed:** 2026-09-26
**Confirmed by:** the schema refusing to store a tag, proved red; and a dry run of the repair against the real database

## Where 848 stopped

[848](848-the-shopper-read-the-html.md) fixed the product page and said so:

> The same `description` column is read by api-rest, the console's own product
> pane, the market projection and the email templates. Only the site was fixed
> here, because only the site was measured.

That note was correct to write and wrong to leave. A defect parked as a
measurement is still a defect. [[feedback_defects_are_not_his_decision]]

## The line underneath all of it

```ts
// wizeworks/packages/commerce-schemas/src/products.ts
description: z.string().max(50_000).nullish(), // rich text (HTML allowed)
```

Everything a person touches says the opposite, and had for longer:

| what                              | treats it as                               |
| --------------------------------- | ------------------------------------------ |
| the console's editor              | a bare `<Textarea>`                        |
| its own help sentence             | "Say what someone would ask you in person" |
| the site's renderer               | text, split at blank lines (issue 191)     |
| `<meta name="description">`       | text                                       |
| the JSON-LD a search engine reads | text                                       |

There is no rich-text editor for this field anywhere in either console, and
never has been. **One stale comment and a permissive cap were the whole
disagreement**, and they were on the side the writers obeyed.

So the contract is now stated where it is enforced:

```ts
description: PlainTextField(50_000).nullish(),
```

A write through any surface stores what the column is supposed to hold. The cap
is applied to what was **sent**, not to what is kept, so 60k of markup that
strips down to eight characters is still refused rather than quietly accepted.

## The four readers that were not the site

### 1. Both consoles carried a stripper that ate her sentences

```ts
description.replace(/<[^>]*>/g, ' ');
```

That is not "remove the tags". It matches from a `<` to the **next** `>`
wherever they fall:

```
written   Fits anything < 3 inches across, weighs > 2oz.
shown     Fits anything   2oz.
```

An owner writing about sizes lost the middle of her own sentence, in the box
that previews how her product looks in a search result. It also left `&amp;` on
the screen as `&amp;`. Both consoles, same code, same field.

`looksLikeMarkup` exists precisely to ask the question that strip does not, and
has a test for `a < b`. The consoles never called it. A rule fixed in one of
several renderers is the shape this keeps taking.
[[feedback_a_fix_leaves_its_neighbour_behind]]

### 2. The search index made `strong` a searchable word

```ts
description: product.description ?? undefined,
```

The raw column went into Typesense. So the tags were tokenized: a shopper
searching **strong** matched every product that merely had bold text in its
description, and a result snippet could open with `<p>`.

### 3. Dropship imports wrote supplier HTML straight in

```ts
const product = await tx.product.create({
  data: { description: data.description ?? null, ... },
});
```

A direct write, so the schema never saw it. Printful and DSers both send HTML
descriptions as a matter of course. Every import put markup into a plain-text
column, and would have kept doing so after the schema was fixed. The import
**preview** showed the tags too, so she could see what she was about to get and
not know it was wrong.

### 4. The public API served it raw

`publicProduct` is what a headless client, the MCP catalog read and the site's
own loader all receive. It passed `row.description` through untouched.

### And one the note got wrong

**No email template reads a product description.** Checked every template in
`@wizeworks/email`. The note listed it; it is not there.

## One rule, in one place

`plainText` was living in `wizeworks/apps/site/lib/`, which is why nothing else
could use it. It now lives in `@wizeworks/commerce-schemas` beside the field it
describes, and all four trees already depended on that package, so nothing new
was wired up to reach it.

```
schema      PlainTextField     normalizes every write
api-rest    plainTextOrNull    the public read, the dropship preview and its write
search      plainTextOrNull    what gets indexed
consoles    plainText          the editor box and the search-result preview
site        plainText          the page, the meta description, the JSON-LD
```

Five callers, one function. They cannot disagree, because there is nothing for
them to disagree with.

## The rows already written

A source fix reaches the next write and never the shops already open — issue
073's lesson, and the half that would have made this a no-op.

Every reader now cleans on the way out, so **nobody sees a tag today**. What is
left is the stored rows, and they matter for one reason: a reader added later,
doing the obvious thing, would bring the defect straight back.

```
DRY-RUN: 188 of 577 product description(s) carried markup, across 9 business(es)
```

`wizeworks/packages/commerce/scripts/backfill-plain-descriptions.ts` imports the
same `plainText`. A hand-written SQL version of the same regexes is exactly the
drift this fix exists to remove. Dry-run by default, idempotent, and **run on
2026-09-28** once authorized:

```
APPLIED: 188 of 577 product description(s) carried markup, across 9 business(es)
```

Re-measured after: **0 of 568** carry markup, and a second run reports 0.

188, not the 185 in 848. That count came from `LIKE '%</p>%'`; three rows carry
only `<br>`, `<strong>` or `<li>`.

## Proved

**24 tests** in the schema package, including the two that state what changed:

```
✓ ate the words between a less-than and a greater-than   (the old strip, asserted failing)
✓ normalizes on create
✓ normalizes a translation too, so no locale keeps the tags
✓ measures the length of what was SENT, not of what is kept
```

**Proved red:** putting `z.string().max(50_000)` back reddens exactly 2, and
leaves the 18 that hold the rule itself. [[feedback_a_test_that_cannot_go_red]]

## Files

- `wizeworks/packages/commerce-schemas/src/plain-text.ts` (moved here from the site app; `plainTextOrNull` + `PlainTextField` added)
- `wizeworks/packages/commerce-schemas/src/plain-text.test.ts` (moved; 12 tests → 24)
- `wizeworks/packages/commerce-schemas/src/products.ts` (three declarations)
- `wizeworks/packages/commerce-schemas/src/index.ts`
- `wizeworks/packages/commerce/src/search-projection.ts`
- `wizeworks/packages/commerce/scripts/backfill-plain-descriptions.ts` (new, not run)
- `wizeworks/packages/commerce/package.json`, `tsconfig.json`
- `wizeworks/services/api-rest/src/routes/v1/public/commerce.ts`
- `wizeworks/services/api-rest/src/routes/v1/dropship/suppliers.ts`
- `wizeworks/apps/site/` — five files repointed at the shared rule
- `{piggles,sparx}/apps/workbench/surfaces/commerce/product-seo.tsx`
- `piggles/apps/workbench/surfaces/commerce/product-overview-draft.ts`
- `sparx/apps/workbench/surfaces/commerce/product-overview.tsx`

## The thing to remember

**848 fixed the renderer and left the contract.** Stripping tags at the point a
shopper reads them is the right emergency move and the wrong resting place: it
fixes the one reader you were looking at and leaves the field still declared as
something it is not, so the next reader written against the declaration is wrong
again. The comment that said "rich text (HTML allowed)" was four words long and
outranked five screens.
