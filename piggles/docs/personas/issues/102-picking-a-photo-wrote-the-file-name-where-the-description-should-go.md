# 102 — Picking a photo wrote the file name where the description should go

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 5
**Surface:** mypiggles › My Site › Page › a picture › Choose
**Filed:** 2026-08-22
**Fixed:** 2026-08-22
**Confirmed by:** P02 · Nia · on screen 2026-08-22

## What happened

Nia built a team page and picked a photograph from her own picture library. The
console's field for what a screen reader reads out — **Describe the picture**,
with the helper "Read aloud to anyone using a screen reader, and shown if the
picture can't load" — filled itself in with:

```
salon-editorial-noor.jpeg
```

The file name. Not a description, and not even a file name she chose: it is the
one the starter site shipped.

**Her library already had the right words.** Every picture in it carries a real
description, typed when the pack was built:

| File                         | Its description in the library                 |
| ---------------------------- | ---------------------------------------------- |
| `salon-editorial-work1.jpeg` | A soft, lived-in balayage                      |
| `salon-editorial-work2.jpeg` | A precise, glossy blunt cut                    |
| `salon-editorial-hero.jpeg`  | A bright, calm salon interior in warm neutrals |

The picker read none of them.

## Why it matters

Three things at once, and the third is the one that hides the other two:

1. **A screen reader announces the file name.** "salon dash editorial dash noor
   dot jpeg" is worse than silence — it is noise where a description belongs.
2. **The wording is somebody else's.** `noor` is a stylist from the demo salon who
   does not work here.
3. **The pre-publish check is satisfied by it.** "Pictures with no description" is
   one of the things the check looks for, and a filled-in filename counts as
   filled in. So the one screen that would have told her looked at it and said
   nothing was wrong.

It is silent by construction ([[feedback_absent_behaves_like_fine]]): a wrong alt
text renders identically to a right one, and the check that exists to catch a
missing one was fed a value.

## How to reproduce

Every time.

1. My Site › Page › select any picture › **Choose** › pick anything.
2. Read **Describe the picture**.

## Where it lives

Three files, one dropped field.

[surfaces/cms/media.ts](../../../apps/workbench/surfaces/cms/media.ts) — the
picker's own wire type never declared `alt_text`, so `toAsset` could not map it,
even though the media API has returned it all along
(`assets.ts` → `alt_text: row.altText`).

[surfaces/cms/media-picker.tsx](../../../apps/workbench/surfaces/cms/media-picker.tsx)
— `PickedAsset` carried `{ id, url, filename }`. No description to hand on.

[lib/studio/host.tsx](../../../apps/workbench/lib/studio/host.tsx) — with nothing
better available, `pickAsset` used the only string it had:

```ts
return picked?.url ? { url: picked.url, alt: picked.filename } : null;
```

A filename is not a description, and the code that wrote it was not being careless
— it had no other value in its hand.

## The fix

Carry the library's description through all three layers, and **never substitute
the filename**:

- `MediaAsset` gains `altText: string | null`, mapped from the wire's `alt_text`.
- `PickedAsset` gains the same field, populated at all three places a pick is
  built (grid choice, single upload, multi-upload).
- `pickAsset` uses it, and passes **no alt at all** when the library has none:

```ts
const alt = picked.altText?.trim();
return alt ? { url: picked.url, alt } : { url: picked.url };
```

That last part matters as much as the first. An empty description is what makes
the pre-publish check speak up and ask for one — which is the behaviour that was
being suppressed by writing a filename into the field.

## Confirmed by

Re-run as Nia on 2026-08-22, building the Our work gallery: picking
`salon-editorial-work1.jpeg` filled the description with **"A soft, lived-in
balayage"**, `work2` with **"A precise, glossy blunt cut"**, `work3` with **"An
effortless textured finish"** — the library's own words, with nothing typed.

## Rating effect

`My Site › Page` and the picture picker are scored in [rating.md](../rating.md).
