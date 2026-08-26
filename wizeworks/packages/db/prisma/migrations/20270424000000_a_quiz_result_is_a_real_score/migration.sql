-- A quiz result is a real CRM score, applied once (docs/151 §7, docs/152 C3).
--
-- The scoring itself needs no storage: the weights live in the form's server-only
-- config beside its recipients, and the result is written through the existing
-- CRM scoring model as a `ScoreEvent` — so `explain_crm_score` shows the quiz
-- beside every other reason the number is what it is, instead of the quiz keeping
-- a private score nobody in sales can see.
--
-- What DOES need storage is "has this already been scored". The capture action is
-- retried on failure and is idempotent everywhere else by loading the row it is
-- about; without a marker a retry after a partial commit would add the points a
-- second time, and a lead would drift upward every time a worker hiccuped.
-- A timestamp rather than a boolean because "when did this person take it" is
-- worth knowing and costs the same.

ALTER TABLE "form_submissions"
    ADD COLUMN "quiz_scored_at" TIMESTAMPTZ;
