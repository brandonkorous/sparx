# 123 — Two people on one computer shared one workbench

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 8 (Mike Van Der Berg signing in on the computer Doty uses)
**Surface:** workbench, both consoles: open panes and their arrangement, named arrangements, scroll position, list-or-board choice, notices already read, the product a pane follows, the trial banner's "not today"
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

Mike signed in on the browser Doty had been using. His workbench opened on Doty's 155 tabs: her invoice previews, Business details, Payment providers, her quotes and deals. Anything he opened or closed changed her set too.

The browser kept these under the site's id alone. Issue 011 had already made the key name the business. Nothing named the person.

## What should have happened

Each person gets their own workbench on a shared computer. Doty comes back to her tabs, Mike to his.

## Why it matters

A shop counter computer is shared. A service manager who opens onto the owner's money screens sees what his role was meant to keep from him at a glance, and an owner who comes back to find her working set rearranged stops trusting that "it stays arranged".

## The fix

Both consoles:

- New `lib/workbench/storage-owner.ts`: `setStorageOwner(userId)` and `personalKey(key)`. The shell sets the owner from the server's session on every render, before anything reads storage. A value saved before keys named a person goes to the first person who reads it, and is removed in the same step.
- The shell takes `userId` from the server (`workbench-entry.tsx` / `console-entry.tsx`).
- Person-owned stores use `personalKey`: open panes (`persistence.ts`), named arrangements, per-presentation arrangements (`mode-layouts.ts`), scroll position (`use-canvas-scroll.ts`), list-or-board (`view-preference.ts`), notices read (`module-beta-notice.tsx`), the followed product (`product-scope.tsx`), and in sparx the trial banner's dismissal (`billing/dismissal.ts`).
- Computer-owned stores stay as they were: theme, window mode, zoom, the rail and folded panel sections, the phone to call from, the scanner's warehouse, queue and id, one tab's link-switch count.

Tests, each proved red:

- `lib/workbench/storage-owner.test.ts`, both consoles: two people keep their own panes and list choice on one site; an old value goes to exactly one person; the key names the person. Making `personalKey` ignore the person reddens 4 of 5. A fifth test reads every file that uses browser storage and fails on one that neither uses `personalKey` nor is named as computer-owned: putting back the old billing file reddens it.

## Confirmed by

On screen, 2026-10-06. As Mike: a fresh workbench ("Start here"); he opened the Calendar and had 2 tabs. Signed out; Doty signed in onto her 155 tabs. The browser holds the two sets under the two people.

A dev reload of the new code while Mike was signed in gave Doty's old tabs to Mike, by the "first reader" rule. They were moved back to Doty by hand before this check. After a real release the same rule applies: whoever is signed in when the new code first loads takes the old set. On a computer with one user, that is them.

Found in passing, not a live defect: a key `sparx-workbench-layout:[object Object]` from 2026-07-19, empty. Every current caller passes a site id as text.

## Rating effect

—
