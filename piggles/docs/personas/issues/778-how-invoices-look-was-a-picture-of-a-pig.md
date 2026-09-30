# 778 — "How invoices look" was a picture of a pig

**Status:** fixed
**Severity:** high
**Found by:** P03 · Juniper Row · act 275
**Surface:** mypiggles + sparx workbench — `invoicing.templates`, `invoicing.template.edit`, `invoicing.template.preview`
**Filed:** 2026-09-22
**Blocked on:** —

## What happened

Having just found out what Tamsin actually receives (issues 774–776), the next
question is the obvious one: can I make it look like mine?

**How invoices look** opened on a cartoon pig at a laptop and one sentence:

```
Print templates
Print templates control what an invoice looks like when a customer opens or
prints it. This screen is still being built. It will open here when it is ready.
```

## Why it matters more than an unbuilt screen

Everything behind it was already built. Not partly — entirely:

```
GET    /v1/invoicing/templates                 list, seeding the built-in default on first use
POST   /v1/invoicing/templates                 create
GET    /v1/invoicing/templates/:id             fetch
PATCH  /v1/invoicing/templates/:id             rename / save the draft tree
DELETE /v1/invoicing/templates/:id             delete
POST   /v1/invoicing/templates/:id/publish     snapshot the draft into the published copy
POST   /v1/invoicing/templates/:id/default     make this the one customers get
GET    /v1/invoicing/templates/:id/preview     render it as a real page
```

Plus the service, the audit entries, the Prisma model, the node-tree renderer,
the built-in default layout, and five MCP tools. A tenant with an AI client
attached could design their letterhead; a tenant with a browser could not.
[[feedback_screen_over_a_function_nobody_calls]] inverted — a whole capability
with no way in.

The gap is invisible to every check in the repository, because a placeholder
surface is a registered, typed, linted, rendering React component. It is only
visible by opening it. [[feedback_test_as_a_business_owner]]

## What was done

Three surfaces, in both consoles.

**`invoicing.templates`** — the list. Same shape as the invoices and workflows
lists next door: recessed pane, toolbar card, table card. The column that matters
is not "Default".

**`invoicing.template.edit`** — the editor. A `max-w-3xl` column of `FormSection`
cards, the house layout for every editor here. Name, which business it is for,
and the page itself as an ordered list of blocks that drag to reorder.

**`invoicing.template.preview`** — a pane, not a panel welded to half the editor.
The same arrangement the invoice preview uses, and the thing Devi already named
as the best idea in the module: _"the old way I have seen elsewhere is a preview
nailed to half the screen whether you want it or not. This one is a tab."_

### The one design decision that matters

A template carries two booleans, `isDefault` and `published`, and **neither
answers "so what do my customers get"**. A published template that is not the
default is in force nowhere. A default that was never published is in force
nowhere either — the print routes quietly fall back to the built-in layout. So
the screen never prints either flag. `template-standing.ts` combines them into
one badge and one sentence:

|                       | badge             | what it says                                                                                              |
| --------------------- | ----------------- | --------------------------------------------------------------------------------------------------------- |
| chosen + published    | **In use**        | This is what your customers get.                                                                          |
| chosen, not published | **Not turned on** | Chosen, but never published, so customers still get the standard layout. Press Publish to start using it. |
| published, not chosen | **Ready**         | Published, but it is not the one in use. Press "Use this one" to switch to it.                            |
| neither               | **Draft**         | Only you can see this. Nothing has been sent on it.                                                       |

Juniper Row's seeded template was in the second row of that table. The old
screen could not have told her, and a screen printing "Default" would have told
her the opposite of the truth.
[[feedback_never_present_absence_as_measurement]]

"Draft" carries no color at all — a bare `.badge`. A draft is not a state the
template is IN, it is the absence of one, and there is nothing for a color to
distinguish it from. That is a colorless control, not `neutral`.

### The blocks, in her words

The stored template is a BuilderNode tree. The editor shows the root's children
as a flat, ordered list and never says the word "node" or a type name:

```
InvoiceMasthead   → The top of the page
InvoiceParties    → Who it is for
InvoiceLineTable  → What they are paying for
InvoiceTotals     → The amounts
Prose             → Your own words
InvoiceNotes      → The note on this invoice
InvoicePayments   → Payments received
InvoiceFooter     → The line at the very bottom
```

Nine data-aware blocks and five chrome ones, each with a sentence saying what it
puts on the page. The ones drawn from the invoice carry a **Filled in for you**
badge and have nothing to type; the rest open a field underneath the row. A
nested group authored elsewhere is shown as one block that can be moved and
removed but not opened — an editor that silently flattened it would delete
somebody's work on save.

The whole row header is the drag surface, no handle, matching the workflow stage
canvas one file over. [[feedback_drag_whole_element_not_handle]]

## What driving it caught that writing it did not

Four defects in the new code, all found by clicking rather than by any check.
None of them would have failed a typecheck, a lint or a test.

**A space could not be typed.** The terms textarea is controlled, so every
keystroke went out through `textToProse` and came straight back through
`proseToText` to redraw the box — and `textToProse` trimmed each line. The space
after "Payment" was removed before the "i" of "is" arrived.
"Payment is due within 14 days." came out of the box as
"Paymentisduewithin14days.", and pressing Return did nothing at all. The tidying
is real and still happens, once, on the way to the server.
[[feedback_the_empty_control_is_the_untested_one]]

**Opening a saved template showed a blank editor.** The "unsaved changes"
baseline was seeded with a plain `JSON.stringify` while every later comparison
ran through `comparableDraft`, which strips the per-block React keys. Two
different shapes, so the first comparison always differed and the pane was dirty
before anyone touched it — and the adopt effect is GUARDED on dirty, so it never
adopted.

**Saving folded shut whatever you had open.** Block keys were minted fresh on
every read, so every row was a new row to React each time the server answered.
They are derived from the node's own id now, which is already unique and already
stable across a save.

**The new-template screen promised a copy of the standard layout and gave an
empty page.** The API defaults the tree when none is sent; the console always
sent one, and for a new template that was a section with no children.
[[feedback_a_promise_in_copy_is_a_contract]]

## Proof

Walked end to end as Devi, on the real console:

```
opened          Default · Every business · Not turned on
typed           terms on two lines, with spaces        saved
published                                              In use
INV-000009      her two lines now print on the bill
created         a second template, renamed, reordered by drag, a block removed
published it                                           Ready
Use this one                                           In use — and INV-000009 lost her terms live
switched back                                          Default In use, her terms return
```

The invoice preview beside it updated on every one of those without being told —
it is keyed off the same query and never looks for the editor.

At a 360px pane both surfaces are clean: the list keeps Name and "Customers get"
and moves the business under the name, the editor stacks every field and the add
control, and there is no horizontal scroll at any point.

Tests: 24 new assertions per console (`template-blocks.test.ts` 18,
`template-standing.test.ts` 6). Six were watched going red — one per defect
above, plus a removed block kind and a dropped `class` on save.
[[feedback_a_test_that_cannot_go_red]]

## Files

- `piggles|sparx/apps/workbench/surfaces/invoicing/template-blocks.ts` (new) + `.test.ts`
- `piggles|sparx/apps/workbench/surfaces/invoicing/template-standing.ts` (new) + `.test.ts`
- `piggles|sparx/apps/workbench/surfaces/invoicing/template-data.ts` (new)
- `piggles|sparx/apps/workbench/surfaces/invoicing/templates-list.tsx` (new)
- `piggles|sparx/apps/workbench/surfaces/invoicing/template-block-list.tsx` (new)
- `piggles|sparx/apps/workbench/surfaces/invoicing/template-editor.tsx` (new)
- `piggles|sparx/apps/workbench/surfaces/invoicing/template-preview.tsx` (new)
- `piggles|sparx/apps/workbench/lib/surfaces/catalog/invoicing.ts`
- `piggles/apps/workbench/lib/console/vocabulary.ts`

## Gap to 10

The editor arranges blocks; it does not lay two of them side by side, and it
cannot open a nested group. Both are real things a designer wants and neither is
something a first version of this screen should invent. The blocks it does offer
are every one the renderer understands, which is the bar that matters: nothing
offered here draws nothing.
