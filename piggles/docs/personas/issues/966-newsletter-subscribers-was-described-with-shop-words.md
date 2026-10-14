# 966 — "Newsletter Subscribers" was described with shop words

**Status:** fixed (act 10), reaches existing accounts on release
**Severity:** copy
**Found by:** P09 · The Marrow Review · act 10
**Surface:** the built-in "Newsletter Subscribers" group, wherever its description shows
**Filed:** 2026-10-09
**Fixed:** 2026-10-09
**Confirmed by:** P09 · act 10 (template and a rolled-back dry run of the migration)
**Blocked on:** —

## What happened

The first answer to "import subscribers" was this group, described as **"Everyone who
opted into marketing email (storefront signup, checkout opt-in)."** A journal has no
checkout, and "storefront" is the platform's retired word for a website.

## The fix

- `crm-schemas/src/builtins/segments.ts`: **"Everyone who has said yes to email from you,
  wherever they signed up."**
- Each business holds its own copy, so migration
  `20270530000033_newsletter_subscribers_describe_any_business` refreshes the copies still
  carrying the old sentence, tenant by tenant (the table is FORCE RLS). A business that
  wrote its own description keeps it.

## Proof

The migration run inside a transaction and rolled back: 33 copies refreshed, then
undone. crm-schemas 102 pass. It is a file only; the release applies it.
