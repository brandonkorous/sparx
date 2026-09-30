# 848 — The shopper read the HTML

**Status:** fixed
**Severity:** **major** — 185 live product pages across 9 businesses printed their own markup to customers
**Found by:** P03 · act 294, opening a product on P09's site as a stranger
**Surface:** Every tenant site's product page
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** the rendered page before and after, on a live site

## What a customer read

```
<p>A hard enamel pin with a polished metal finish and crisp, raised color fill — the
good kind that feels like a keepsake, not a giveaway. Backed with a rubber clutch that
actually holds, so it stays put on a jacket, bag, or lanyard.</p><p>About 1.25 inches,
individually carded. A small, easy add-on that people genuinely keep.</p>
```

On the page. In a `<p>` element, as its text. The tags were not markup; they were
the sentence.

## Why

A product description is a **plain-text field**, and everything that touches it
agrees except the thing that fills it.

The console edits it in a bare `<Textarea>`:

> **Description** — Shown on the product's page. Say what someone would ask you
> in person.

The site renders it as text, split at blank lines, deliberately: a tenant's own
words are never injected as markup into their own site, and the splitter's
comment names the reason it exists (issue 191, six paragraphs arriving as a
twenty-five-line wall).

**The sample-data packs write HTML into it.** All eleven of them:

| tags across `packs/*.ts` |     |
| ------------------------ | --- |
| `<p>` … `</p>`           | 189 |
| `<li>` … `</li>`         | 36  |
| `<strong>` … `</strong>` | 20  |
| `<h3>` … `</h3>`         | 16  |
| `<ul>` … `</ul>`         | 7   |

Every business that installs sample data gets product pages showing tags, and an
owner who opens that product in the console sees the tags in her textarea too.

## How many, asked of the database

```
185 of 577 product descriptions carry markup, across 9 businesses
```

Not a corner case. It is most of the demo catalog on this machine, and every one
of those pages is public the moment the tenant's subscription is active.

## The fix, both halves

**The source.** All eleven packs converted: `</p><p>` to a blank line, a heading
and each list item to their own paragraph, `<strong>` to nothing but its words.
**536 tags**, no line of source moved, prettier clean, and the only angle brackets
left in the packs are four TypeScript generics.

**The rows already written.** A source fix reaches the NEXT install and never the
shops already open — that is issue 073's lesson, learned on this same bakery, and
it is the half that would have made this report a no-op.

```ts
// wizeworks/apps/site/lib/plain-text.ts
export function plainText(text: string | null | undefined): string;
```

Used everywhere a description reaches a reader: the silica product record and its
paragraph split, the builder product record, the product-description section, the
page's `<meta name="description">`, and the JSON-LD a search engine prints in a
result card.

**A block becomes a break, not nothing.** Collapsing `</p><p>` to an empty string
would run four paragraphs into one sentence, which is a different way of being
wrong on the same page.

**An ordinary sentence comes back untouched.** "Fits anything < 3 inches across"
and "a < b" are not markup, are not stripped, and have a test each.

## Proved

12 tests, including the two that matter most:

```
✓ leaves ordinary words exactly as they are
✓ keeps the paragraphs apart rather than running them together
```

**On the live page, before and after:**

|        | what the customer read                               |
| ------ | ---------------------------------------------------- |
| before | `<p>A hard enamel pin…</p><p>About 1.25 inches…</p>` |
| after  | two paragraphs, no tags, `literal <p> on page: 0`    |

The meta description and the JSON-LD went with it, so the search result stops
carrying them too.

## The rest of it, closed in 850

This fixed the product page. The same `description` column is read in four other
places, and the note that used to sit here listed them and stopped. That was a
defect parked as a measurement, so it is now
[850](850-one-line-said-html-was-allowed-and-five-readers-disagreed.md):

- The schema declared the field as `// rich text (HTML allowed)`, which is why
  the packs were written that way in the first place. It now normalizes on parse.
- **Both consoles** carried `/<[^>]*>/g`, which ate the words between an ordinary
  `<` and `>` in her own sentence.
- **The search index** stored the raw column, making `strong` and `li` into
  searchable words.
- **Dropship imports** wrote supplier HTML straight in, bypassing the schema.
- **The public API** served it raw to every headless client.
- **No email template reads it** — the list above was wrong about that one.

`plainText` moved out of this app and into `@wizeworks/commerce-schemas` so all
five could share it. The 185 counted here is 188 counted properly; `LIKE
'%</p>%'` missed three rows carrying only `<br>`, `<strong>` or `<li>`.

**The stored rows are repaired.** `db:backfill:plain-descriptions -- --apply` ran
on 2026-09-28 and cleaned all 188 across 9 businesses. Re-measured after: **0 of
568** descriptions carry markup, and a second run is a no-op.

## Files

- `wizeworks/apps/site/lib/plain-text.ts` (new; moved to `@wizeworks/commerce-schemas` in 850)
- `wizeworks/apps/site/lib/plain-text.test.ts` (new; moved with it)
- `wizeworks/apps/site/lib/silica-data.ts`
- `wizeworks/apps/site/lib/builder-data.ts`
- `wizeworks/apps/site/lib/builder-commerce-data.ts`
- `wizeworks/apps/site/components/sections/product-description.tsx`
- `wizeworks/apps/site/app/products/[handle]/page.tsx`
- `wizeworks/packages/db/src/sample-data/packs/*.ts` (all eleven)

## The thing to remember

**Every reader of that field agreed it was plain text. The writer never asked.**
The console's control, the site's renderer and the field's own help sentence all
said "words". The sample packs were written by somebody thinking about a product
page, in the language product pages are usually written in, and nothing in
between the two ever compared them.
