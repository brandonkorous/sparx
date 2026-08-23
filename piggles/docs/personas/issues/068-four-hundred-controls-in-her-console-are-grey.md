# 068 — Four hundred controls in her console are grey

**Status:** open
**Severity:** design
**Found by:** P01 · Thistle & Rye · standing checks
**Surface:** mypiggles › everywhere
**Filed:** 2026-08-21
**Fixed:** partially — 8 closed, 432 remain
**Confirmed by:** —
**Blocked on:** decision — root RULE #4 makes `neutral` Brandon's to approve, every instance, and 432 of them is a design call at scale rather than a sweep to run unasked.

## What happened

Chasing one flagged control — the overflow button on the invoice pane — turned up
that it was not one control. `color="neutral"` appears **440 times** across the
Piggles console:

| Component   | Count |
| ----------- | ----: |
| `<Button>`  |   356 |
| `<Badge>`   |    96 |
| `<Tooltip>` |    29 |
| `<Icon>`    |    21 |
| `<Text>`    |    18 |
| `<Avatar>`  |     5 |
| `<Alert>`   |     2 |

Spread across every app: commerce 95, inventory 80, CRM 45, finance 25, CMS 19,
scheduling 17, invoicing 14, staff 13.

Root RULE #4 is unambiguous: **"`color="neutral"` is not yours to choose. Ask
Brandon, get a yes, then use it — and never ship it on the assumption that this
instance is obviously fine."** 440 instances is not 440 approvals.

## What should have happened

Each of these is one of three things, and only the last needs the word `neutral`:

1. **Something with a meaning its color should carry** — destructive is `danger`,
   app-owned is `module`, a favourite is `primary`, a state is whatever
   `statusTone` says.
2. **Genuinely untyped chrome** — an icon button, a toolbar control, a Cancel.
   The right control there is a **colorless** one: pass neither `color` nor
   `variant`, and a bare `.btn` resolves to `base-content`, correct in both
   themes. That needs no approval and is what the memory records Brandon saying
   explicitly.
3. **Something that really is neutral** — which is the only case that needs asking.

## Why it matters

This is the failure the design rules exist to stop, and the one recorded as
complained about five times: _"everything is neutral all the damn time."_ Every
other rule in the file is a prohibition, and grey is the single output that
satisfies all of them at once — so grey is what gets built unless something
requires otherwise.

The concrete cost shows up in the badges. Reading the 96 of them, these all
render the same grey pill:

> Archived (×7) · Retired (×6) · Turned off (×3) · **Out of stock** · Taken ·
> Stopped · Removed · Put away · Switched off · Standard · Visitor ·
> Just you (×2) · No plan set · No key yet · Nothing is stored · No change

"Out of stock" and "Standard" mean opposite kinds of thing to a shopkeeper and
are indistinguishable at a glance. RULE #4 names exactly this: _two badges that
mean different things and render the same grey are wrong, not safe._

## Where it lives

Everywhere; `grep -rn 'color="neutral"' piggles/apps/workbench --include=*.tsx`
is the census.

## The fix

**Eight are already closed**, because they needed no judgement — RULE #4 states
the answer for them outright (_"a destructive control is `danger`"_), and
`social/cadence.tsx` already ships that exact pattern beside one of them:

| File                                                                                                    | Control                          |
| ------------------------------------------------------------------------------------------------------- | -------------------------------- |
| [automations/automation-editor.tsx](../../../apps/workbench/surfaces/automations/automation-editor.tsx) | Discard draft                    |
| [builder/site-identity.tsx](../../../apps/workbench/surfaces/builder/site-identity.tsx)                 | Remove (logo)                    |
| [commerce/collection-rules.tsx](../../../apps/workbench/surfaces/commerce/collection-rules.tsx)         | Remove (rule)                    |
| [commerce/media-field.tsx](../../../apps/workbench/surfaces/commerce/media-field.tsx)                   | Remove (image)                   |
| [crm/customer-detail.tsx](../../../apps/workbench/surfaces/crm/customer-detail.tsx)                     | Remove photo                     |
| [inventory/barcode-conflicts.tsx](../../../apps/workbench/surfaces/inventory/barcode-conflicts.tsx)     | Remove it from this item         |
| [inventory/stock-grid.tsx](../../../apps/workbench/surfaces/inventory/stock-grid.tsx)                   | Discard                          |
| [social/cadence.tsx](../../../apps/workbench/surfaces/social/cadence.tsx)                               | "Just a reminder" badge → `info` |

Each keeps its `variant`, so meaning comes from the color and loudness from the
variant — a `danger ghost` Remove is quiet and still says what it does.

Four more were closed on the invoice panes as part of
[065](065-her-invoices-were-labelled-in-the-databases-words.md) and
[066](066-a-cheque-was-spelled-two-ways-and-a-transfer-was-called-ach.md).

**The remaining 432 need a decision, and there are three plausible shapes:**

- **Colorless by default.** Strip `color` and `variant` from every button that
  is chrome, leaving `<Button size="sm">`. Mechanical, reversible, and the
  memory records this as the answer Brandon gave for secondary controls. The
  risk is that ~54 `Cancel` buttons currently sitting quiet as `ghost` become
  visually louder, since a bare `.btn` is not a ghost.
- **Case by case, app by app.** Correct, slow, and the only way the 96 badges get
  right — most of them are states with a real tone available.
- **Approve the lot as-is** and record it, so the rule stops being violated by
  standing code.

I am not choosing between these unasked; the badges alone change what a shopkeeper
can read at a glance, and RULE #4 puts the choice with Brandon.

## Confirmed by

—
