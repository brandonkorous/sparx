# 330 — Every photograph on her site was measured as weighing nothing

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · checking a claim about her product pictures that turned out to be wrong
**Surface:** mypiggles › My Site › Publish › Before you publish (the weight report)
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** the two tests that pin it, red before the fix and green after

## How this was found, which is the useful part

A note carried across several sessions said three of Devi's seven product cards
"show flat illustrations rather than photographs". **That was wrong**, and
looking properly is what turned up the real defect.

Every one of her products has a real `image/jpeg`. What actually differs is where
each one is STORED, and the split is exactly backwards from the note:

| Picture                                             | Stored            | `byte_size` | Alt text |
| --------------------------------------------------- | ----------------- | ----------- | -------- |
| `ash-overshirt-bone.jpg` and her other own uploads  | her media library | 26,395      | none     |
| `kestrel-prod-merino.jpeg` and the rest of the seed | an Unsplash URL   | **0**       | present  |

The three pictures the note called illustrations are the only three with real
bytes behind them. The claim was made from memory and never checked.

## What is actually wrong

**A picture nobody weighed is reported as weighing nothing.**

Her media library holds 35 assets. **28 of them carry `byte_size = 0`** — every
one a remote picture, registered by URL and never downloaded, so there was never
anything local to measure. Across the whole dev database it is **2,901 of 3,109
assets**.

Zero does not mean small here. It means unmeasured. And the weight report adds it
up as though it were measured.

## What should have happened

The report says it cannot weigh those pictures, which it already knows how to do:
it has an `unsizedImages` count for exactly this, and a page's total is a stated
FLOOR on what a first visit downloads rather than a claim to have seen everything.

## Why it matters

**The weight budget exists to tell an owner her page is too heavy**, and a site
built out of hot-linked photographs is the case where that most needs saying.
Devi's site is largely Unsplash images requested at `w=1600`. Every one of them
counted as zero, so her pages measured as pure markup and passed the budget
outright.

**It is silent in both directions at once.** The picture is added to the total as
0, AND it is left out of the unsized count — so nothing on the screen suggests
anything went unmeasured. A clean weight report is indistinguishable from a report
that weighed nothing at all. That is
[[feedback_never_present_absence_as_measurement]]: a value nobody measured must
never render as one.

**The code already said this was wrong**, in the paragraph directly above the
line that did it:

> A source that matches nothing is left OUT of the map rather than entered as
> zero — the check reports it as unsized, which is the truth, instead of quietly
> making a hot-linked 4 MB hero photo look free.

That is the intent, written down, describing a behaviour the code did not have.
It handled a source that matched NO row. A source that matched a row carrying
zero walked straight past it.

## Where it lives

`imageWeights` in
[site-check.ts](../../../../wizeworks/services/api-rest/src/lib/site-check.ts):

```ts
for (const row of assets) byKey.set(row.key, Number(row.byteSize));
for (const row of variants) byKey.set(row.key, Number(row.byteSize));
```

and then, in
[budget.ts](../../../../wizeworks/packages/site-lint/src/budget.ts):

```ts
const bytes = weightOf(src, sizes);
if (bytes == null) {
  unsizedSrcs.add(src); // honest
} else {
  imageBytes += bytes; // a stored 0 lands here
}
```

`0 == null` is false, so a stored zero is a measurement.

## The fix

**A stored zero is not a weight**, and is dropped for the same reason a missing
row is. No image file is zero bytes, so that column never means "weighs nothing";
it means nobody measured it. Those pictures now fall through to `unsizedImages`,
which the report already knows how to say.

Applied to variants as well as originals, and that half matters on its own: a
variant WINS over the original it came from, deliberately, because a variant is
what the page actually downloads. A zero-byte variant winning would have thrown
away the one real number available.

**Not fixed, and deliberately:** nothing goes and fetches the remote pictures to
weigh them. The engine is pure by contract, and a site check that made 2,901
outbound requests would be a worse tool than one that says plainly which pictures
it could not weigh.

## Confirmed by

Four tests on `imageWeights`, which had none because it was not exported.
`site-check.test.ts` exports and tests its other three helpers for exactly this
reason.

Proved red before green: with the guard removed, **"leaves a picture stored as
zero bytes OUT"** and **"does not let a zero-byte VARIANT overwrite a real
original"** both fail. 21 tests in the file, all passing after.

## Also found, not yet fixed

**Her own three uploads have no alt text**, while every seeded picture has some.
The three are `marlow-knit-moss.jpg`, `linen-shirtdress-chalk.jpg` and
`ash-overshirt-bone.jpg` — the ones she added herself, through the console.

`image-no-description` is one of the check's rules, and it did not fire on them,
because it walks the authored page trees and a product photograph reaches the page
through a record template's data binding. The check nags about a decorative image
in a page body and is blind to the product photograph on a shop, which is the
image that actually matters. Separate defect, separate shape from this one.

## Rating effect

Against `My Site › Publish`. The weight half of that pane was reporting a
confident number about pictures it had never seen.
