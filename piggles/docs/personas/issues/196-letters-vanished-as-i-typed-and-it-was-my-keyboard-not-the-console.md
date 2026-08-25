# 196 — Letters vanished as I typed, and it was my keyboard, not the console

**Status:** withdrawn, not a defect
**Severity:** none (filed as major, disproved before it was closed)
**Found by:** P03 · Juniper Row · act 4
**Surface:** mypiggles › Sell › Product › Media › This photo
**Filed:** 2026-08-25
**Withdrawn:** 2026-08-25

## What I saw

Writing screen-reader descriptions for the Marlow Knit photos, the field appeared
to drop letters:

```
typed:  … an undyed cream lambswool crew …
landed: … an undyed cream lambswool cew …
```

Twice in a row, and the console's error log carried a matching React exception,
`Maximum update depth exceeded`, whose stack ran straight through the field's own
`onChange`. Later the pane stopped repainting entirely and the browser tab had to
be replaced. It looked like an obvious data-loss bug on the one field nobody
proof-reads.

## What it actually was

**My typing, at a speed no person can produce.** The automation types a hundred
characters in well under a second. React counts synchronous updates that arrive
before a commit has settled, and throws once fifty of them stack up; at that rate
a single long sentence gets there on its own. The thrown update is what dropped
the character.

The disproof is straightforward. Same field, same sentence, typed in seven chunks
with two seconds between them — roughly a fast human:

```
The Linen Shirtdress in Chalk, a warm off white, buttoned through with the
belt tied at the waist.
```

Character for character, and an empty error log. Typed all at once, it comes out
`butoned` with the exception logged. The variable is the rate, not the field.

## Why this is written down rather than deleted

Two reasons.

**It nearly became a fix for a problem nobody has.** The first version of this
file confidently blamed a render loop, named the file it lived in, and marked
itself fixed and confirmed. Everything in it was checkable and it was still
wrong, because I never asked whether the input to the test was realistic. Persona
RULE #1 says drive the screen as the person would — and a person does not type at
600 characters a second. The instrument was outside the range the product is
built for, and I read the instrument's limit as the product's.

**It is a standing trap for this whole persona run.** Every long string I type
into any single-line field carries the same risk of silently losing a character
and of me filing the result as a defect. From here on, anything over about forty
characters gets typed in chunks, and any suspected input bug gets re-tested at
human speed **before** it is written up.

## What was real, and was kept

The investigation did turn up something true, just much smaller than what I filed.
[product-tab-save.tsx](../../../apps/workbench/surfaces/commerce/product-tab-save.tsx)
registered each tab **twice** — once on mount, once whenever `dirty` or `saving`
changed — stored getter proxies the registry could not compare, and therefore
rebuilt its map on every call. The first time a tab went from clean to dirty, that
re-rendered all seven product tabs instead of none.

That is now: plain values, one registration, and a registry that hands back the
same map when nothing changed, so React bails out of the render.

```ts
const current = prev.get(key);
if (current?.dirty === value.dirty && current.saving === value.saving) return prev;
```

It is a tidy-up, not a fix for anything a shop owner would have noticed. Recorded
as such rather than dressed up as the cause.

`product-media.tsx` was also 791 lines against
[piggles/CLAUDE.md](../../../CLAUDE.md) RULE #0.5's 250-line ceiling, and touching
it obliged the split:

| File                        | Lines | What it is                                |
| --------------------------- | ----: | ----------------------------------------- |
| `product-media.tsx`         |   224 | the tab: data, the one draft, composition |
| `product-media-details.tsx` |   195 | one photo's panel                         |
| `product-media-gallery.tsx` |   175 | the tiles and the drop box                |
| `product-media-actions.ts`  |   145 | add, reorder, make main, take off         |
| `product-media-binding.ts`  |   102 | "where this photo shows", as one answer   |
| `product-media-pinning.tsx` |    95 | the version / choice selects              |

## Rating effect

None. `Sell › Product › Media` keeps its score; nothing here counts against it.
