-- "New Customers" was reading order recency under a description promising the
-- opposite of it.
--
-- The seeded built-in described itself as "Created in the last 30 days,
-- regardless of order activity" and its rule was
-- `customer.daysSinceLastOrder <= 30` — which depends entirely on order
-- activity and excludes everyone who has never bought. A shop that had just
-- imported twenty-five contacts opened the group and found two: the only two
-- who had placed an order. Nothing on the screen suggested the other
-- twenty-three had been ruled out, because by the group's own description they
-- should not have been.
--
-- The rule could not say what the description said: a date field takes absolute
-- values, so "in the last 30 days" freezes on the day it is written. That is why
-- `daysSinceLastOrder` exists as a number beside `lastOrderAt`, and it is why
-- `customer.daysSinceCreated` now exists beside `customer.createdAt`.
--
-- Scope: only rows that still hold the EXACT seeded rule are touched, so a
-- tenant who deliberately set this group to order-recency keeps what they chose.
-- At the time of writing that is all 29 seeded rows and no edited ones.
-- Idempotent: re-running matches nothing, because the rule is no longer that.

UPDATE segments
SET
  rules = '{"op":"lte","kind":"predicate","field":"customer.daysSinceCreated","value":30}'::jsonb,
  description = 'Added in the last 30 days, whether or not they have bought yet.',
  updated_at = CURRENT_TIMESTAMP
WHERE slug = 'new-customers'
  AND is_system = true
  AND rules = '{"op":"lte","kind":"predicate","field":"customer.daysSinceLastOrder","value":30}'::jsonb;

-- Membership is not repaired here: it is derived by the rule engine in
-- application code, not expressible in SQL. The nightly crm-segment-recompute
-- CronJob (k8s/cronjobs/crm-segment-recompute.yaml, 05:00 UTC) re-cuts every
-- dynamic segment for every active tenant, so these groups are correct within a
-- day of this landing. An owner who wants it sooner has "Update membership" on
-- the group itself.
