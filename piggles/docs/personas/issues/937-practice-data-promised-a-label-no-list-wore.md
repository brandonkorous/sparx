# 937 — Practice data promised a label no list wore

**Status:** fixed (act 325), one list left unlabeled on purpose
**Severity:** copy
**Found by:** P03 · Juniper Row · act 325, re-scoring People and equipment (P02's row, Ease 6) on Juniper Row Mending
**Surface:** mypiggles › Practice data, and People and equipment (both consoles)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P03 · Juniper Row Mending, Remove practice data emptying People and equipment and leaving her own product
**Blocked on:** —

## What happened

People and equipment carried Ease 6 from P02: "A two-chair salon opens it and
finds ten people and rooms it never hired, one of them called Stylist. No way to
clear the samples in one move."

Nia's list now holds only her two real people, so that half is gone. To check
the other half, Devi opened the list on Juniper Row Mending, a test business
signed up with the clothing practice pack (issue 935). It showed **Maya Chen,
Style Advisor** and **Tomás Ruiz, Tailor**, both **In use**, with nothing to
say they were made up.

Practice data says otherwise, three times:

- under its title: "Everything added is **clearly marked as practice**, and
  you can remove it all whenever you like";
- in its Load confirm: "Everything it adds is **clearly marked as practice**";
- in the Piggles wording table: "It is all **clearly marked as samples**".

Only two lists in the console show a mark: Locations ("Sample") and AI
prompts. Products, customers, orders, invoices, bookings, people and the rest
show practice records exactly like real ones. The records ARE marked, in the
database, which is how Remove finds them. The sentence promised a mark she
could see.

On the same screen, the row of apps read **Sell, Customers, Content, Stock,
Bookings, Sell, Invoices**: two modules live in the Sell app, and each got a
chip.

## The fix

- The three sentences say what is true: each record "is tagged as practice
  behind the scenes, so you can remove them all in one go, whenever you like,
  without touching a real record". The sparx console's two copies of the
  promise ("clearly marked as a sample") say the same.
- One chip per app (`surfaces/sample-data/one-per-app.ts`).
- The "Not loaded" badge lost `color="neutral"`, in both consoles.

## Proof

- `one-per-app.test.ts`: Sell once from two of its modules. Letting a repeat
  through reddens 1 of 2.
- On screen, Juniper Row Mending: the chips read Sell, Customers, Content,
  Stock, Bookings, Invoices. **Remove practice data** asked first ("This
  permanently deletes the 101 products, 10 orders, 7 customers and 1131 more
  records"), and after it People and equipment read **Nothing set up yet**,
  while her own **Visible mending kit** was still found by search.

## Not changed

- People and equipment still shows a practice person like a real one. The list
  and its endpoint are in the scheduling files, which another session is
  editing. Home's checklist now says the practice records are there and where
  to clear them (935), and Remove takes them in one move.
- A "Practice" label on every list practice data fills is a feature of its
  own (products, customers, orders, invoices, bookings, people and nine more),
  and the copy no longer promises it.
