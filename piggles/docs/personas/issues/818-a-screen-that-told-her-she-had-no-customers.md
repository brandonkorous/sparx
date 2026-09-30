# 818 — A screen that told her she had no customers

**Status:** fixed
**Severity:** correctness
**Found by:** P03 · Juniper Row · act 281
**Surface:** mypiggles + sparx workbench — `crm.records.list`, `crm.record.detail`, `crm.orders.list`, `crm.mailboxes.list`, `crm.phone-systems.list`, `crm.phone-system.connect`, `crm.task.detail`
**Filed:** 2026-09-25
**Fixed:** 2026-09-25
**Confirmed by:** seen on screen as Devi
**Blocked on:** —

## 1. "No customers yet · 0 in total", on a shop with forty

`/crm/records/contact` drew a complete, working list pane:

> **No customers yet**
> You made this up yourself, which means nobody else's software has it. Add the
> first customer and it will show here, with its own search, its own saved
> views, and a page of its own.
>
> 0 in total

Every sentence is false. Devi has 40 customers, she did not invent the idea of
a customer, and nothing will ever show on that screen.

`crm_records` holds **tenant-invented objects only**. The four built-ins —
contact, company, deal, ticket — each live in their own table with their own
screen. Addressed with a built-in key, this pane queries a table that by
definition has no rows for it, and reports the emptiness as a fact about her
business. [[feedback_never_present_absence_as_measurement]]

**`/crm/records/contact/new` is worse.** It draws a working **New customer**
form with an **Add customer** button. Pressing it writes a customer that never
appears on the Customers screen, can never be sold to, and can never be found.

The fact that stops both was already on the record the pane had fetched:
`kind: 'builtin'`, sitting on the object type, drawn by nothing.
[[feedback_fetched_but_never_rendered]]

Both panes now say so, and take her where the records really are:

> **Customers have a screen of their own**
> This screen is for the things you chose to track yourself. Customers came
> with Piggles, so adding one here would make something none of your other
> screens could ever find.
> **[Open Customers]**

A built-in key with no screen mapped still gets the refusal, without a way
through: being sent nowhere is better than being told a number that is not
true.

## 2. A third copy of the order filter, and it disagreed with its own rows

**Customer orders** filtered by:

> All orders · Placed · Fulfilled · Delivered · Canceled · Refunded

while the badges six rows below it read:

> To send · On the way · Collected · To collect · Sent, then refunded

`shippingState`'s own header explains why that matters:

> "fulfilled" in particular reads as "finished" to everyone who has not worked
> in commerce, when it means the opposite: it has just left the building.

That was the only rendered "Fulfilled" left in the console.

`orders-list-filters.ts` already exists, and its header says it was written
because the shop's Orders and Wholesale orders kept two hand-copied lists that
drifted. This was a third, built straight out of the stored values, and it had
drifted furthest. It also ignored the rule that file states in capitals — a
chip may not name a delivery method, because one stored status covers both
sending and collecting — and it carried a "Refunded" the shared list leaves
out for a stated reason.

It reads **All orders · To pack · Packed · They have it · Canceled** now, from
the shared list, and `orders-list-filters.test.ts` fails on a fourth copy.

**The guard could not go red at first.** Written as a built `RegExp`, `\s`
inside a template literal collapsed to a bare `s`, so it compiled to
`^s*placed:` and passed over the very copy it existed for. It matches plain
strings now. [[feedback_a_test_that_cannot_go_red]]

## 3. "Your phone provider" is one specific company

**Connect a phone system** asks for an **Account SID** and an **Auth token**
and tells you where to find them:

> On your phone provider's dashboard home page, in the account panel.

`provider: 'twilio'` is hardcoded. Devi would open her mobile carrier's
account page, find no Account SID anywhere on it, and have no way to learn
why. Advice that names the wrong place is worse than no advice.
[[feedback_one_outcome_two_causes]]

It says Twilio now, in the intro and on both fields. Another company's product
name is one of the things this console is allowed to print, for exactly this
reason: the screen has to say what she will actually see.

## 4. Two panes that skipped the house empty states

**Phone systems** and **Mailboxes** both drew a bare silica `<EmptyState>`,
which `components/pane-empty.tsx` says in its own header it exists to stop.
Beside Email templates, which uses `PaneEmpty`, the difference is a small grey
glyph against this app's own artwork. Both use `PaneEmpty` now, and their
failed-read branch uses `PaneLoadError` rather than a hand-rolled one.

Both toolbars were also **empty on the left**. Every other pane says what it is
showing; the one place a person looks to know where they are said nothing.
They carry a count now.

## 5. Six sentences that assume a team

Devi is a sole trader. Measured: **102 uses of "your team"** in rendered
Piggles copy. Most are fine — the My Team app is about a team, and a
non-admin being told to ask an admin genuinely has one. Six were describing a
feature's value in a way that left her out, and each reads better without it:

| where              | was                                         | is                                                |
| ------------------ | ------------------------------------------- | ------------------------------------------------- |
| Email templates    | a message your team can pick                | a message to pick from when you email             |
| Customer documents | Only your team can see them.                | Nobody outside your business can see them.        |
| Customer notes     | only ever seen by your team                 | only ever seen inside your business               |
| Mailboxes          | so anyone on your team can see              | so the conversation sits with everything else     |
| Connect a mailbox  | never shown to your team                    | never shown to anybody else                       |
| Bookings           | a private note just for your team           | a private note nobody outside your business reads |
| Task detail        | The person on your team who owns this task. | Whoever is going to do it.                        |

## 6. A task's own section called it a task

The Things to do list had its **"Task"** column renamed to **"What to do"** in
act 281. The detail pane's first section still read **"The task"**. It reads
**"What to do"** now.

One change here was reverted on second reading: the load-error title
"Could not load this task" was made "Could not load this one", which is vaguer
and helps nobody. A word the rename avoids is a smaller cost than an error that
does not say what failed.

## Files

- `piggles|sparx/apps/workbench/surfaces/crm/records-list.tsx`
- `piggles|sparx/apps/workbench/surfaces/crm/record-detail.tsx`
- `piggles|sparx/apps/workbench/surfaces/crm/customer-orders.tsx`
- `piggles|sparx/apps/workbench/surfaces/commerce/orders-list-filters.test.ts` — the fourth-copy guard
- `piggles|sparx/apps/workbench/surfaces/crm/phone-system-connect.tsx`
- `piggles/apps/workbench/surfaces/crm/{phone-systems-list,mailboxes-list,task-detail,templates-list,customer-documents-tab,customer-related}.tsx`
- `piggles/apps/workbench/surfaces/{funnels/campaign-setup,scheduling/booking-editing}.tsx`
- `piggles/apps/workbench/lib/console/copy.ts`

## Noted, not fixed

**74 surface files use the bare silica `<EmptyState>` and import none of the
three house components** (`PaneEmpty`, `ListEmptyState`, `PaneLoadError`). Not
all of them are wrong — a bare one inside a card, a tab or a dialog is correct,
and the defect is only a PANE's own empty state floating in the pane. Telling
those apart needs a detector that reads the JSX ancestor chain, not a grep, and
that is its own piece of work. The two found by opening the panes are fixed.
