# 188 — She wrote the fabric, the fit and the care, and moving one tab erased it

**Status:** fixed and confirmed
**Severity:** major
**Found by:** P03 · Juniper Row · act 4
**Surface:** mypiggles › Sell › Product › every tab
**Filed:** 2026-08-24
**Fixed:** 2026-08-24
**Confirmed by:** P03 · Juniper Row · 2026-08-24
**Blocked on:** —

## What happened

Devi opened The Ash Overshirt to write it up. On **Details** she chose the kind
of product (Apparel), which opened the three boxes she wanted, and filled them:
fabric and construction, fit, care. Then she clicked **Overview** to write the
description, wrote it, and pressed **Save**.

The screen said **Saved just now**.

She went back to Details. Kind of product read **No kind — just the basics**, the
Apparel section was gone, and so were all three paragraphs. Nothing had warned
her. There was no dot on the Details tab while she was on Overview, no "you have
unsaved changes", no confirm.

Proved it again by hand, one field at a time, so it could not be blamed on how
fast anything was typed: added one sentence to Fabric & construction, clicked
Overview, and the Save button was already **greyed out** with the status line
reading "Saved just now". Back on Details, the sentence was gone.

## What should have happened

The work stays where she left it until she saves it or deliberately throws it
away. This is not an aspiration read into the product — it is what the console
already promises itself, in writing, in two files:

> A tab you have never opened cannot have unsaved changes. A tab you edited and
> then navigated away from very much can. If panels unmounted on tab switch,
> that second tab would lose its edits AND its dot at the same moment.
> — [product-tab-save.tsx](../../../apps/workbench/surfaces/commerce/product-tab-save.tsx)

That is exactly what happens.

## How to reproduce

Every time.

1. Sell › Products › **The Ash Overshirt**.
2. **Details** › Kind of product › **Apparel**. Type anything into Fabric &
   construction.
3. Click **Overview**. Save is already disabled and the status says saved.
4. Click **Details**. Everything typed in step 2 is gone.

## Why it matters

It is the longest typing in the whole product. A garment's fabric, fit and care
is three paragraphs she writes once and carefully, and Details is the tab
furthest from Overview in the order she would work: describe it, then say what it
is made of, then the photos. Any route through those seven tabs that does not
press Save between each one silently throws work away.

It is worse than losing the text, because the console tells her the opposite.
"Saved just now" is on screen at the moment the words are being discarded, so she
has no reason to retype anything until she happens to come back and find the tab
empty. For a business whose whole premium is that somebody made this by hand and
can tell you how, the fabric paragraph IS the product page.

## Where it lives

[product-detail.tsx](../../../apps/workbench/surfaces/commerce/product-detail.tsx) —
the seven `<TabsPanel>`s.

Silica's `TabsPanel` passes through to Base UI's `Tabs.Panel`, whose
`keepMounted` defaults to **false**: an inactive panel is removed from the tree
entirely. Counted on the live page while standing on Details, there is exactly
**one** `[role="tabpanel"]` in the document. The other six do not exist.

So the tab body unmounts, and its `useState` draft goes with it. And because
`useTabSave` unregisters on unmount, three separate things that were built to
prevent precisely this have never been able to work:

| Built                                                     | What it actually does         |
| --------------------------------------------------------- | ----------------------------- |
| `useVisitedTabs` — "lazy-then-keep", panels stay mounted  | nothing; silica unmounts them |
| The dirty dot on a tab you are not standing on            | can never render              |
| `useDirtySource(tabSave.anyDirty)` — the pane-level guard | only ever sees the active tab |

`anyDirty` is the same value as "the tab I am looking at is dirty". The dot on
Pricing while you stand on Media, which the comments describe as the device that
makes a toolbar Save honest, has never appeared once.

Checked the siblings. `product-reviews.tsx` panels are read-only. The eleven on
`crm/customer-detail.tsx` unmount the same way, but that surface builds its
details form as JSX in the parent, so the state survives the unmount and nothing
is lost there.

## The fix

`keepMounted` on the panel — but written **once**, not seven times.

Seven hand-written `<TabsPanel>`s were six chances to forget the flag, and the
eighth tab would have been a seventh. So the panels moved into
[product-tabs.tsx](../../../apps/workbench/surfaces/commerce/product-tabs.tsx),
where a single `ProductTabPanel` carries the flag, the visited gate and the
`TabValueProvider`, and `ProductTabPanels` renders all seven through it. A tab
added tomorrow gets all three for free or does not render at all.

Nothing else changed. Everything the three devices were supposed to do, they now
do, because the panel they depended on is finally there.

The shell was 543 lines doing four jobs, so splitting it was the same act:

| File                         | Lines | Owns                               |
| ---------------------------- | ----- | ---------------------------------- |
| `product-detail.tsx`         | 234   | the pane chrome, the save registry |
| `product-tabs.tsx`           | 223   | the tab strip and every panel      |
| `product-detail-actions.tsx` | 117   | the toolbar's secondary actions    |

Two pieces of dead weight went with it: the `what` and `plan` fields on every
tab entry, briefs written for tabs that were unbuilt at the time and referenced
by nothing since they were all built.

## Confirmed by

Re-ran act 4 as Devi, on The Ash Overshirt, with the same data.

**The panels are there.** Counted on the live page while standing on Details:
**seven** `[role="tabpanel"]`, where before there was one. Both the Overview
description and all three Apparel boxes are in the document at the same time.

**The work survives.** Added "Every seam is finished by hand." to Fabric &
construction, clicked **Overview**, clicked **Details**. The sentence is still
there and Save is still live.

**The dot appears where it never had.** Standing on Overview, the **Details** tab
carries the module-hue dot, and the status line reads "Not saved: The Ash
Overshirt" instead of "Saved just now".

**The pane guard fires.** With one unsaved character on Details, closing the pane
raised **"Unsaved changes — This product has unsaved changes. Close anyway?"**
with Keep working / Close anyway. Kept working; nothing was lost.

Saved, and the row agrees:

```
title             | product_type_key | attributes
The Ash Overshirt | apparel          | fabric, fit, care, origin,
                                     | materials [Cotton 60%, Linen 40%]
```

## Rating effect

`Sell › Product › Details` is scored for the first time in
[rating.md](../rating.md), at what it is worth after the fix.
