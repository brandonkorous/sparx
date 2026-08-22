# 040 — Going back a step in her checkout was a dead end

**Status:** fixed
**Severity:** major (a reachable dead end in a live checkout, using the buttons as drawn)
**Found by:** P01 · Thistle & Rye · act 8 — reopening a checkout already in progress
**Surface:** the tenant's live `/checkout`
**Filed:** 2026-08-21 · **Fixed:** 2026-08-21
**Confirmed by:** P01 · act 8, on the screen

## What happened

Reopened the checkout with a basket already part-way through. The form drew step
1, **Contact**. Filled in the email, pressed Continue, and got a red box:

> Cannot move checkout from "shipping" back to "contact"

Stuck. The page insists on Contact; the server refuses Contact.

## Why it matters

Three things, in ascending order of seriousness.

1. **The sentence is machine language** — quoted step names and all — in a red
   box on a bakery's checkout, in front of somebody buying bread.
2. **It forbade something the checkout itself offers.** Step 2 has a **← Back**
   button. Press it, correct your email, press Continue: refused. A dead end
   reached by using the buttons as they are drawn.
3. **A customer who simply reopened the page hit it without touching Back.** The
   form restarts at Contact while the session remembers `shipping`, so the first
   thing they submit is a step they have already passed. That is the ordinary
   case — a closed tab, a refresh, coming back after checking something.

## Why it happened

`assertCanAdvance(from, to)` threw whenever `to` sorted before `from` in
`STEP_ORDER`. Nothing else was wrong: `assertSessionWritable` already refuses a
completed or expired session, which is the guard that actually matters, and
`submitShipping` was explicitly written to be re-run — it swaps out the previous
rate rather than stacking a second one. The machinery for revisiting a step was
there; only this guard denied it.

## The fix

`furthestStep(from, to)` replaces it. The write always lands; the recorded step
is whichever of the two is **further along**, so correcting a typo in an email
cannot silently discard a chosen collection option.

Editing an earlier step is not an error. It is a person changing their mind about
their own email address, which they are entitled to do at any point before they
pay.

Five tests, including the two that name the real cases: correcting your email
after choosing how to collect, and not losing that choice when you do.

## What is still open

The checkout page **does not resume at the session's step** — it always draws
Contact, which is how this was found. With the guard gone that is no longer a
dead end (you walk forward again), but a customer who comes back still retypes an
address the session already has. Worth its own pass.
