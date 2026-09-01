# 330 — Every photograph on her site was measured as weighing nothing

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · checking a claim about her product pictures that turned out to be wrong
**Surface:** mypiggles › My Site › Publish › Before you publish (the weight report)
**Filed:** 2026-08-29
**Fixed:** 2026-08-29
**Confirmed by:** the two tests that pin it, red before the fix and green after

## How this was found, which is the useful part

Chasing a note carried across several sessions: three of Devi's seven product
cards "show flat illustrations rather than photographs". What it turned up was a
different defect entirely, described below.

**Correction, 2026-08-29 (later the same day).** This section previously said the
note "was wrong". It was not. Opening her live Shop and looking at the pixels,
**Marlow Knit, Linen Shirtdress and The Ash Overshirt each render a flat beige
vector drawing of a garment on a cream ground.** Exactly three, exactly the three
the note named, and exactly the three whose pictures are her own uploaded files.

What I actually checked was `mime_type` and `byte_size`, concluded "real
`image/jpeg`, therefore a photograph", and wrote the note off. A JPEG holds
whatever was encoded into it. The numbers were even arguing the other way: 26 to
37 KB for a 1257x1572 image is a flat illustration's weight, and a photograph at
that size is several times it. Reading columns instead of looking at the screen
is the specific failure the persona rules exist to stop, and it produced a
confident denial of something true.

The storage split below is real and is what the rest of this issue is about. It
is simply not what the note was about:

| Picture                                             | Stored            | `byte_size` |
| --------------------------------------------------- | ----------------- | ----------- |
| `ash-overshirt-bone.jpg` and her other own uploads  | her media library | 26,395      |
| `kestrel-prod-merino.jpeg` and the rest of the seed | an Unsplash URL   | **0**       |

The alt-text column that used to sit here said her own uploads had none. That was
wrong too, from reading the wrong table: description lives on
`commerce_variant_images.alt`, not on the asset, and **hers are the best-written
alt text on the site** ("The Marlow Knit in Moss, a deep grey green lambswool
crew, laid flat and photographed from the front"), while the seeded ones just
repeat the product title. See the note at the end of this file.

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

## Also found, and it is not a defect

An earlier draft of this section reported that her own uploads had no alt text
while the seeded ones did. **Withdrawn — that read the wrong table.**
`media_assets.alt_text` is null on everything uploaded through the product screen,
which is correct: a description belongs to a picture's USE, not to the file, so
the product's Photos tab writes it to `commerce_variant_images.alt`. Read there,
her three are the best-described images on the site and the seeded ones are the
weakest:

| Picture            | Description                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| `marlow-knit-moss` | The Marlow Knit in Moss, a deep grey green lambswool crew, laid flat and photographed from the front. |
| `kestrel-prod-tee` | The Everyday Tee                                                                                      |

Six variant images across four products do carry a null `alt`, all of them
seeded. Not filed as a defect: the field is there, it is on the Photos tab, it
explains itself, and nothing about the product is preventing it being filled in.

## Actually still open, from the correction above

**Three of her products show a flat illustration where a photograph belongs**,
which RULE #8 makes part of the deliverable rather than a defect in the software:
"Real photographs on every page that wants one." Marlow Knit, Linen Shirtdress
and The Ash Overshirt need real pictures before her site is finished.

## Rating effect

Against `My Site › Publish`. The weight half of that pane was reporting a
confident number about pictures it had never seen.
