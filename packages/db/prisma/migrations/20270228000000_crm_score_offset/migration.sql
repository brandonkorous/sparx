-- docs/144 §10 — a hand-set score that survives the next re-score.
--
-- Two columns, no backfill, no new table.
--
-- WHAT THIS FIXES. Scoring already let somebody move a record's number by hand
-- and recorded who did it and why (`score_events.source = 'manual'`). What it
-- did NOT do was remember it: `scoreRecord` writes whatever the rules compute,
-- so the next "Re-score everyone" overwrote the adjustment without a word. A
-- rep who knew a contact had referred two other shops raised them ten points on
-- Monday and found them back at fifty on Tuesday, with no error, no warning and
-- no way to tell it had happened except by reading the history.
--
-- The panel was at least honest about it — it said in as many words that a
-- re-score would undo the change — but "we will throw your judgement away, and
-- we are telling you in advance" is not a feature. A CRM whose one manual lever
-- is temporary teaches its users not to touch it.
--
-- The score is now `clamp(rules + offset, 0, maxScore)`. The offset itself is
-- deliberately NOT clamped: the clamp belongs to the final number, so an offset
-- of +30 on a record whose rules already reach the ceiling is kept in full and
-- starts mattering again the day the rules score falls.
--
-- DEFAULT 0 IS THE WHOLE BACKFILL. Every existing record scores exactly as it
-- does today, because zero added to the rules total is the rules total. Nothing
-- moves until somebody adjusts something.

ALTER TABLE "customers" ADD COLUMN "score_offset" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "deals" ADD COLUMN "score_offset" INTEGER NOT NULL DEFAULT 0;
