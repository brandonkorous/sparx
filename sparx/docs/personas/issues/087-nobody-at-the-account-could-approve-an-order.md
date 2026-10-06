# 087 — Teodora's role said "Can approve orders", and nothing ever asked her

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 5 (Wasatch Front's people, after adding Teodora to the account)
**Surface:** workbench › Wholesale › Accounts (contacts) and Approvals; site › checkout; site › account › Wholesale account (overview, orders); email
**Filed:** 2026-10-03
**Fixed:** 2026-10-04
**Confirmed by:** P01 on screen, 2026-10-03 (who signs, approve, turn down) and 2026-10-06 (search)
**Blocked on:** —

## What happened

Doty put three people from Wasatch Front Utility Contractors, LLC on the account: Renée Castañeda as "Can place orders", Marcus Oyelaran-Pike as "Can view only", and Teodora Vukić-Hale, the fleet manager, as **"Can approve orders"**. Doty also set a spending limit on the account: "Over $1,000.00 · Wasatch Front Utility Contractors, LLC · Anyone who can approve".

Renée added 3 S&S Gen2.1 kits ($352.00 each) to her 40 O-rings and placed O-000014 for $1,208.00 on account, PO WFU-PO-24-0917. It was held. Then:

1. **Before she placed it**, the payment step said only "Nothing is charged now. We add this order to your account, and you pay within 30 days of the invoice date." Nothing said it was over a limit or that anybody had to approve it.
2. **After**, the confirmation said "Your order O-000014 is waiting for us to approve it." "Us" is Gillett. The order went to Gillett's Approvals queue and a task for Gillett's team.
3. **Teodora was never asked.** No email, no list of orders to approve, no button. On the site her role reads "Approver", and every portal route treats an approver as read-only. The role did nothing at all: `role = 'approver'` was read by no code path that decides anything.
4. **A turned-down order never said why.** The console's Reject takes a reason and the event carries it, and the "Your order wasn't approved" email shows neither the reason nor who decided, and tells the buyer to "reach out to your account manager".

## What should have happened

The B2B plan (docs/10 §8) describes exactly this: "Account manager (approver role) notified · Approver reviews: approve or reject with reason · On rejection: buyer notified with reason". A role named "Can approve orders" is a promise that the person can approve orders. Renée should be told before she places a big order who has to approve it, and Teodora should be the one asked when the limit is Wasatch's own control.

## How to reproduce

1. Workbench as Doty: Wholesale › Accounts › Wasatch Front: Teodora is "Can approve orders". Wholesale › Approvals: rule "Over $1,000.00" for Wasatch, on.
2. Site as Renée (`renee.castaneda@wasatchutility.test`): cart over $1,000.00, checkout, Bill to my account, place it.
3. The confirmation says "waiting for us"; the order is in Gillett's queue; Teodora has nothing anywhere. Every time.

## Why it matters

A buyer's spending control is the reason a business like Wasatch gives a supplier a contact list with roles in it. Here the role was decorative, so either Gillett signs off Wasatch's internal spending (which is not Gillett's call and is not what Doty meant), or the approver has to be told by phone. It says something false on two screens, and the buyer finds out after placing the order that it is stuck.

## Where it lives

- `wizeworks/packages/db/prisma/schema/62-b2b-contacts.prisma`: the `approver` role, documented as "can approve orders (Ph6 purchase approval)" and read by nothing.
- `wizeworks/packages/b2b/src/approval.ts`: `approveOrder` / `rejectOrder`, staff only.
- `wizeworks/services/api-rest/src/routes/v1/public/b2b-portal*.ts`: no portal route for an approver to act.
- `wizeworks/apps/site/components/checkout/checkout-chrome.tsx:158`: "waiting for us to approve it" for every held order.
- `wizeworks/packages/builder-schemas/src/default-emails*.ts` (`b2b-order-rejected`): no reason, no decider.

## The fix

**Who signs a limit is now a choice on the limit.** `purchase_approval_rules.sign_off_by` (`'business' | 'account'`, migration `20270530000013_the_account_can_sign_its_own_orders`). `'business'` is what every limit did before. `'account'` means the account's own contacts with the role `approver` sign it, on the site.

**The rule for who has to say yes** lives in one place, `accountOrderGate.signOffState` (`wizeworks/packages/crm/src/services/account-order-gate.ts`), read by checkout, an accepted quote, the console and the site alike:

- A limit the account signs asks the account, not the business as well: it is the buyer's own control.
- An order over the credit limit always asks the business too: that is the business's money.
- An account with nobody who can approve, or whose only approver placed the order, falls back to the business, so a held order never waits on nobody.
- Either side may sign first. The order goes ahead when the last side asked has signed. Either side turning it down cancels it. Signatures are kept on the order beside the reasons it was held.
- `ruleGoverningOrder` moved here from the b2b package, because checkout now has to know which rule held an order, not only whether one did.

**The service** (`wizeworks/packages/b2b/src/approval.ts`): approve signs one side and places the order only when nothing else waits (`signHeldOrder`, `placeHeldOrder`). The business's Approve is refused, with who it waits on, when only the account is asked. New `approveOrderForAccount`, `rejectOrderForAccount`, `listAccountApprovals`, `accountOrderSignOff`, `heldOrderSignOff`. Only an active `approver` on the order's own account may sign for it, never on an order they placed, and only when the limit asks the account. Rules carry `signOffBy` and, for a one-account rule, its approvers by name. The queue carries each order's `signOff` (needs, waitingOn, signed, approvers). Found on the way: placing a held net-terms order read the account's payment terms through `customer.company`, which the client answers with the computed employer string (issue 751), so the terms were never read; it now reads the account.

**The API** (`wizeworks/services/api-rest`): new `b2b-portal-approvals.ts` (list, approve, reject for the account's approver, website session only, b2b module gated). The portal order, the buyer's own order, the checkout session (`approvalPreview`) and the checkout result (`approval`) say who it waits on. A retried checkout on a held order used to answer "not held"; it now answers what the order is.

**The events**: `b2b.order.pending_approval` carries `asks`; `b2b.order.approved` and `b2b.order.rejected` carry `decidedBy`, and rejected carries `side`.

**MCP**: `create_b2b_approval_rule` / `update_b2b_approval_rule` take `signOffBy`; the queue and approve tools describe the two sides. The remove tool said "soft: preserves its history" about a delete that has been a real delete since 2026-09-20; it now says so.

**Who is told** (`wizeworks/packages/automation*`, `wizeworks/packages/email`, `wizeworks/packages/builder-schemas`): a new action `b2b.ask_account_approvers` and seed "Wholesale order waiting: ask their approvers" email each approver at the account when the account is asked, with who placed it, the total, the limit, the PO, the lines and a "Review order" button to the order on the site (template `order-approval-request`). The business's task "Wholesale order waiting: sign it off" now opens only when the business is asked (`approval.asksBusiness`). The "Your order wasn't approved" email now says who turned it down and why, and tells the buyer to talk to their colleague when it was their own account that said no.

**The site** (`wizeworks/apps/site`): the payment step says before the order is placed who will have to approve it; the confirmation names who it waits on (it said "waiting for us" for everyone); an approver's account overview lists "Waiting for your approval" with who placed each order, the limit, the PO and a Review button; the account's order page shows who has approved and when, and gives an approver Approve and Turn down (with a reason, and a confirm naming the order and its buyer); the buyer's own order page and timeline name who it waits on; an accepted quote whose order is held names who and links the order. Sentences in `lib/sign-off-words.ts`.

**The console** (`sparx/apps/workbench`, `piggles/apps/workbench`): each limit's "who signs off" choice offers the account's own approvers by name, warns when the account has nobody who can approve and links to it; the queue says who each order waits on, offers no Approve on an order only the account signs (Reject stays), and an Approve that leaves the order waiting says so rather than "placed"; the held order's own pane says who it waits on; the account's contacts say what "Can approve orders" does.

**Found on the way: a held card order was charged, and kept when turned down.** No checkout card payment ever held the card, so "nothing is charged until it is approved" was false, and turning the order down canceled it and kept the money. Now, on a gateway that can hold (sparx Pay, the business's own Stripe), a card on an order a limit will hold is held, not charged; the last approval captures it, a turn-down releases it, and a gateway that cannot hold charges and refunds in full on a turn-down. A capture that fails (a hold lapses after about 7 days) gives the business a task and asks the buyer to pay. Also found and fixed there: the gateway catalog claimed holds for five gateways when only sparx Pay could; the business's own Stripe could neither capture nor release; sparx Pay's release always reported failure; a canceled order could not be refunded; the webhook ignored a held card.

**Found next to that:** a held order paid on a hosted payment page got "order confirmed" and `order.paid` while it waited; a booking deposit was recorded as captured or refunded whether or not the card company said yes; a waived no-show fee was charged anyway; three of the four ways an AI assistant ends a booking, and cancelling a series, never settled the card at all; a card order got two "order confirmed" emails; the booking page said "held on their card" for a fee the bank refused.

**Found during the on-screen run, all fixed:**

- **A held order took its stock twice.** The cart's hold was left behind at checkout and the approval sold the units again: O-000014 left the kit at 0 on hand and 3 set aside, and the O-rings at 11 and 40. A held order now keeps its stock set aside, with no timer, until it is decided; approving uses that hold, turning it down gives it back, and a shortfall at approval is a recorded backorder the approver is told about. The product page and the cart now agree on what is in stock, and "sold out" became "only N left" when some is.
- **A bought cart still took changes**, and a cart line could be changed through another cart's address. Both refused now; the site starts a fresh cart.
- **The business's sign-off task outlived the order.** It now closes itself when the order is decided or canceled, and a test fails if any new code changes an order's status without closing it.
- **A change to a built-in automation reached businesses a day late**, and the nightly re-sync overwrote a business's own edits, switched paused ones back on and doubled renamed ones. Built-ins now have a permanent key and a fingerprint of what sparx last wrote: untouched copies update, edited ones are kept and flagged "Newer version from sparx" with a "Use sparx's version" button, paused stays paused. A release now re-syncs right after it rolls out.
- **Order confirmations always send** (Brandon, 2026-10-03: "why wouldn't they"): an email a customer gets because of something they did is not stopped by the email module. "Welcome new customers" and "Chat satisfaction survey" are marketing (Brandon, same day).
- **An order's invoice could not be emailed.** An invoice made from a checkout order on terms was made out to the company name alone, so "Invoice on terms: email it to the buyer" failed for every one ("There is no email address to send this to"). It now goes to the address the account's last invoice went to, or the person who placed the order.
- **Search could not find an account's people or orders.** "Wasatch" found only Teodora, the one contact whose record carried a typed company name; Renée and Marcus, linked to the account but with no typed name, and every Wasatch order were unfindable by the account's name. A person's search entry now names their pricing account and every account they are a contact on, an order's names the account it was quoted, invoiced or priced to, both follow a rename, and adding or changing a contact re-indexes them. The search box says when more matched than it shows, with Show more. The new order field is asked for only once the live collection has it, so a rolling release cannot break search.
- **The computed `customer.company` shadowed the account.** The Prisma client's computed employer string hides the relation to the trade account, which broke the approval queue (issue 751), the held-order payment terms and the customer search today, and still broke customer segments on `b2bAccount.*`. Segments now read the account by id, and `check:shadowed` (rewritten on the TypeScript parser, now also in CI) catches every shape of it.
- **Tasks outlived their reason.** Account set-up, new-lead follow-up, deal-won and estimate-approved tasks now close themselves when what they asked for is done or no longer needed, by the same rule that opened them, with a nightly and release-time pass for older ones.
- **A local test run wiped the search index.** The search round-trip suite dropped the real collections; it now works only on per-run `test_` collections and refuses anything else (docs/22 §11).
- **Smaller:** Teodora read her own name instead of "waiting for your approval"; Approve and Turn down looked the same; her first page did not mention the waiting order; "Placed" was red; a terms order's timeline said "Payment confirmed" before it shipped (it now ends with its invoice, due date and amount to pay); the "who signs off" control squeezed account names to one word a line; changing a rule did not refresh the queue; a queue line repeated its badge.

## Confirmed by

On screen, 2026-10-03, as Doty, Renée and Teodora (Gillett, local).

- **Who signs.** Doty set Wasatch's "Over $1,000.00" limit to "Wasatch Front Utility Contractors, LLC's approvers (Teodora Vukić-Hale)". The row read "Teodora Vukić-Hale at Wasatch Front Utility Contractors, LLC says yes on your site, and the order goes ahead as soon as they do. One over the account's credit limit still needs your team too." The waiting O-000014 then read "Waiting for Teodora Vukić-Hale" with no Approve button and Reject kept.
- **Approve.** Renée's own order page read "Waiting for Teodora Vukić-Hale to approve it." Teodora signed up on the site with her own email, opened Wholesale account, saw "Waiting for your approval (1)" (O-000014, $1,208.00, placed by Renée, over the $1,000.00 limit, PO WFU-PO-24-0917, 2 items), pressed Review, typed "Approved for the Unit 7 and Unit 12 CP4 retrofits." and approved: "You approved order O-000014. It has gone ahead." The order was placed, INV-000014 issued for $1,208.00 with the PO, due Nov 3, the trail read "Order #O-000014 approved by Teodora Vukić-Hale: Approved for the Unit 7 and Unit 12 CP4 retrofits.", and Renée's approved email and order confirmation were queued.
- **Turn down.** Renée (a fresh cart; her bought one was dropped) added the Holset 5325950HX reman turbo ($2,200.00 at Fleet, $500.00 core) and, on Bill to my account, read "This order is over Wasatch Front Utility Contractors, LLC's $1,000.00 limit, so Teodora Vukić-Hale approves it before it goes ahead." before placing O-000015 (PO WFU-PO-24-0931): "Your order O-000015 is waiting for Teodora Vukić-Hale to approve it." The turbo was held for the order with no timer. No task opened for Doty; "Wholesale order waiting: ask their approvers" emailed Teodora (`order-approval-request`, sent). Teodora's Overview read "1 order on Wasatch Front Utility Contractors, LLC is waiting for your approval." with Review it; the order read "This order is waiting for your approval."; she typed "Unit 12 goes to the Ogden yard for its rebuild next month. Order the turbo there, on their PO.", pressed Turn down, confirmed "This cancels Renée Castañeda's order O-000015 for $2,700.00…": "You turned down order O-000015. It is canceled and will not go ahead." The turbo's hold was released, Renée's "turned down" email queued, the trail kept the reason, Wasatch's credit used stayed $5,976.80, and Doty's queue read "Nothing waiting".

- **Search.** On screen 2026-10-06, after the WSL restart. Doty typed "Wasatch": Wholesale accounts (Wasatch Front Utility Contractors, LLC, Fleet), its set-up task, invoices INV-000014, 07, 03 and 01, quotes Q-000013, 12, 11, 06 and 02, its three people (Teodora Vukić-Hale, Marcus Oyelaran-Pike, Renée Castañeda, each beside the account's name) and its five orders O-000015, 14, 11, 08 and 07, "19 records matched." Show more was seen on "O-0000": "13 records matched. 2 more match and are not shown yet.", pressed, and the list grew. That run also showed the count was not a count (5 of Gillett's 15 orders never listed): filed and fixed as [089].

Still not seen on screen: a real card hold, capture, release or refund (Gillett has no card gateway, and none was created); the rendered emails (queued and sent records only); the piggles console (typechecked and tested); 360px for the new screens. Dark mode was checked on Wholesale › Approvals (rules, notes, badges and switches all readable).

## Rating effect

—
