# 951 — Her search only knew her headlines

**Status:** fixed (act 7)
**Severity:** major
**Found by:** P09 · The Marrow Review · act 7, searching her site as a reader
**Surface:** her public site's search (`/search`), the console's Ctrl K box, the public search API
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P09 · act 7, `/search?q=Polebrook` finding "The last mill on the Nene"
**Blocked on:** —

## What happened

Her brief: "search finding a piece by a word in its body". As a reader on a phone:

- "sluice" (the first sentence of "The last mill on the Nene"): **Nothing matches "sluice"**.
- "Glapthorn", "wholesaler", "Peterborough" (all in standfirsts): nothing.
- "mill": the mill piece, because it is in the headline.
- "leat": "Price, weather, war" (a near-miss on "weather") and **Featured · Collection**,
  a shop collection, on a site that switched its shop off.

## Why

- The search index held, for any piece of writing, its headline and a field named
  `excerpt` or `summary`. Her Article kind has neither; it has a Standfirst and a Body.
  So nothing but headlines was searchable, for any kind a business built itself.
- The body is stored as the editor's document (`{ type: 'doc', content: [...] }`), not
  as text. A first repair read only text fields and still indexed no body.
- The public search route searched products and collections on every site, whatever
  the site's own "What this site shows" said.

## The fix

- `packages/commerce/src/entry-text.ts` (new): the words of an entry from its kind's
  own fields: every text, long text and rich text field in order, rich text read from
  either HTML or the editor's document, the headline left out, capped at 30,000
  characters. Both content projectors use it (`universal-projection.ts`), so a policy
  page is findable by its words too.
- `packages/search/src/search.ts`: the index keeps every word; an answer carries a
  500-character lead-in, so the console's box is not handed twenty whole articles.
- `services/api-rest/src/routes/v1/public/search.ts`: `publicEntityTypesFor` drops
  products and collections on a site whose shop is off, and pages and articles where
  writing is off. An empty list answers nothing rather than searching every type.

## After deploy

Existing search documents keep their old text until rebuilt. Run **ops.yml ›
reindex-search** once, with Apply ticked.

## Proof

- `entry-text.test.ts` (commerce), 7. Reading only `excerpt` and `summary` reddens 3;
  skipping editor documents reddens 1.
- `short-body.test.ts` (search), 2. Returning the whole body reddens 1.
- `search.test.ts` (public route), 3 new. Searching every type reddens 2.
- On screen, as a reader at 390px: "Polebrook", "Widgeon" and "thatchers" (words only in
  the mill piece's body) each find "The last mill on the Nene". No shop collection
  appears for any word.
