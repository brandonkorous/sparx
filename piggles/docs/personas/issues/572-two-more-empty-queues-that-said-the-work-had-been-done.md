# 572 — Two more empty queues that said the work had been done

**Status:** fixed and proven
**Severity:** high
**Found by:** Devi, walking the Partners menu
**Surface:** `piggles|sparx/apps/workbench/surfaces/inventory/{po-approvals,supplier-returns-list}.tsx` · `wizeworks/packages/inventory/src/services/supplier-returns.ts`
**Filed:** 2026-09-16
**Follows:** [569](569-told-my-orders-would-be-held-by-a-limit-i-had-switched-off.md) · [570](570-every-request-has-been-answered-over-a-queue-nobody-has-ever-used.md)
**Family:** [[feedback_never_present_absence_as_measurement]] · [[feedback_a_promise_in_copy_is_a_contract]]

## The pattern, four times in one afternoon

An empty list means two opposite things — **everything has been dealt with**, or
**nothing was ever asked of it** — and four screens in this console stated the
first while the second was true. Two are already filed (569, 570). These are the
other two, both under Partners → Buying it in.

## Sign-offs

> **Nothing is waiting on you**
> Every order that needed signing off has been dealt with. Orders only appear
> here when they clear a limit set under Spending limits.

```sql
select count(*) from inventory_po_approval_rules;  -- 0
select count(*) from inventory_po_approvals;       -- 0
```

**Zero spending limits exist on the entire platform. Zero orders have ever been
held.** So "every order that needed signing off has been dealt with" is a claim
about a set that has always been empty, and it reads as reassurance: my buying is
under control, everything that needed a look got one.

Nothing is under control. No limit exists, so no purchase order can be held for
sign-off however large. An owner reading that screen has exactly the wrong
picture of her own spending controls.

**Now**, verified in the browser:

> **No order can be held for sign-off**
> You have not set a spending limit, so every order goes straight to the supplier
> however large it is. Set one under Spending limits and any order over it waits
> here for your yes.

Three states, in `po-approvals-empty.ts`: no limit at all, limits all switched
off (singular and plural get their own words), and at least one live — which then
names the **lowest** live limit, because that is the one an order has to clear.
The other tabs (approved, rejected, cancelled) keep a plain "nothing reached this
state", which is true whatever the limits say.

## Sent back

> **Nothing is waiting on a credit**
> Every return you have sent has been credited or written off. Nothing is
> outstanding.

```sql
select count(*) from inventory_supplier_returns;  -- 0
```

**Zero supplier returns on the whole platform.** Nobody has sent anything back,
so nothing has been credited or written off, and "nothing is outstanding" is true
only in the way that an empty shop has no unhappy customers.

The pane's _other_ view already had the right words for a business that has never
done this. It could not reach them, because `total` in the response is the
**filtered** count and the chase view filters to `status = 'sent'` with no credit
— so an untouched business and a fully-credited one both report zero.

Interestingly, the same service already had the fix one field over:
`awaitingCreditCents` is counted against its **own** `where`, not off the filtered
rows, precisely so the money headline survives a narrowed view. `total` never got
the same treatment.

**The fix:** `everCount` — a count against the tenant alone, deliberately not
`where`. The console branches on it and falls back to the first-run words it
already had.

**Now**, verified in the browser:

> **Nothing sent back**
> When something arrives broken, wrong, or simply too much, record it going back
> here (with what you paid for it), and the credit you are owed stops being
> something one person remembers.

## Proven

**`po-approvals-empty.test.ts`** — 7 tests, both consoles, including a property:
the reassuring sentence may appear only when a live limit exists to make it
meaningful. Reinstating the original sentence for the pending tab:

```
× says no order can be held when no limit exists
× says the one limit is off rather than that everything was dealt with
× counts them when several are off, and stays plural
× names the limit that actually bites when one is on
× calls a zero limit every order
× never claims orders were dealt with while nothing can be held
```

**6 of 7 red.**

**`procurement.test.ts`** — one case against real Postgres: raise a return, leave
it a draft, and assert the chase view stays empty while `everCount` goes up.
Asserted as a **delta**, not a total, because every test in that file shares one
tenant and an absolute figure measures whatever ran before it — the lesson from
[555](555-two-screens-that-both-say-what-your-stock-is-worth-870-apart.md), and
the first version of this test failed on exactly that (`expected 3 to be +0`).
Making `everCount` honor the filter:

```
AssertionError: expected 1 to be 2
```

|                 |                                 |
| --------------- | ------------------------------- |
| inventory       | **369 pass** (32 files)         |
| piggles console | **426 pass**                    |
| sparx console   | **338 pass**                    |
| typecheck       | inventory, both consoles exit 0 |
