-- docs/144 §12 — the remainder: saved views, e-sign on quotes, meeting links.
--
-- Three capabilities that have nothing in common with each other except that
-- each one is the last thing standing between a category and its full score.
--
--   1. SAVED VIEWS. Custom properties made "which columns?" a real question for
--      the first time — before the registry every list had the same fixed set,
--      so there was nothing to save. Now a tenant who added six properties to a
--      contact has a list that is wrong for everyone until each person can shape
--      it once and keep it.
--   2. E-SIGN. The rendering pipeline already produces a customer-facing
--      document; what it could not do was let the customer ACCEPT one. Without
--      that, "approved" was a stage a member of staff moved a quote to on the
--      customer's behalf, which is a record of a phone call rather than a
--      signature.
--   3. MEETING LINKS. Scheduling already books. What was missing is the CRM side
--      of it — a link a rep can put in an email whose booking lands on the
--      contact's timeline instead of in a calendar nobody else can see.
--
-- Every table is ENABLE + FORCE RLS with a tenant_isolation policy. No backfill
-- reads an existing row, so nothing here needs the per-tenant set_config loop.

-- ══════════════════════════════════════════════════════════════════════════
-- 1. Saved views
-- ══════════════════════════════════════════════════════════════════════════
--
-- A saved view is one person's answer to "how do I look at this list": which
-- records (filters), which columns, and in what order.
--
-- `user_id` is NOT NULL even for shared views. A view always has an author, and
-- "who made this and can change it" is the question that decides whether the
-- delete button renders — an ownerless shared view is one nobody can tidy up.
CREATE TABLE "crm_saved_views" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"   UUID         NOT NULL,
  "property_id" UUID,
  "user_id"     UUID         NOT NULL,

  -- contact | company | deal | ticket | <tenant-authored>. Free text rather than
  -- an enum for the same reason the registry's object key is: a tenant-invented
  -- object must get saved views without a migration.
  "object_key"  VARCHAR(63)  NOT NULL,

  "name"        VARCHAR(120) NOT NULL,

  -- A ConditionGroup, the same shape segments / automations / reports filter
  -- with. One filter vocabulary across the platform is what stops `contains`
  -- meaning two different things in two places.
  "filters"     JSONB        NOT NULL DEFAULT '{}',

  -- Ordered column keys. Empty = the surface's own default set, which is what
  -- lets someone save a filter without also having to decide about columns.
  "columns"     TEXT[]       NOT NULL DEFAULT '{}',

  -- { field, direction } or null for the surface default.
  "sort"        JSONB,

  -- Shared views are visible to the whole team but editable only by their
  -- author. A team of four should not each rebuild "open deals over $5k".
  "is_shared"   BOOLEAN      NOT NULL DEFAULT false,

  -- The view this person lands on when they open the list. At most one per
  -- (user, object) — enforced by the partial unique index below.
  "is_default"  BOOLEAN      NOT NULL DEFAULT false,

  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "crm_saved_views_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crm_saved_views_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "crm_saved_views_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE,
  -- Cascade: a view is one person's preference and means nothing once they are
  -- gone. This is the one place in the CRM where deleting the actor SHOULD
  -- delete the row — a saved view is not a record of anything that happened.
  CONSTRAINT "crm_saved_views_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "crm_saved_views_name_unique"
  ON "crm_saved_views" ("tenant_id", "user_id", "object_key", "name");

CREATE UNIQUE INDEX "crm_saved_views_one_default"
  ON "crm_saved_views" ("tenant_id", "user_id", "object_key")
  WHERE "is_default";

-- The list read: "my views plus the team's, for this object, on this site".
CREATE INDEX "crm_saved_views_lookup_idx"
  ON "crm_saved_views" ("tenant_id", "object_key", "user_id");
CREATE INDEX "crm_saved_views_shared_idx"
  ON "crm_saved_views" ("tenant_id", "object_key")
  WHERE "is_shared";

ALTER TABLE "crm_saved_views" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_saved_views" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "crm_saved_views"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 2. E-sign
-- ══════════════════════════════════════════════════════════════════════════
--
-- One row per signature REQUEST, which becomes the signature itself when
-- `signed_at` is set. Request and signature are the same row on purpose: the
-- question a business asks is "where is that quote up to", and one row answers
-- it — sent, opened, signed, declined, expired.
--
-- `token_hash` is a SHA-256 of the link token, never the token itself. The same
-- rule the API keys follow (packages/auth/src/api-keys.ts): a leaked database
-- dump must not be a set of working signing links.
--
-- `snapshot_id` is the frozen document as it was AT SIGNATURE. Without it a
-- signature says someone agreed to something and cannot say to what — the lines
-- could be edited the next morning and the signature would silently now attest
-- to the new ones.
CREATE TABLE "billing_document_signatures" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"      UUID         NOT NULL,
  "document_id"    UUID         NOT NULL,
  "snapshot_id"    UUID,

  "signer_name"    VARCHAR(160) NOT NULL,
  "signer_email"   VARCHAR(320) NOT NULL,

  -- SHA-256 hex of the signing token. Unique so a token identifies exactly one
  -- request; the public route looks up by this and nothing else.
  "token_hash"     CHAR(64)     NOT NULL,

  -- pending | signed | declined | expired | revoked. Derived state would need
  -- three nullable timestamps and a clock comparison at every read; a column
  -- makes "show me everything still waiting" one index.
  "status"         VARCHAR(20)  NOT NULL DEFAULT 'pending',

  "requested_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "requested_by"   UUID,
  "expires_at"     TIMESTAMPTZ  NOT NULL,
  "viewed_at"      TIMESTAMPTZ,
  "signed_at"      TIMESTAMPTZ,
  "declined_at"    TIMESTAMPTZ,
  "decline_reason" VARCHAR(500),

  -- Typed name or a drawn path, plus how it was produced. The evidentiary value
  -- is in the surrounding facts (token, time, address, agent), not the picture.
  "signature_data" JSONB,

  "ip"             VARCHAR(45),
  "user_agent"     VARCHAR(500),

  "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "billing_document_signatures_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_document_signatures_status_check"
    CHECK ("status" IN ('pending', 'signed', 'declined', 'expired', 'revoked')),
  -- A signed row without a time is a signature nobody can date, which is the one
  -- fact a signature has to carry.
  CONSTRAINT "billing_document_signatures_signed_check"
    CHECK (("status" = 'signed') = ("signed_at" IS NOT NULL)),
  CONSTRAINT "billing_document_signatures_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "billing_document_signatures_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "billing_documents"("id") ON DELETE CASCADE,
  -- SetNull: deleting a snapshot must not delete the evidence that something was
  -- signed. In practice snapshots are never deleted, which is why this is the
  -- weaker of the two.
  CONSTRAINT "billing_document_signatures_snapshot_id_fkey"
    FOREIGN KEY ("snapshot_id") REFERENCES "billing_document_snapshots"("id") ON DELETE SET NULL,
  CONSTRAINT "billing_document_signatures_requested_by_fkey"
    FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "billing_document_signatures_token_unique"
  ON "billing_document_signatures" ("token_hash");

CREATE INDEX "billing_document_signatures_document_idx"
  ON "billing_document_signatures" ("tenant_id", "document_id", "requested_at" DESC);

-- The sweep that expires stale requests, and the "still waiting on" list.
CREATE INDEX "billing_document_signatures_pending_idx"
  ON "billing_document_signatures" ("status", "expires_at")
  WHERE "status" = 'pending';

ALTER TABLE "billing_document_signatures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_document_signatures" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "billing_document_signatures"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 3. Meeting links
-- ══════════════════════════════════════════════════════════════════════════
--
-- A rep's personal booking link. It is a thin CRM object on purpose: it does not
-- own availability, duration, buffers or policy — the scheduling service does,
-- and duplicating any of that here would give a business two places to change
-- the same thing and no way to tell which one was live.
--
-- What it adds is the three things scheduling has no opinion about: a memorable
-- public slug, WHOSE link it is, and the fact that a booking through it belongs
-- on a contact's timeline.
CREATE TABLE "crm_meeting_links" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"   UUID         NOT NULL,
  "property_id" UUID,
  "user_id"     UUID         NOT NULL,
  "service_id"  UUID         NOT NULL,

  -- The public path segment: /meet/<slug>. Unique per site, so two businesses
  -- under one owner can each have a `discovery-call`.
  "slug"        VARCHAR(63)  NOT NULL,
  "name"        VARCHAR(120) NOT NULL,
  "description" TEXT,

  "is_active"   BOOLEAN      NOT NULL DEFAULT true,

  -- How many times it has been booked. Denormalized because the alternative is
  -- counting bookings on every render of a list of links, and this number is
  -- never used for anything a count would have to be exact for.
  "booking_count" INTEGER    NOT NULL DEFAULT 0,

  "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "archived_at" TIMESTAMPTZ,

  CONSTRAINT "crm_meeting_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crm_meeting_links_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "crm_meeting_links_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE,
  -- Cascade on the user: a personal link belongs to a person. When they leave,
  -- the link must stop working rather than quietly booking their successor.
  CONSTRAINT "crm_meeting_links_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "crm_meeting_links_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "scheduling_services"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "crm_meeting_links_slug_unique"
  ON "crm_meeting_links" ("tenant_id", "property_id", "slug") NULLS NOT DISTINCT;

CREATE INDEX "crm_meeting_links_user_idx"
  ON "crm_meeting_links" ("tenant_id", "user_id", "is_active");

ALTER TABLE "crm_meeting_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crm_meeting_links" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "crm_meeting_links"
  USING ("tenant_id" = current_tenant_id());

-- Which link produced a booking. A plain indexed UUID with no Prisma relation,
-- following 78-scheduling.prisma's own convention for cross-module references —
-- scheduling stays unaware that CRM exists.
ALTER TABLE "bookings" ADD COLUMN "meeting_link_id" UUID;

CREATE INDEX "bookings_meeting_link_idx"
  ON "bookings" ("tenant_id", "meeting_link_id")
  WHERE "meeting_link_id" IS NOT NULL;

COMMENT ON COLUMN "bookings"."source" IS
  'site | portal | dashboard | mcp | phone | marketplace | api | meeting_link. "meeting_link" means a rep''s personal booking link took it (docs/144 §12).';
