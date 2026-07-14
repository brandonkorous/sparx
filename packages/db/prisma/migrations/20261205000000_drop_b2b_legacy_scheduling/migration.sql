-- Retire the legacy B2B fleet-scheduling tables (docs/10 §10, docs/79 §15.7).
-- These were the narrow ancestor of the Scheduling module's own Booking engine
-- (SchedulingService/Booking/BookingResource/... in 78-scheduling.prisma), which
-- already carries the B2B fleet context (b2b_account_id, asset_ref, parts_linked,
-- work_order_id) that these tables provided. No tenant had real production rows
-- on either table at cutover, so this is a clean drop — no data migration.
--
-- Originally created in 20260717000000_b2b_scheduling.

DROP TABLE IF EXISTS service_appointments;
DROP TABLE IF EXISTS service_types;
