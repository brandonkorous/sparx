-- The Piggles home-page banner carried an em-dash.
--
-- The house rule is that copy never carries one, and the sweep that took ~7,800
-- of them out of the source could not reach this sentence: it is not in any
-- .ts file, it is a ROW, written by 20270330000000_platform_announcements. Copy
-- that ships as data is a surface of its own, and the only thing that found it
-- was opening the page and reading it.
--
-- Matched on the exact old text rather than the id alone, so an announcement
-- already reworded by hand in any environment is left exactly as it is.

UPDATE "platform_announcements"
SET
  "message" = 'Piggles is $99 a month. Founding members pay less, for as long as they stay. Ask us how.',
  "updated_at" = now()
WHERE "id" = '9f1d4c3a-6b52-4a7e-8f10-2c9d5e7a4b31'
  AND "message" = 'Piggles is $99 a month. Founding members pay less, for as long as they stay ' || U&'\2014' || ' ask us how.';
