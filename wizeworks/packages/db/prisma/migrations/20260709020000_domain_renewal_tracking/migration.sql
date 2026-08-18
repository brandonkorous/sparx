-- Track which renewal reminder emails have been sent for each purchased domain
-- (docs/64 Module 1 Ph3). Values are '30d', '14d', '7d' — one per threshold.
-- The nightly cron in domain-worker uses this to send at most one reminder per
-- threshold and avoid duplicate emails on re-runs.

ALTER TABLE "domains"
  ADD COLUMN IF NOT EXISTS "renewal_reminders_sent" TEXT[] NOT NULL DEFAULT '{}';
