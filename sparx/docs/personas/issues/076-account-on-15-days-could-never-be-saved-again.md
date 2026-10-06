# 076 — A trade account on 15 days to pay could never be saved again

**Status:** fixed
**Severity:** major
**Found by:** P01 · Gillett Diesel Service · act 5 (the five trade accounts)
**Surface:** workbench › Wholesale › an account (both consoles); b2b package
**Filed:** 2026-10-02
**Fixed:** 2026-10-02
**Confirmed by:** On screen, 2026-10-02, as Doty: O'Malley Ranch & Hay Co. (Fleet, 15 days to pay) given its website and saved: before the fix "Could not save this account. Nothing was changed. The problem is with Payment terms."; after it "Account saved", still on 15 days to pay.
**Blocked on:** —

## What happened

Adding a trade account offers 7, 14, 15, 30, 45, 60 and 90 days to pay, and saves any of them. O'Malley Ranch is on 15 days. The next edit to the account, of any field, failed: "Could not save this account. Nothing was changed. The problem is with Payment terms."

The add screen saves through the customer records, which accept any "net" plus a number of days. The account's own save checked an older list of four: prepay, 30, 60 and 90. So every account on 7, 14, 15 or 45 days was stuck as it was first typed.

## Fix

- `b2b/src/accounts.ts`: the account save uses the same terms rule as the customer records (`PaymentTerms`, re-exported from `@wizeworks/crm`).
- `b2b/src/account-terms.test.ts`: every term the add screen offers survives an edit; a typo is still refused. The old list fails 4 of them.
- Typecheck clean (b2b, crm).
