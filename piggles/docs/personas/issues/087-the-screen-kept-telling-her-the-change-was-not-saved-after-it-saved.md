# 087 — The screen kept telling her the change was not saved, after it had saved

**Status:** fixed
**Severity:** major
**Found by:** P02 · Halo & Hem · act 4
**Surface:** mypiggles › Bookings › Services › a service
**Filed:** 2026-08-21
**Fixed:** 2026-08-21
**Confirmed by:** P02 · Nia · on screen 2026-08-21

## What happened

Nia opened **Full head highlights**, said who it needs (a colourist), and pressed
**Save**.

The bottom-left of the window said **"Saved just now"**. At the same moment the
bottom-right said, in amber, **"Not saved: Full head highlights"** — and the
panel's own tab kept the orange dot that means unsaved work.

She pressed Refresh. The value came back from the server, so it plainly had
saved. **The warning stayed.** Save stayed lit.

There is no way out of it except closing the panel and confirming a
"you will lose your changes" dialog about changes that are not lost.

## What should have happened

Saved means saved: dot gone, warning gone, Save greyed until she changes
something else.

## How to reproduce

Every time.

1. Bookings › Services › any service.
2. **Who or what it needs** › **Add something it needs**, type anything in
   **What it is**.
3. Save.

"Saved just now" and "Not saved: …" on screen together, for ever.

## Why it matters

Two costs, and the second is the real one:

- She cannot tell whether her price list is safe. The console is saying both
  things at once, so she has to check every change by hand.
- **It trains her to ignore the warning.** The next time it means something real
  — an actual unsaved edit about to be closed — it will read as the same noise.

## Where it lives

`surfaces/scheduling/service-detail.tsx`. The dirty check is

```ts
function draftsEqual(a: Draft, b: Draft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
```

which is **key-order sensitive**, and the two sides do not agree on order. The
form builds a requirement as `{ role, kind, skillTags, count }`; the server
returns it as `{ kind, role, count, skillTags }` — confirmed by reading the row
back. `draftFrom` spread the server's object straight into the draft, so after a
save-and-refetch the stringified draft could never equal the stringified initial
and `changed` stayed true for the life of the panel.

Only the requirements array had this shape: every other field is a scalar the
spread never touched, which is why the panel behaves until somebody uses that one
section.

## The fix

`draftFrom` builds each requirement **field by field** in the form's own order
rather than spreading whatever the server sent. One place, and it makes the
comparison honest rather than accidentally passing.

The order-sensitive `draftsEqual` is left alone deliberately: array ORDER is
meaningful here (requirements are a list), so a comparison that sorted its way to
equality would hide a real reorder.

## Confirmed by

Re-run as Nia on 2026-08-21. Opened **Full head highlights**, changed **What it
is**, pressed Save:

- "Saved just now", the tab's dot cleared, the amber "Not saved" line gone.
- Save greyed out until the next edit.
- Refreshed; the value is still there and the panel is still clean.

## Rating effect

Folded into `Bookings › Services` in [rating.md](../rating.md).
