-- A text the shop never switched on is not a failure (sparx persona issue 086).
--
-- Gillett never turned texting on. Every booking still queued a text in
-- scheduling_booking_notifications, the guarded send answered `disabled` ("Text
-- messaging is not switched on for this business yet."), and the dispatch tick
-- wrote `failed`. One status for two causes, so every count of failed messages
-- was wrong. The tick now writes `not_set_up` for that outcome, and the engine
-- no longer queues a text while texting is off; this relabels the rows already
-- written the old way.
--
-- Only rows the SMS ledger proves were a `disabled` refusal: a failed text row
-- whose customer has a `disabled` sms_messages row written within two minutes
-- after the notice was claimed (claim stamps sent_at, then the send writes the
-- ledger row). A real delivery failure has a `failed` ledger row and is left
-- alone. sent_at is cleared to match what the tick now writes for a notice that
-- did not go.
--
-- Loops tenants and sets app.tenant_id per tenant: both tables are FORCE RLS,
-- and the owner role in production is not a superuser.

DO $$
DECLARE
    t         RECORD;
    n         INTEGER;
    relabeled INTEGER := 0;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, true);

        UPDATE scheduling_booking_notifications AS note
        SET status = 'not_set_up', sent_at = NULL
        FROM bookings AS b
        WHERE note.tenant_id = t.id
          AND note.channel = 'sms'
          AND note.status = 'failed'
          AND note.sent_at IS NOT NULL
          AND b.id = note.booking_id
          AND b.customer_id IS NOT NULL
          AND EXISTS (
              SELECT 1
              FROM sms_messages AS m
              WHERE m.tenant_id = t.id
                AND m.customer_id = b.customer_id
                AND m.status = 'disabled'
                AND m.created_at >= note.sent_at
                AND m.created_at < note.sent_at + INTERVAL '2 minutes'
          );
        GET DIAGNOSTICS n = ROW_COUNT;
        relabeled := relabeled + n;
    END LOOP;
    RAISE NOTICE 'texts recorded as failed that were never switched on, relabeled: %', relabeled;
END $$;
