# 081 — A sign-off rule said "Off" in gray, and nothing when on

**Status:** fixed
**Severity:** cosmetic
**Found by:** P01 · Gillett Diesel Service · act 5 (Salt Lake County's $2,500 sign-off rule)
**Surface:** workbench › Wholesale › Approvals (both consoles)
**Filed:** 2026-10-02
**Fixed:** 2026-10-02
**Confirmed by:** On screen, 2026-10-02, as Doty: Approvals shows "Over $2,500.00, Salt Lake County…" with a green "On" and "Over $5,000.00, Every account" with an amber "Off".
**Blocked on:** —

## What happened

The starter rule "Over $5,000.00, Every account" showed a gray "Off" beside its switch. The rule Doty added for Salt Lake County, switched on, showed no word at all, only the switch. The one rule holding orders said least about it, and the badge used gray `neutral`, which is not ours to choose.

## Fix

`surfaces/b2b/approvals.tsx` (both consoles): every rule shows its state, green "On" or amber "Off".
