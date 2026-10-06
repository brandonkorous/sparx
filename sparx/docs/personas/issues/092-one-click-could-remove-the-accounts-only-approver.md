# 092 — One click could remove the account's only approver

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 5 (checking the yellow "Removed" badge)
**Surface:** workbench › Wholesale › Accounts › an account › Who can order (both consoles)
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P01 on screen, 2026-10-06
**Blocked on:** —

## What happened

On Wasatch Front Utility Contractors, LLC, Doty pressed **Remove** on Marcus Oyelaran-Pike. He went straight to "Removed", no question asked. She pressed **Restore**. The list re-sorted, and the pointer now sat on Teodora Vukić-Hale's **Remove**: one more click, or a double click on Restore, and the account's only approver was gone, with nothing to say so. Teodora is the person every Wasatch order over $1,000 waits for.

## What should have happened

Taking someone's access away asks first and names them. Giving it back does not need to.

## How to reproduce

1. Wasatch's account, Who can order. Press Remove on Marcus, then Restore.
2. Before the fix: no question on Remove, and the pointer lands on the next row's Remove after Restore. Every time.

## Why it matters

The house rule is that every removal asks first and names what is lost. Here the loss is quiet and serious: with no approver, Wasatch's held orders wait for someone who can no longer answer.

## Where it lives

`ContactRow` in `sparx/apps/workbench/surfaces/b2b/account-detail.tsx` and `piggles/apps/workbench/surfaces/b2b/account-detail/contact-row.tsx`: the button called the toggle directly.

## The fix

The row asks before Remove: "Remove Marcus Oyelaran-Pike from this account?" / "Marcus Oyelaran-Pike will no longer be able to use this account on your site. Orders they already placed stay as they are. You can restore them here at any time." with **Remove Marcus Oyelaran-Pike** and **Keep them**. Restore still works in one click. Both consoles.

No unit test: it is a confirm on a button, and this repo keeps no UI test scripts. Proved on screen instead.

## Confirmed by

On screen, 2026-10-06, as Doty: Remove on Marcus opened the question above; "Keep them" left him on the account, "Can view only".

## Rating effect

—
