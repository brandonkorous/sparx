# 177 — The sentence telling her what went wrong is the smallest text on the form

**Status:** open
**Severity:** design
**Found by:** P03 · Juniper Row · act 4
**Surface:** mypiggles › every form with a field that can be wrong
**Filed:** 2026-08-23
**Fixed:** —
**Confirmed by:** —
**Blocked on:** decision — the value is hardcoded inside silicaui, so the fix is
either an upstream release or a local override, and the second needs approval

## What happened

While confirming the fix for [176](176-two-scarves-got-the-same-code-and-one-lost-its-price.md),
Devi typed a product code that was already in use. The form told her, correctly:

> "Throwaway test scarf A" is already using this code. Try THROWAWAY-TEST-SCARF-2 instead.

Measured on the screen it was rendering at:

| Element on that form                       | Size     |
| ------------------------------------------ | -------- |
| Body text                                  | 16px     |
| Field label ("Product code")               | 14px     |
| Field description (the hint under the box) | 14px     |
| **Field error (what just went wrong)**     | **12px** |

The error message is the **smallest text on the form**, and it is smaller than
the hint it replaces — the sentence swaps in at 12px where 14px used to be. It is
the only text on the page a person is required to read in order to carry on, and
it is the hardest to read.

## What should have happened

At least the 14px the hint it replaces was using, and by preference the 16px body
floor, since this is read text and not a caption.

The rule is already written down: body floor 16px, "14 captions only, never 11–13
for body". A validation message is not a caption — nobody skims it, and acting on
it is the only way out of the state the form is in.

It matters more here than it would on most products. Piggles' stated audience
includes a 61-year-old on a phone in a workshop, and this is the sentence that
person most needs to read.

## How to reproduce

Every time, on every form in the console that can show a field error.

1. Sign in as Devi, open **Sell › Products › Add a product**.
2. Name it anything, then type a product code another product already uses.
3. The message appears under the field. Measure it: `.field-status` computes to
   `12px`, against `14px` on the `.field-description` it replaced.

## Why it matters

Cosmetic in isolation, systematic in aggregate: it is every error message in both
consoles, always at the moment somebody is already stuck. Saying it plainly — it
does not stop anyone finishing a job, so it is `design`, not `major`.

## Where it lives

Not ours, which is the whole difficulty.

`@wizeworks/silicaui@0.55.0` →
`src/components/field.js`, the `.field-status` rule:

```js
[status()]: {
  display: "flex",
  alignItems: "center",
  gap: "0.375rem",
  fontSize: "0.75rem",     // ← hardcoded, not a token, no prop exposes it
  lineHeight: "1.4",
  color: "var(--field-status-color, var(--color-base-content))",
  ...
}
```

The colour is a custom property and the size is a literal, so root RULE #1's
ladder runs out: there is no prop, there is no token to change, and silicaui is a
published dependency (`catalog:`), not a package in this repo.

`@wizeworks/silica-corrections/silica-gaps.css` is the sanctioned home for a
silica-level fix both brands need, but its own header rules this out — every rule
there must be "ADDITIVE to a state silica does not style at all", and "if you
want a silica component to look DIFFERENT, this is the wrong file". silica does
style this; it styles it at 12px. Putting it there anyway would be quietly
breaking the one contract that keeps that file from becoming a re-skin.

## The fix

Three ways, and which one is right is Brandon's call:

1. **Upstream.** Ask silicaui to make it `var(--field-status-size, 0.875rem)` —
   a token where there is currently a literal. Every brand benefits, nothing here
   changes, and it is the only option that leaves the ladder intact. Slowest.
2. **A local override in `silica-gaps.css` anyway**, documented as an exception
   to that file's additive rule and deleted when option 1 ships. One rule, one
   place, whole platform — but it is a re-skin of a vendor component, which is
   the thing the file exists to prevent, and it breaks silently on a silicaui
   upgrade that changes the selector.
3. **Leave it at 12px** and record that the 16px floor has a documented
   exception for field validation messages.

My recommendation is 1 with 2 as a stopgap, because the gap is small but it is on
every error message in the product and option 1 alone leaves it wrong for however
long the release takes.

## Confirmed by

—

## Rating effect

—
