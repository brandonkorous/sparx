# 745 — The picker named a screen, would not open it, and threw the name away

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 266
**Surface:** mypiggles + sparx workbench — the customer picker, wherever it appears
**Filed:** 2026-09-19
**Fixed:** 2026-09-19
**Confirmed by:** P03, adding a buyer who did not exist yet
**Blocked on:** —

## What happened

Adding the buyer at Loom and Larder under **Who can order**. Typed her name:

```
Tamsin Vale
No customer matches that. Add them in Customers first.
```

True, and a dead end. The sentence names a screen and will not open it, and the
name that was just typed is thrown away. What it actually asks for:

1. leave this screen, remembering the name
2. find Customers
3. find the button that makes one
4. **type the name again**
5. fill the form, save
6. find Loom and Larder again
7. scroll to Who can order
8. **type the name a third time**

Eight steps, the name typed three times. Typing a name three times is also how
the same person ends up in the book twice.

**Not a one-off.** This is the same shape as
[740](740-a-wholesale-price-with-no-way-to-set-it.md) §3, a sentence saying
"Create one under your trade customers" with nothing to click, one screen over.
That one was found because it sat on the path being walked. This one is the
control it sits in.

## What was done

**`SearchPicker` learned a way out.** An optional `nothingFoundAction`, given
the text that was typed, so the button can name the thing being made:

```
Nobody you already know is called that.
[ + Add Tamsin Vale as a customer ]
```

Optional on purpose: a picker over records a person genuinely cannot create from
where they stand keeps the plain sentence rather than growing a button that
leads nowhere. ([[feedback_structural_checks_go_blind]] is the same lesson about
guards; a control that can only reject is only half a control.)

**The screen it opens arrives with the answer already in it.** `emptyDraft` now
takes a seed, so the new-customer form comes up with the name split into its two
boxes and the wholesale business already chosen. With
[744](744-filed-as-wholesale-and-charged-retail.md) in the same pass, saving once
makes her a member: back on the account, she is already under Who can order.

Eight steps became two.

**`splitTypedName`** sits beside `customerName` as its reverse. Everything
before the LAST space is the first name, so "Mary Jane Vale" is "Mary Jane" and
"Vale" rather than "Mary" and "Jane Vale" — a surname is one word far more often
than a first name is. Both boxes stay editable, so a wrong guess costs a click.

## Found while fixing it, worth writing down

The first version of `splitTypedName` shipped `/s+/` where it meant `/\s+/` — a
regex matching a literal letter s. "Orla Beaumont" went into the first-name box
whole and the surname box stayed empty. Typecheck, ESLint and 1,121 tests were
all green: **a regex that matches nothing is still a valid regex.** Only opening
the screen showed it. [[feedback_test_as_a_business_owner]]

The cause was a shell heredoc eating the backslash before Node saw it, which is
a thing to know about this machine: assert the anchor COUNT and it still will not
catch a replacement that lands wrong.
[[feedback_codemod_diff_your_own_sweep]]

## Files

- `piggles|sparx/apps/workbench/components/search-picker.tsx` — `nothingFoundAction`
- `piggles|sparx/apps/workbench/surfaces/invoicing/customer-picker.tsx` — `onAddNew`
- `piggles|sparx/apps/workbench/surfaces/b2b/account-detail.tsx` — the first caller
- `piggles/apps/workbench/surfaces/crm/customer-display.ts` — `splitTypedName`
- `sparx/apps/workbench/surfaces/crm/customers-data.ts` — the same, where sparx keeps `customerName`
- `piggles|sparx/apps/workbench/surfaces/crm/customer-detail.tsx` — the seeded draft
- `piggles|sparx/apps/workbench/surfaces/crm/split-typed-name.test.ts` — new

## The other pickers, closed in act 267

Every call site was walked, and the answer is not the same at all of them.

**Wired**, because a document or a sale cannot proceed without a real record:

| screen                        | what it opens                         |
| ----------------------------- | ------------------------------------- |
| Take a sale                   | the customer form, beside, name in it |
| Invoices › Bill to            | the same, threaded through as a prop  |
| Repeat orders › Who it is for | the same                              |
| Waiting list › Who is waiting | the same, and the dialog stays open   |

Opening BESIDE rather than on top is the point on three of those: the form
behind is half filled in, and the new customer is findable the moment it saves,
because both picker keys live under `['crm','customers']`.

**Deliberately not wired**, because the screen already answers it: the booking
form and a repeating slot both work with NO customer named, and the booking form
carries an "Or just their name" box directly beneath the picker for exactly the
walk-in this would duplicate. Adding a second path there would compete with one
that already exists.

The till's section description said "Add them in Customers if this is their first
time" as well, which was the same dead end in a second place; it now says
somebody buying for the first time can be added from the field.

## Proof

Typed "Orla Beaumont" into Who can order on Loom and Larder. The picker offered
**Add Orla Beaumont as a customer**; the new-customer screen opened with
**Orla** / **Beaumont** in the two name boxes and **Relationship: Wholesale**
with **Loom and Larder** chosen.

Seven tests on `splitTypedName`, proved red by reinstating the original `/s+/`:
**6 of 7 failed.**

Act 267: driven again on the till, where the field now reads "somebody buying for
the first time can be added from here" and the picker offers the button in place
of the old sentence.
