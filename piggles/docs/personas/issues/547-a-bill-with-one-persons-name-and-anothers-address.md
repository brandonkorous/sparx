# 547 — A bill with one person's name on it and another person's address

**Status:** fixed and proven
**Severity:** high
**Found by:** Devi, reading who owes her money
**Surface:** `piggles|sparx/apps/workbench/surfaces/invoicing/bill-to.tsx`
**Filed:** 2026-09-16
**Family:** [[feedback_absent_behaves_like_fine]] · [[feedback_honor_the_users_choice]]

## What she saw

Invoices. Eight rows late, $986.50 between them. Top of the list:

> **INV-000004 · Wren Ashcombe · 8 days late · Owed · $276.00**

She opened it. The invoice is filed under **Marguerite Adeyemi**, and it was
emailed to **marguerite.adeyemi@example.com**.

Wren Ashcombe is a different customer, with her own email address, who has never
been told she owes $276. Marguerite has a bill with somebody else's name printed
on it. Nothing on the list says any of this.

## Measured

```sql
select d.number,
       c.first_name || ' ' || c.last_name as filed_under,
       d.bill_to->>'name'  as printed_name,
       d.metadata->>'sentTo' as emailed_to
from billing_documents d left join customers c on c.id = d.customer_id
where d.tenant_id = '<juniper row>';
```

| invoice                | filed under            | printed name       | emailed to               |
| ---------------------- | ---------------------- | ------------------ | ------------------------ |
| INV-000001             | Marguerite Adeyemi     | Marguerite Adeyemi | marguerite.adeyemi@…     |
| **INV-000004**         | **Marguerite Adeyemi** | **Wren Ashcombe**  | **marguerite.adeyemi@…** |
| INV-000005             | Marguerite Adeyemi     | Marguerite Adeyemi | marguerite.adeyemi@…     |
| … 7 more, all agreeing |                        |                    |                          |

The seed writes `billTo: { name: party.name }` with the matching `customerId`,
and no email at all, so it cannot produce this row. It was made through the
console.

## The cause

```ts
onSelect={(customer) => {
  onChange({
    customerId: customer.id,
    billTo: {
      ...value,
      // Fill what's empty, keep what was typed.
      name:  value.name  || customerLabel(customer),
      email: value.email || (customer.email ?? ''),
    },
  });
}}
```

The comment says what it is trying to do. The code cannot do it: it asks whether
the box is EMPTY, which cannot tell what she typed from what the picker
autofilled a moment ago from the previous customer. So changing who a document
is for leaves the last person's name and address sitting on it, in silence.

The list column shows the printed name (`billedToName`, frozen `billTo` first —
correct, and documented), so the disagreement is invisible on the screen she
chases money from.

## Reproduced on screen

1. INV-000004, customer Marguerite Adeyemi, printed name "Wren Ashcombe".
2. Clear the customer. Nothing changes.
3. Pick **Wren Ashcombe**. Customer, printed name and the picker's own subtitle
   now all say Wren Ashcombe.
4. The Email field still reads `marguerite.adeyemi@example.com`, under the label
   _"Where the invoice gets sent"_.

Everything on the screen says Wren Ashcombe except the one field that decides
where the bill actually goes.

## The fix

`bill-to-fill.ts`, beside the screen, importing nothing:

**A printed field follows the customer while it still agrees with the customer
it belongs to, and stays once it has been deliberately made different.**

That is the question the old code was reaching for; emptiness was a bad proxy
for it. It also survives a reload, which a remembered-autofill flag would not.

An invoice addressed to a person's business, or to an accounts-payable
department, is exactly the case that must keep its text — and it does, because
that text does not match the attached customer.

Two more parts, because one alone leaves a hole:

- **Clearing takes their details with them.** The picker has no swap: changing
  who a document is for means clearing and then choosing. If the name survives
  the clear, the next pick has nothing to compare against and keeps it — the
  same bug, one step later.
- **A warning under the Email field.** No fix to the picker repairs a document
  already in this state, so the screen has to be able to say so:

  > ⚠ This is not Wren Ashcombe's address. Sending goes here, and their own
  > address is wren.ashcombe@example.com.

  Only the email, and only when a customer is attached. The printed NAME is
  allowed to differ; the address is where the bill physically goes.

## Proven

The warning renders on INV-000004 as it stands. Clearing the customer empties
the printed name (it was Wren's) and keeps the email (it was deliberately not
Wren's). 17 guards in `bill-to-fill.test.ts`, proven red by restoring the
`||` version (4 of 13 fail).

The record itself is left alone: which of the two people the $276 belongs to is
hers to say, and the screen now tells her there is a question.

## Related

Issue [546](546-no-customer-matches-that-over-a-customer-who-exists.md) — the
same picker could not find "Wren Ashcombe" by name at all, and advised adding
her again.
