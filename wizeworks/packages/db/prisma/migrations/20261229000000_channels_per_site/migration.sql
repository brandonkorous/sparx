-- Per-SITE external sales channels (docs/131 §4).
--
-- An Etsy, TikTok, or Amazon shop belongs to ONE business. Bob's Parts and
-- Savory Donuts each have their own Etsy — under their own name, brand, and
-- OAuth grant — and both can connect the SAME channel TYPE. The old uniqueness
-- (tenant, channel) made the second business's Etsy connection a constraint
-- violation against the first; a channel connection also holds that shop's
-- access tokens, so a shared row is literally one business authenticating as
-- another.
--
-- ChannelProductMapping gets NO column: a mapping exists only under a
-- connection, which is now site-scoped, so it inherits (docs/131 §2 pattern 3).
-- A column there could disagree with its parent.
--
-- Nullable + no backfill: NULL means "the tenant" (its one site today), which is
-- exactly how every existing connection behaves. The manage UI defaults new
-- connections to the site being worked in; the value rides the signed OAuth
-- state from connect through callback.

ALTER TABLE "channel_connections" ADD COLUMN "property_id" UUID;

-- Cascade: a connection is one business's link to its own external shop.
ALTER TABLE "channel_connections"
    ADD CONSTRAINT "channel_connections_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;

-- Re-cut the uniqueness to (tenant, property, channel). NULLS NOT DISTINCT is
-- load-bearing: Postgres treats NULLs as distinct by default, so the plain
-- compound unique would let unlimited (tenant, NULL, 'etsy') rows coexist —
-- reintroducing the very ambiguity this constraint removes for the tenant-wide
-- tier. Postgres 15+ (we are on 18); Prisma cannot express the modifier, so the
-- schema declares the plain compound unique and THIS is the real constraint.
-- Prisma originally emitted this as a table CONSTRAINT (not a bare index), so it
-- must be dropped as one — an index-drop errors with 2BP01. The replacement is a
-- plain index, which is all a UNIQUE needs and lets us attach NULLS NOT DISTINCT.
ALTER TABLE "channel_connections"
    DROP CONSTRAINT "channel_connections_tenant_channel_unique";
CREATE UNIQUE INDEX "channel_connections_tenant_channel_unique"
    ON "channel_connections"("tenant_id", "property_id", "channel") NULLS NOT DISTINCT;

CREATE INDEX "channel_connections_tenant_property_idx"
    ON "channel_connections"("tenant_id", "property_id");
