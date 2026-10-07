-- Two Piggles header notices change, both content shipped as a deploy stage.
--
-- 1. The founding-member notice stops being a fixed row. "Founding members pay
--    less. Ask us how." could not know when the places ran out, so it would have
--    kept promising them after the 100th was taken. The marketing and account
--    sites now draw that bar from the live coupon count when no other notice is
--    on. Switched off only if nobody has reworded it by hand.
--
-- 2. The front-row notice: a Piggles shirt is on TV and in the arena on the
--    evening of 2026-10-26 (Eastern). People who search for the name land on the
--    home page, not on /frontrow, so the bar tells them they found the right
--    place. 6pm Eastern on the 26th until midnight Eastern on the 28th (EDT,
--    UTC-4). Priority 200 so it wins over anything else for those two days.

UPDATE "platform_announcements"
SET "is_active" = false, "updated_at" = now()
WHERE "id" = '9f1d4c3a-6b52-4a7e-8f10-2c9d5e7a4b31'
  AND "message" = 'Piggles is $99 a month. Founding members pay less, for as long as they stay. Ask us how.';

INSERT INTO "platform_announcements"
  ("id", "platform_brand", "surfaces", "message", "link_label", "link_href",
   "tone", "dismissible", "starts_at", "ends_at", "is_active", "priority", "updated_at")
VALUES (
  'c3f0a1d2-7e64-4b8a-9d25-1f6e8b4c0a77',
  'piggles',
  ARRAY['marketing'],
  'Saw the Piggles shirt? You''re in the right place.',
  'Start here',
  '/frontrow',
  'primary',
  true,
  '2026-10-26T22:00:00Z',
  '2026-10-29T04:00:00Z',
  true,
  200,
  now()
)
ON CONFLICT ("id") DO NOTHING;
