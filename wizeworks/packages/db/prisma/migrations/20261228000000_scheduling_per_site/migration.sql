-- Per-SITE scheduling (docs/131 §4). A booking widget lives on a storefront, and
-- a service ("oil change" vs "cake tasting") is unambiguously one business's.
--
-- This is the module docs/131 flagged as the largest, and it exercises BOTH
-- scoping patterns in one place because its models genuinely differ:
--
--   DIRECT COLUMN (a thing belongs to one business):
--     · scheduling_services      — what a business offers
--     · scheduling_booking_policies — a business's promise to its customers
--     · scheduling_intake_forms   — a business's questions
--     · bookings                  — denormalized from the service AT BOOKING
--                                   TIME so history stays correct if the service
--                                   is later re-scoped (table is `bookings`, not
--                                   `scheduling_bookings` — Booking @@maps to it)
--
--   JUNCTION (one thing serves several businesses):
--     · scheduling_resource_properties  — a RESOURCE is often a PERSON, and one
--                                         person genuinely works both businesses
--                                         (the owner who bakes then machines).
--                                         Forcing a column would split them into
--                                         two calendars, and double-booking a
--                                         human is the worst failure here.
--     · scheduling_location_properties  — a LOCATION is a PLACE, and one place
--                                         can host more than one business. This
--                                         is the SAME shape as warehouses
--                                         ("wh 1+3 for Bob's, 1+2 for Savory"),
--                                         and resolves the open question left at
--                                         78-scheduling.prisma / docs/79 §21.
--
-- All columns nullable, both junctions empty-means-all, so no backfill and no
-- FORCE-RLS loop — every existing row keeps behaving exactly as today.

-- ── Direct columns ─────────────────────────────────────────────────────────
ALTER TABLE "scheduling_services"         ADD COLUMN "property_id" UUID;
ALTER TABLE "scheduling_booking_policies" ADD COLUMN "property_id" UUID;
ALTER TABLE "scheduling_intake_forms"     ADD COLUMN "property_id" UUID;
ALTER TABLE "bookings"         ADD COLUMN "property_id" UUID;

-- Services/policies/intake Cascade — authored offerings that belong to the
-- business. A booking SetNull — it is a record of an appointment a real customer
-- made, and outlives the site, exactly like orders and chat conversations.
ALTER TABLE "scheduling_services"
    ADD CONSTRAINT "scheduling_services_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;
ALTER TABLE "scheduling_booking_policies"
    ADD CONSTRAINT "scheduling_booking_policies_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;
ALTER TABLE "scheduling_intake_forms"
    ADD CONSTRAINT "scheduling_intake_forms_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;
ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL;

CREATE INDEX "scheduling_services_tenant_property_idx"
    ON "scheduling_services"("tenant_id", "property_id");
CREATE INDEX "scheduling_booking_policies_tenant_property_idx"
    ON "scheduling_booking_policies"("tenant_id", "property_id");
CREATE INDEX "scheduling_intake_forms_tenant_property_idx"
    ON "scheduling_intake_forms"("tenant_id", "property_id");
CREATE INDEX "bookings_tenant_property_idx"
    ON "bookings"("tenant_id", "property_id");

-- ── Junctions (no tenant_id, tenant scoping rides the FK parents) ───────────
CREATE TABLE "scheduling_location_properties" (
    "property_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    CONSTRAINT "scheduling_location_properties_pkey" PRIMARY KEY ("property_id", "location_id")
);
ALTER TABLE "scheduling_location_properties"
    ADD CONSTRAINT "scheduling_location_properties_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;
ALTER TABLE "scheduling_location_properties"
    ADD CONSTRAINT "scheduling_location_properties_location_id_fkey"
    FOREIGN KEY ("location_id") REFERENCES "scheduling_locations"("id") ON DELETE CASCADE;
CREATE INDEX "scheduling_location_properties_location_id_idx"
    ON "scheduling_location_properties"("location_id");

CREATE TABLE "scheduling_resource_properties" (
    "property_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    CONSTRAINT "scheduling_resource_properties_pkey" PRIMARY KEY ("property_id", "resource_id")
);
ALTER TABLE "scheduling_resource_properties"
    ADD CONSTRAINT "scheduling_resource_properties_property_id_fkey"
    FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;
ALTER TABLE "scheduling_resource_properties"
    ADD CONSTRAINT "scheduling_resource_properties_resource_id_fkey"
    FOREIGN KEY ("resource_id") REFERENCES "scheduling_resources"("id") ON DELETE CASCADE;
CREATE INDEX "scheduling_resource_properties_resource_id_idx"
    ON "scheduling_resource_properties"("resource_id");
