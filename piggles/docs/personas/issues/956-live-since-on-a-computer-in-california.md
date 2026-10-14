# 956 — "Live since" on a computer in California

**Status:** fixed (act 9)
**Severity:** minor
**Found by:** P09 · The Marrow Review · act 9, after her scheduled piece went live
**Surface:** mypiggles › Content › a piece (status line and history), both consoles
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P09 · act 9, "Who pays when the malting barley fails"
**Blocked on:** —

## What happened

Before it went out the piece said **"Goes live Oct 9, 2026, 6:45 AM British Summer
Time."** (issue 942 put that line on her business's clock.) Once it was out, the same box
said **"Live since Oct 8, 2026, 10:45 PM."**: this computer's Pacific clock, the day
before, with no zone named. Every version in its history was dated the same way.

## The fix

`surfaces/cms/content-detail.tsx` (both consoles): "Live since" and each version's date
use `onClock` on her business's clock, the helper the scheduled line already used. The
unused `formatDateTime` import is gone.

## Proof

On screen: "Live since Oct 9, 2026, 6:45 AM British Summer Time." History: "Version 3 ·
Oct 9, 2026, 6:45 AM British Summer Time · Scheduled publish fired". Both consoles
typecheck clean.
