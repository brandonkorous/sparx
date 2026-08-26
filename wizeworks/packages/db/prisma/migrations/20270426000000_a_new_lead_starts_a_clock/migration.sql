-- The lead response clock (docs/152 D2).
--
-- ── THIS EXTENDS THE SLA MACHINERY RATHER THAN DUPLICATING IT ────────────────
--
-- The first task of this slice was to find out whether the existing SLA policies
-- already reach an inbound web lead. The answer is: only if that lead happens to
-- open a support REQUEST. `crm_ticket_sla_policies` relates to tickets, its
-- targets key on `Ticket.priority`, and a lead that becomes a contact or a deal
-- has no clock at all — which is the common case and the expensive one, because
-- the lead nobody answered is a sale, not a support query.
--
-- What those policies DO already carry is the hard part: a business calendar
-- with a timezone, a weekly pattern, holidays, and an amber threshold, plus a
-- pure engine (`sla-clock.ts`) that counts BUSINESS minutes correctly across a
-- clock change. Standing up a second clock would have meant reimplementing that,
-- and two implementations of business-hours arithmetic will disagree.
--
-- So: one new number on the policy that already owns the calendar, and two
-- instants on the person.

ALTER TABLE "crm_ticket_sla_policies"
    ADD COLUMN "lead_response_minutes" INTEGER,
    -- Null means "this business makes no promise about how fast it answers a new
    -- enquiry", which is a legitimate position and must not render as overdue.
    ADD CONSTRAINT "crm_sla_lead_response_check"
        CHECK ("lead_response_minutes" IS NULL OR "lead_response_minutes" > 0);

ALTER TABLE "customers"
    -- When the promise runs out, in BUSINESS time, computed once at capture.
    -- Stored rather than derived on read for two reasons: "who is about to go
    -- unanswered" has to be an index scan rather than a calendar computation per
    -- row, and a policy edited in March must not silently move what was promised
    -- in February.
    ADD COLUMN "lead_response_due_at" TIMESTAMPTZ,
    -- When somebody actually got back to them. Null while the clock runs.
    ADD COLUMN "first_responded_at" TIMESTAMPTZ;

-- The working query: leads still waiting, soonest deadline first. Partial, so it
-- indexes only the rows the question is about — an answered lead is not in the
-- queue and a lead nobody promised anything about was never in it.
CREATE INDEX "customers_lead_response_pending_idx"
    ON "customers" ("tenant_id", "lead_response_due_at")
    WHERE "first_responded_at" IS NULL AND "lead_response_due_at" IS NOT NULL;
