# 272 — The one place a shop puts photographs could not reach her photographs

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · RULE #8 — four products with no picture
**Surface:** mypiggles › Sell › a product › Photos
**Filed:** 2026-08-26
**Confirmed:** 2026-08-26

## What happened

Four of Devi's seven products had no photograph, so her shop showed four grey
squares with a broken-picture glyph. She opened one to fix it, and the Photos tab
offered exactly one way in:

```
No photos yet
A product with a photo sells; a product without one looks unfinished.
Drag pictures onto the box below, or click it to choose files.

        [ Drop photos here, or click to choose files ]
```

A file input. Nothing else — the DOM had one `<input type="file">` on the pane
and no other control.

Her pictures were already in the platform. The builder's picture chooser opens on
her whole library with tabs, search and an Upload button, and it is the same
component the journal editor, the social composer, the author page, the expense
receipts and Site identity all use. **The place a shop puts its product
photographs was the one field in the console that could not reach it.**

## Why it matters

- **She photographs a run once.** The same three frames go on the product, on the
  collection card, in a journal post about the run, and in a social post. Every
  other one of those could pick the file; the product had to be given it again.
- **Uploading twice makes two of everything.** The library fills with duplicates,
  which is the thing the library exists to stop.
- **It is a dead end, not a slow path.** If she does not have the original file to
  hand — a photo taken on a phone months ago and uploaded from it — there is no
  way to finish the product at all from the machine she is on.

## The fix

`ChooseFromLibrary` in
[product-media-library.tsx](../../../apps/workbench/surfaces/commerce/product-media-library.tsx),
above the drop box:

```
[ Choose from your pictures ]
[ Drop photos here, or click to choose files ]
```

It is the SHARED picker (`useMediaMultiPicker`), so it arrives with search, the
collection tabs and multi-select already working, opened on `source="product"` so
a shop lands on its product photographs rather than everything it has ever
uploaded. `addExisting` adds each chosen asset straight to the product — no
upload step, because the file is already hers.

Its own small component so the hook is called inside the provider, which lets the
gallery stay what its own header says it is: no draft, no data, reports what was
chosen.

The empty state changed with it — **"Choose one you have already, or drop a new
file on the box below"** — because the old sentence described the only door there
used to be.

## Confirmed, by finishing the job with it

All seven products now have a photograph and a description, added through this
button:

| product                  | searched for | added |
| ------------------------ | ------------ | ----- |
| The Everyday Tee         | "tee"        | 2     |
| Silk twill scarf         | "scarf"      | 1     |
| Leather-covered belt     | "leather"    | 1     |
| Sunday Trouser, wide leg | "trouser"    | 2     |

Her shop page has no grey squares left. Workbench typechecks; prettier clean.

## Noted while using it

The picker's own line reads _"Nothing is saved until you save the whole page."_
That is true where it was written (a content field inside a form) and false here:
the Photos tab commits every action the moment it is clicked, and the toast says
"2 photos added" before the sentence has stopped being on screen. The picker is
shared, so the wording cannot simply be changed for one caller — recorded rather
than filed.

## Related

[[feedback_fetched_but_never_rendered]]'s cousin: the value was not missing, it
was one component away and nothing connected them. The library, the picker, the
search and the multi-select all existed and worked; the product page just never
imported them.

## Rating effect

The product Photos tab, in [rating.md](../rating.md). Recorded in the run log of
[03-juniper-row.md](../03-juniper-row.md).
