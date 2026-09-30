# 746 — The till calls a shopper by her employer's name, and a wholesale buyer by nobody's

**Status:** fixed
**Severity:** major
**Found by:** P03 · Juniper Row · act 267
**Surface:** mypiggles + sparx workbench — Take a sale, Wholesale customers (Who can order), Invoices (Bill to), Repeat orders
**Filed:** 2026-09-20
**Fixed:** 2026-09-20
**Confirmed by:** P03, on the till with three people called Loom
**Blocked on:** —

## Three rows, and the one that looked like the business was not

A shop rang an order through. At the till, searching **Loom**:

```
Loom & Larder                        priya@loomandlarder.co.uk
Orla Beaumont                        orla@loomandlarder.com
Tamsin Vale                          tamsin@loomandlarder.com
```

**Loom & Larder is Priya Nandakumar**, a private customer at full price who
typed her employer into a box at checkout. **Orla and Tamsin** are the two
people who really do buy for Loom and Larder, on the agreed prices from
[740](740-a-wholesale-price-with-no-way-to-set-it.md) and
[744](744-filed-as-wholesale-and-charged-retail.md).

Nothing on the row said so. On the screen where picking the wrong one is
**$44 a jumper** ([737](737-the-till-charges-list-price.md)).

## One console, two answers

Both functions exist, in the same app, about the same record:

```
customerName   surfaces/crm/customer-display.ts     person → typed employer → email
customerLabel  surfaces/invoicing/customer-picker-data.ts   typed employer → person → email
```

The Customers list uses the first and gets it right — it showed **Priya
Nandakumar**, with her employer in its own **Company** column and a
**Wholesale** badge on the two who have one. The picker used the second.

`customerLabel` is not wrong; it is answering a different question. An invoice
for somebody buying on behalf of a shop is **made out to the shop**, so a
document addressee genuinely prefers the business. It was simply being used
where a PERSON was being named.

**MEASURED 2026-09-20, all 43 tenants, 745 live contacts:**

```
shown as a business name, actually retail      605
filed under a wholesale business                11
of those, shown as a private person              4
```

Six hundred and five people offered under somebody else's company name, and the
four who most needed the badge had nothing.

## The two other things the row never said

**Which business prices them.** `companyId` was not even in the type the picker
fetched, though the API has always sent it. "Wholesale" alone is no use to
somebody supplying six shops.

**That they are wholesale at all.** The Customers list has said so with a badge
for as long as it has existed. The till, where the word decides the money, did
not.

## What was done

**The picker names the PERSON** — `customerName`, the same function the
Customers list uses, so one person reads the same in both places.

**The row carries a mark**, `PickerRow.mark`, shown in the results AND on the
chosen row, because a fact that changes the price has to survive being picked.
It repeats the list's own rule: worn only when the relationship is noteworthy,
since a retail individual is the unremarkable default.

**The second line leads with the business that prices them**, resolved from
`companyId` through the same accounts read the customer editor already makes, so
neither screen pays for its own list and both name a business identically. The
typed employer stands in when there is none, and the email follows either, so
the two Dave Kellys every real address book has stay apart.

**`customerLabel` is now `billingName`**, with one caller — the Bill to field —
and a name that says it addresses a document rather than a person. The account
screen's toast and the repeat-order alerts moved to `customerName`; they were
naming humans all along.

The row now reads:

```
Orla Beaumont   [Wholesale]     Loom and Larder · orla@loomandlarder.com
Tamsin Vale     [Wholesale]     Loom and Larder · tamsin@loomandlarder.com
Priya Nandakumar                Loom & Larder · priya@loomandlarder.co.uk
```

## What this is NOT

**Not a case of the typed employer being junk.** It is a real fact about a real
person and it stays on the row — as the second line, where it belongs, rather
than as their name. The schema has said so in its own comment since it was
written: "The employer they TYPED, which is not the same fact as `companyId`."

## Files

- `piggles|sparx/apps/workbench/components/search-picker.tsx` — `PickerMark`
- `piggles|sparx/apps/workbench/surfaces/invoicing/customer-picker-data.ts` — `customerPickerRow`, `billingName`
- `piggles|sparx/apps/workbench/surfaces/invoicing/customer-picker-data.test.ts` — new
- `piggles|sparx/apps/workbench/surfaces/invoicing/customer-picker.tsx` — the business lookup
- `piggles|sparx/apps/workbench/surfaces/invoicing/bill-to.tsx` — the one caller that wanted the old answer
- `piggles|sparx/apps/workbench/surfaces/b2b/account-detail.tsx`, `commerce/repeat-order-new.tsx` — naming a human

## Proof

Twenty tests, proved red three ways:

- Naming the row with `billingName` again, which is the defect: **1 of 20**, the
  Priya case exactly.
- Dropping the business from the second line: **1 of 20**.
- Unwiring the lookup in the pane and passing `null`: **1 of 20**, the
  structural half, which exists because the pure function can be perfect over a
  caller that never hands it anything.

On screen, with three people called Loom in front of her, the two who get agreed
prices now say so before a single item is typed — and the chosen row keeps
saying it.
