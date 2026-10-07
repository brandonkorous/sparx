# 925 — Her till sales from August were not on her money screens

**Status:** fixed (act 325)
**Severity:** major
**Found by:** P02 · Halo & Hem · act 325, Money › By job, "All time"
**Surface:** every screen that shows one site's orders, bookings or money
**Filed:** 2026-10-06
**Fixed:** 2026-10-06
**Confirmed by:** P02 · Halo & Hem · act 325, By job on All time listing O-000001, O-000002 and O-000003
**Blocked on:** —

## What happened

Halo & Hem has three orders. Her Orders list shows all three. Money › By job,
on "All time", showed one: O-000003. O-000001 ($45.00) and O-000002 ($22.00),
two till sales from August 22, were missing.

## Why

Those two orders have no site (`property_id` NULL). The till did not set one
in August; it does now. By job and Profit filter by the site she is looking at,
so a row with no site is on neither. The bookings list uses "this site OR no
site"; the orders list happens not to filter. So three screens gave three
answers about the same orders.

Measured in dev: 13 orders, 68 bookings and 1 repeat order with no site, across
13 businesses. The writers that made them are all fixed; the rows stayed.

## The fix

Migration `20270530000031_a_one_site_business_files_its_old_work_under_it`.
A business with exactly ONE site has no second shop to get wrong, so its
site-less orders, bookings and repeat orders are filed under that site.

Issue 878 decided a renewal must not reach for the primary site when there are
several, because that files real money against a shop that may never have
taken it. This keeps to it: a business with two or more sites is left alone.

Repeat orders are included so the next renewal of an old one carries the site
too, instead of making a new site-less order every month.

## Proof

Dry run in a rolled-back transaction, then applied. Left without a site:
3 orders and 1 repeat order (Juniper Row, 7 sites) and 19 bookings (the
platform's own account, 14 sites). Every one-site business has none.

On screen, as Nia: By job on All time now lists all three orders, $45.00,
$22.00 and $40.00, and her appointment.

## What is still true

At a business with several sites, an old order with no site is on no
single-site money screen, only under All sites. Which site it belongs to is not
written anywhere, so filling it in would be the guess 878 ruled out.
