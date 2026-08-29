# 314 — Nothing told her that her site offered no way into an account at all

**Status:** fixed
**Severity:** minor
**Found by:** P03 · Juniper Row · carry-forward review (split out of [313])
**Surface:** mypiggles › Site › Check before publishing
**Filed:** 2026-08-28
**Fixed:** 2026-08-28
**Confirmed by:** driven as Devi on 2026-08-28 — appeared, then cleared

## What happened

Issue [313] fixed the designs and built the telling for a site whose chrome the
platform can repair. It deliberately left one case, and named it: a site whose
header has **nothing** to repair.

The repair only ever rewrites a control that is already there. It swaps a stamped
"Sign in" for the live account control; it never invents one, and it must not —
inventing controls in somebody's header is not the platform's to do. So
`liveChromeGaps` is correctly silent about a site that has no account link at all,
which means the owner of one is told nothing by anything, anywhere.

Twenty four of the shipped designs used to be exactly that. On the sites live in
this database it is two, and they both sell: Forge Fitness Studio (commerce and
scheduling on) and Lucky Falcon 4198 (scheduling on). Their customers have an
order history, a returns flow, bookings and a saved address book, and no link to
any of it from anywhere on the site.

## What should have happened

The pre-publish check should say so. Not the automatic repair — that one is right
to keep its hands off — the CHECK, which is the surface that exists to tell an
owner what a visitor will run into, and which already says "this link goes to a
page that doesn't exist" without touching anything.

## How to reproduce

1. Install a design whose header has no account control, or delete the account
   link from your own header.
2. Have Commerce, Scheduling or B2B on, so customers actually have accounts.
3. Run the check before publishing.
4. Nothing was said. Publish, and a customer who buys from you can never get back
   to the order.

## Why it matters

**It is the half nobody could have found.** The stamped "Sign in" is visible and
wrong-looking, so somebody eventually notices. Nothing at all looks like a design
decision. This is the shape [[feedback_absent_behaves_like_fine]] describes: a
missing control renders identically to a site that never needed one.

**The customer pays for it, not the owner.** Self-service returns, order history
and rescheduling are all built. Two live sites reach none of it.

## Where it lives

`@wizeworks/site-lint` had no rule about what the shared chrome OFFERS — only about
whether it works (`frame-no-outlet`, `symbol-missing`, duplicate ids). Every rule in
the package asks whether a tree is well formed. None asked whether a capability the
site has is reachable from it.

- [wizeworks/packages/site-lint/src/lint.ts](../../../../wizeworks/packages/site-lint/src/lint.ts)

## The fix

**1. A rule, in [chrome.ts](../../../../wizeworks/packages/site-lint/src/chrome.ts).**
`chrome-no-account-link`, a warning: _"Customers have no way to reach their
account."_ It sits beside `structure.ts` rather than in it, because the two ask
different questions — that file checks the chrome still FUNCTIONS, this one checks
it still OFFERS what the site can do. A frame with no outlet is broken and looks
broken; a frame with no way into an account renders perfectly and strands every
customer the site has.

Reported once for the frame however many pages it was met on, with every page in
`seenOn` — the house treatment for a frame finding, because the fix is one edit.

**2. It is satisfied by ANY route, not by the platform's own control.** The live
host core counts, a hand-written `<a href="/account">` counts, a Button pointing at
`/account/orders` counts, and so does a link in the footer rather than the header.
The rule asks whether a customer can get there, never which door was used or who
built it.

That includes the stamped "Sign in" the older designs shipped. It is a different
complaint — issue [291], and [313] tells the owner about it — and reporting it here
as well would be two rows for one edit.

**3. It stays silent unless somebody confirmed there are accounts to reach.** A new
`SiteCapabilities` on `SiteLintInput`, carrying the same `undefined` contract as
`LinkTargets` and for the same reason: `undefined` means the caller did not look, so
nothing is claimed missing. A photographer's portfolio, a restaurant's menu and a
parish newsletter are complete with no sign-in anywhere, and telling those owners to
add one would be the check inventing work.

api-rest answers it in
[site-check.ts](../../../../wizeworks/services/api-rest/src/lib/site-check.ts)'s new
`siteCapabilities`: Commerce gives a customer orders and returns, Scheduling gives
them bookings, B2B gives them quotes and requests. Any one of the three and the
account area holds something. Each lookup fails CLOSED into "we did not look", so a
flag blip can never invent a finding — and a single failed lookup abandons the whole
question rather than answering "no accounts here", which would go quiet on exactly
the site the rule was written for.

**4. Nothing downstream needed wiring.** The Publish pane renders findings
generically off `rule: string`, so the row appears on its own.

## Measured against the sites that are actually live

All 22 published frames in this database, read through the rule's own two
conditions:

| the saved chrome                 | sites |
| -------------------------------- | ----- |
| the live account core            | 1     |
| some other route into `/account` | 18    |
| **nothing at all**               | **3** |

Of the three, **two are reported** — Forge Fitness Studio and Lucky Falcon 4198,
both with modules on that give a customer an account. The third, Halden Consulting,
runs CMS, CRM, Email and AI and no commerce, scheduling or B2B: nobody has an
account there, so the capability gate keeps it quiet. That is the gate doing the one
job it was added for, on real data.

### A number in [313] that was wider than it should have been

[313] recorded "6 live sites with no account route at all". That count came from its
header table, which asked whether the header carried the live core or the SEEDED
stamped anchor. Three of those six do have a route — a different href, or one in the
footer — and this rule finds them, so the figure for "nothing anywhere" is **three**,
not six. [313] has been refreshed to say so.

## Confirmed by

Driven as Devi on 2026-08-28, both directions, on **Juniper Row Archive**.

Removed every route into the account area from that site's header and footer — the live
core in the bar, the one in the phone panel, and the footer's hand-authored Account
column — saved, and ran **Check my site**. The check went from 3 findings to 4, and the
new one appeared under **Worth a look before you publish**:

> **Your header and footer** · Customers have no way to reach their account
> Your header and footer have no link into the account area, so someone who has bought
> from you cannot sign in, look up what they ordered, start a return, or change the
> address you ship to — even though all of that is waiting for them. …

Scoped to the frame, worded about her customers, and reported **once** across nine pages
rather than nine times. Undid the removals, saved, and pressed **Check again**: back to 3
findings and the whole "Worth a look" section gone.

**The negative case fell out of the drive rather than being contrived.** Removing only the
header's core left the finding silent, because this design's footer carries its own
Account column — which is the rule's "any route counts" clause holding on real content
rather than in a test.
