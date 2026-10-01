# 901 — A wholesale rule could name who signs off, and anyone could sign

**Status:** fixed, screen proof pending
**Severity:** **major** — latent today (0 of 42 rules name anybody), but live
the moment a rule did: the list would read "Nadia Osei signs off" and any
editor could approve or turn down the order
**Found by:** P03 · act 320, beside issue 900
**Surface:** B2B sign-offs (`b2b.approvals`, both consoles),
`wizeworks/packages/b2b/src/approval.ts`
**Filed:** 2026-09-30
**Fixed:** 2026-09-30
**Confirmed by:** `approval-named-approver.test.ts` (16 tests, red five ways);
b2b typecheck and suite green. Not yet from the screen: the dev stack and
Docker were both off.

## The hole

A wholesale rule stores `requiredApproverUserId`. The screen prints "X signs
off". The MCP tool says "Optional requiredApproverUserId names who must sign
off." `approveOrder` and `rejectOrder` checked nothing about it; the route asks
only for `editor`. The spending limits on orders to suppliers have refused
everyone but the named person since they shipped.
[[feedback_a_fix_leaves_its_neighbour_behind]]

## Order of the fix

Enforce first, then offer the control. A box that names a person over a server
that ignores the name is a promise in copy nobody keeps.

1. `ruleGoverningOrder` picks the rule that held the order: the highest
   threshold the order clears, then the oldest. Checkout's `findFirst` only
   needs WHETHER to hold; deciding needs WHICH, because two rules can name two
   people.
2. Approve and reject both refuse anyone but the named person, and say who to
   ask ("This order has to be signed off by Nadia Osei.").
3. Create and update refuse a person who is not an active member of this
   account.
4. The add-rule form has **Who signs it off** (anyone who can approve, or one
   teammate). Each rule row has the same picker in place of the "signs off"
   text, so the person can be changed without removing the rule.

## Still to prove

On the wholesale sign-offs screen, add a rule naming a teammate and see the row
show them. Sign in as someone else and see Approve refused with the name.
