# 096 — The pinned summary hid "Record a payment"

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 6 (recording the county's first check)
**Surface:** workbench › an invoice or quote's full bill, right-hand column (both consoles)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

On INV-000015 Doty scrolled down to record a $500.00 check. The Summary card stayed pinned at the top of the right column, and the Signature and Payments cards slid up under it. "Record a payment" sat behind the totals; a click there landed on the Summary. The words "password) and signing it moves this document forward." showed through below "Your margin".

## What should have happened

Every card in the column can be read and used at every scroll position.

## How to reproduce

Open any invoice's full bill, scroll to the bottom, try to press Record a payment. Before the fix: covered at the bottom, every time.

## Why it matters

Recording money in is the reason this part of the page exists. A control that can be reached only at certain scroll positions reads as broken.

## Where it lives

`EDITOR_RAIL_STICKY` (`components/editor-layout.tsx`, both consoles) pinned the first card of a rail that had three more under it. Issue 085 had put it above them; before that they slid over it. Either way a pinned card with cards after it collides with them.

## The fix

The card pins only while it is the last thing in its rail (`@4xl:last:sticky`). The invoice summary, followed by Signature, Payments and History, now scrolls with them; a person's card on Team and the jobs card on Pulse, each alone in its rail, still pin. The rule moved to `components/editor-rail-sticky.ts` so it can be tested.

Test: `components/editor-rail-sticky.test.ts`, both consoles. The old classes redden 1 of 1.

## Confirmed by

On screen, 2026-10-06, as Doty: scrolled to the bottom of INV-000015, Summary, Signature, Payments and History all read in full, and Record a payment opened. $500.00 by check (Check 20417, Salt Lake County Auditor) recorded: "$820.00 still owed of $1,320.00".

## Rating effect

—
