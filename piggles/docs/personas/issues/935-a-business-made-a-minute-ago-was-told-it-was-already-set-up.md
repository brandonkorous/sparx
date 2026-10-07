# 935 — A business made a minute ago was told it was already set up

**Status:** fixed (act 325)
**Severity:** major
**Found by:** P03 · Juniper Row · act 325, re-scoring the two setup panes on a business of her own made for it
**Surface:** mypiggles › Set up step by step, Describe your business, the search box, a saved tab, Home's checklist, and getpiggles' setup (both consoles, api-rest, `@wizeworks/db`)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P03 · two new test businesses, Juniper Row Workshops and Juniper Row Mending, signed up on localhost
**Blocked on:** —

## What happened

Both setup panes were scored Ease 4 on Devi's real business, which is two
months old. Their gaps could only be checked on a business that had never been
set up. So Devi signed up a second one, Juniper Row Workshops, on getpiggles:
name, trade (Clothing & accessories), a design, **Take me in**. It landed on
Home in under a minute.

Then she typed "set up" in the search box.

1. **"Get set up" came sixteenth.** Above it: Set up your stock, Planning
   settings, How stock is valued, Units of measure, Spending limits and ten
   more. The box drops "up" as a filler word, and "set" alone starts the word
   "settings", so every settings screen matched.
2. **"Set up step by step" said "Juniper Row Workshops is already set up".**
   The business was a minute old. The words were right in their own way:
   getpiggles had just named the business, picked its trade and laid down a
   design, so the guard that protects a running business from being set up
   twice (issue 364) found pages and stopped. "Describe your business" does the
   same. Every Piggles business goes through getpiggles before this console
   exists for it, so **no Piggles business can ever reach either flow**. The
   launcher offered two doors onto a screen saying the door was closed.
3. **The search box could not see her practice data.** Its own note read "101
   products, 7 customers and 10 orders are not in this box yet, so it cannot
   look at them", with **Put them back**, on a business three minutes old.
   Signup's furnish loads the trade's practice records in bulk and announces
   none of them one at a time. The console's own Load practice data button asks
   search to rebuild afterwards (sparx issue 086). Signup, the path every new
   business takes, never did.
4. **A tab left open on a screen that is gone printed its code name.** "This
   panel is no longer available. It was saved in your workspace but the
   feature it showed has since moved", then `workbench.onboarding` in code
   type. "Moved" named no place to go, and there was no button.
5. **Home never said the alarms were practice.** "5 things are waiting for
   you": 2 orders to send, 1 booking to confirm, 2 late invoices, 16 items sold
   out, 49 running low, all from the practice pack. Home has a "Let us get you
   going" checklist for exactly this business (add the first thing you sell,
   someone you work with, your first invoice), and it never showed: each step
   read the list's own total, the practice pack had put a hundred products,
   seven customers and eight invoices in those lists, so every step read done
   and the checklist retired itself before anybody saw it.

## What should have happened

- Searching "set up" puts Get set up near the top.
- A screen this console can never use is not offered (the rule for
  `finance.subscription`, which lives on getpiggles for the same reason:
  piggles/CLAUDE.md, "The three surfaces").
- A business that arrives with practice records can search them.
- A dead tab says so in her words and offers the one thing to do: close it.

## The fix

- **Both setup flows are hidden in Piggles** (`lib/console/hidden.ts`, moved
  out of `product.tsx` so it can be tested without rendering). Setup is
  getpiggles' job, scored 9 there.
- **The search box** runs its word-by-word fallback only when nothing matches
  the whole phrase (`launcher-match.ts`, both consoles). "set up" now reads Set
  up your stock, Set up a path, **Get set up**, What kind of business, Practice
  data.
- **Signup's furnish asks search to rebuild** once the practice records are
  down (`furnish-tenant.ts`). The request moved to `lib/search-rebuild.ts` so
  the console's Load button and signup share one function.
- **A dead tab** reads "This screen is not here any more. It was open the last
  time you used Piggles, and it has since been taken out or replaced. Closing
  this tab changes nothing else in your workspace", with **Close this tab**
  (`surface-mount.tsx`, both consoles). Its "Try again" sibling lost
  `color="neutral"`.
- **The checklist counts her own records.** `GET /v1/sample-data/own?kind=`
  (api-rest) counts products, customers or invoices that are not practice rows
  (by the markers Clear removes them by) and, for products, not a design's
  example products either (by the install's own artifact rows). `countOwnRecords`
  lives in `@wizeworks/db` beside the markers. The checklist's three reads use
  it, under the same cache keys, so adding a product still refreshes its tick.
- **The checklist says what the practice records are**, while any are loaded:
  "The products, customers, orders and invoices already here are practice ones,
  so you can try anything without a real customer. These three tick when you
  add your own. Clear the practice ones whenever you are ready", the last part
  opening Practice data.
- **`gen-pane-ratings.mjs`** read the hidden list out of `product.tsx` with
  `indexOf`. After the move that would have been `slice(-1, -1)`, an empty
  list, and the next regeneration would have put every hidden screen back in
  the table without a word. It now reads `hidden.ts` and refuses if it cannot
  find the list.

## Proof

- `lib/console/hidden.test.ts`: both setup flows hidden, Get set up not.
  Removing `'workbench.onboarding'` from the list reddens 1 of 3.
- `launcher-match.test.ts` (both consoles): "set up" returns exactly Set up
  your stock and Get set up from four screens; "stock planning", which nothing
  answers whole, still goes word by word. Removing the rule reddens 1 of 17.
- `furnish-tenant-reindex.test.ts`: furnish asks for a rebuild after the
  practice records load, and still furnishes when the broker is down. Removing
  the call reddens 1 of 2.
- On screen: Juniper Row Workshops, made before the furnish fix, showed the
  "not in this box yet" note. Juniper Row Mending, signed up after it, found
  "Heritage Crewneck Tee" and 23 more practice records on the first try, with
  no note. "set up" listed Get set up third. The old Set up step by step tab
  showed the new words and **Close this tab** closed it.
- `sample-data-own.test.ts`: the route answers the own count for the kind
  asked, and refuses `kind=orders` without counting. The counting itself has no
  unit test (`@wizeworks/db` has no test seat); it was checked on screen below.
- On screen, Juniper Row Mending: **Let us get you going** appeared with all
  three steps open and the practice sentence. Devi added "Visible mending kit"
  at $24, went back to Home, and the first step read **You have something to
  sell** while the other two stayed open. On Devi's real Juniper Row, which has
  its own products, customers and invoices, the checklist stayed away.
- The generator, run after the move, read the list and then refused to
  overwrite 332 scored rows, as it should.

## Test data this made

Two test businesses on localhost, both kept: **Juniper Row Workshops**
(`p03.devi.workshops@piggles.test`) and **Juniper Row Mending**
(`p03.devi.mending@piggles.test`), each with the clothing practice pack and the
Fashion Boutique (Minimal) or Universal Starter design. Juniper Row Mending
also has one real product, "Visible mending kit" at $24.
