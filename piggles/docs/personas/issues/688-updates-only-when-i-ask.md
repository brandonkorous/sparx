# 688 — "Updates only when i ask"

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · act 242
**Surface:** mypiggles — Stock › Counts from elsewhere › a source
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, on the screen
**Blocked on:** —

## What happened

Devi connected her Lyon workshop's stock spreadsheet. On the card at the bottom
of the source, headed **How it is doing**:

> It has not updated your stock yet.
> Updates only when **i** ask.

A lower-case "i" about the owner herself, on the one card that tells her whether
her stock numbers are being kept up to date.

## Why

```tsx
Updates {syncIntervalLabel(source.syncIntervalSec).toLowerCase()}.
```

The label list right above it reads `{ seconds: 0, label: 'Only when I ask' }`.
A blanket `.toLowerCase()` took the pronoun down with the leading capital.

A label is a NAME. The only thing convention put there is the capital at the
front, so the front is the only thing safe to take off. Every other capital in a
label is carrying something: a pronoun, a company, an acronym.

## How far it goes

A parser pass over the console found 91 platform-authored labels whose case a
blanket lowercase would destroy — "PayPal", "Google Calendar", "Search Console",
"Microsoft Outlook", "United States", "Mine. I bought it" — and 13 places that
lowercase a label helper into a sentence.

Cross-referencing the two: **this was the only live instance.** None of the other
twelve helpers can return a label with an internal capital. So no sweep and no
check; one fix, and the sentence form put next to the label list where the next
person composing one will find it.

```ts
export function syncIntervalPhrase(seconds: number): string {
  const label = syncIntervalLabel(seconds);
  return label.charAt(0).toLowerCase() + label.slice(1);
}
```

## Confirmed

> Updates only when **I** ask.

## Files

- `piggles|sparx/apps/workbench/surfaces/inventory/sources-data.ts`
- `piggles|sparx/apps/workbench/surfaces/inventory/source-detail.tsx`
