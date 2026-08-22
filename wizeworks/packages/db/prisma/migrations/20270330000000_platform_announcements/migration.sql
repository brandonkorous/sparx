-- The header notice bar: one staff-authored sentence above a brand's surfaces.
--
-- NO tenant_id, so NO RLS. This is WizeWorks talking to its own customers about
-- its own product; there is no tenant that owns a row and no tenant-facing write
-- path. The only writer is an operator holding `announcement:manage`, through
-- api-rest's /internal/operator seam. The rls-audit skips it for the same reason
-- it skips every other platform table: it keys on the tenant_id column.
--
-- Reads are anonymous and cheap — every page of three marketing/account surfaces
-- asks "is anything live right now", so the index carries the whole predicate
-- shape (brand, then the switch, then the tie-break) and the window is filtered
-- from the handful of rows that survive it.

CREATE TABLE "platform_announcements" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "platform_brand" VARCHAR(30)  NOT NULL,
  "surfaces"       TEXT[]       NOT NULL DEFAULT '{}',
  "message"        TEXT         NOT NULL,
  "link_label"     VARCHAR(60),
  "link_href"      TEXT,
  "tone"           VARCHAR(20)  NOT NULL DEFAULT 'primary',
  "dismissible"    BOOLEAN      NOT NULL DEFAULT true,
  "starts_at"      TIMESTAMPTZ,
  "ends_at"        TIMESTAMPTZ,
  "is_active"      BOOLEAN      NOT NULL DEFAULT false,
  "priority"       INTEGER      NOT NULL DEFAULT 0,
  "created_by"     UUID,
  "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ  NOT NULL
);

CREATE INDEX "platform_announcements_brand_active_priority_idx"
  ON "platform_announcements" ("platform_brand", "is_active", "priority");

-- Prisma owns `updatedAt` end to end (@updatedAt), so the column must not carry a
-- database default that would silently win on a raw UPDATE. Created above without
-- one; this comment is the reminder, not a no-op statement.

-- Seed the Piggles founding-member notice. Content, not schema — and content is a
-- deploy stage, so it ships with the migration that makes it possible rather than
-- waiting for somebody to remember to type it into the console. Idempotent: keyed
-- on a fixed id so re-running changes nothing.
--
-- It ships ACTIVE. The pricing change it accompanies is live the moment this
-- deploys, and a price rise announced by nobody is the version of this that
-- costs money.
INSERT INTO "platform_announcements"
  ("id", "platform_brand", "surfaces", "message", "link_label", "link_href",
   "tone", "dismissible", "is_active", "priority", "updated_at")
VALUES (
  '9f1d4c3a-6b52-4a7e-8f10-2c9d5e7a4b31',
  'piggles',
  ARRAY['marketing', 'account'],
  'Piggles is $99 a month. Founding members pay less, for as long as they stay — ask us how.',
  'Email hello@meetpiggles.com',
  'mailto:hello@meetpiggles.com?subject=Becoming%20a%20founding%20member',
  'primary',
  true,
  true,
  100,
  now()
)
ON CONFLICT ("id") DO NOTHING;
