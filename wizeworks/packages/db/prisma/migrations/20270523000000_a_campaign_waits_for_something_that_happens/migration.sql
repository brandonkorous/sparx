-- A campaign waits for something that happens
--
-- The seven shipped campaign recipes could not record anybody on their own:
--
--   1. Every goal checked a field called `email` (first with `is_not_empty`, an
--      operator that does not exist, then `is_set`). No event resolves a
--      field called `email` (people arrive as `customer.email`), so no goal could
--      ever come true, and nothing checked goals anyway.
--   2. No step said what puts somebody on it, so only a form, the API or MCP
--      could, and a shipped campaign sat empty whatever the business did.
--   3. Three steps ("Read the welcome", "We got back in touch", "They opened it")
--      had no event that could ever record them, so they would report 0 forever.
--
-- The automation worker now moves people through campaigns on every event
-- (@wizeworks/funnels advance.ts). This gives installed recipes the steps and
-- goal library.ts now ships. The JSON below is generated from library.ts, and
-- funnels/src/goals.test.ts fails if the two ever differ.
--
-- ── ONLY WHAT NOBODY CHANGED ────────────────────────────────────────────────
--
-- `origin = 'system'` rows only, and each column only where it still holds the
-- EXACT shipped value: a business that edited its steps keeps its steps, and one
-- that wrote its own goal keeps its goal. `updated_at` is left alone. Idempotent:
-- a second run finds nothing still holding an old value.
--
-- `funnels` is ENABLE + FORCE row level security and `sparx_owner` is a
-- non-superuser in production, so this loops tenants and sets `app.tenant_id`
-- (wizeworks/packages/db/CLAUDE.md, "Backfilling a FORCE-RLS table").

CREATE TEMP TABLE _recipe_refresh (
  recipe_key TEXT,
  old_stages JSONB,
  new_stages JSONB,
  new_goal JSONB
);
INSERT INTO _recipe_refresh VALUES
    ('cart-recovery',
     '[{"key":"basket","name":"Put something in a basket","kind":"capture"},{"key":"checkout","name":"Started checking out","kind":"engage"},{"key":"paid","name":"Paid","kind":"convert"}]'::jsonb,
     '[{"key":"basket","name":"Left a basket behind","kind":"capture","match":{"logic":"AND","conditions":[{"field":"event.type","operator":"eq","value":"cart.abandoned"}]}},{"key":"checkout","name":"Started checking out","kind":"engage","match":{"logic":"AND","conditions":[{"field":"event.type","operator":"eq","value":"checkout.started"}]}},{"key":"paid","name":"Paid","kind":"convert"}]'::jsonb,
     '{"logic":"AND","conditions":[{"field":"order.paymentStatus","operator":"eq","value":"paid"}]}'::jsonb),
    ('post-purchase',
     '[{"key":"ordered","name":"Placed an order","kind":"capture"},{"key":"delivered","name":"Got it","kind":"engage"},{"key":"reviewed","name":"Left a review","kind":"engage"},{"key":"reordered","name":"Ordered again","kind":"convert"}]'::jsonb,
     '[{"key":"ordered","name":"Paid for an order","kind":"capture","match":{"logic":"AND","conditions":[{"field":"event.type","operator":"eq","value":"order.paid"}]}},{"key":"delivered","name":"Got it","kind":"engage","match":{"logic":"AND","conditions":[{"field":"event.type","operator":"eq","value":"order.delivered"}]}},{"key":"reviewed","name":"Left a review","kind":"engage","match":{"logic":"AND","conditions":[{"field":"event.type","operator":"eq","value":"review.submitted"}]}},{"key":"reordered","name":"Ordered again","kind":"convert"}]'::jsonb,
     '{"logic":"AND","conditions":[{"field":"order.paymentStatus","operator":"eq","value":"paid"},{"field":"customer.orderCount","operator":"gte","value":2}]}'::jsonb),
    ('welcome',
     '[{"key":"joined","name":"Gave us their email","kind":"capture"},{"key":"opened","name":"Read the welcome","kind":"engage"},{"key":"acted","name":"Did the thing we asked","kind":"convert"}]'::jsonb,
     '[{"key":"joined","name":"Gave us their email","kind":"capture","match":{"logic":"AND","conditions":[{"field":"event.type","operator":"eq","value":"crm.customer.subscribed"}]}},{"key":"acted","name":"Did the thing we asked","kind":"convert"}]'::jsonb,
     '{"logic":"OR","conditions":[{"field":"order.paymentStatus","operator":"eq","value":"paid"},{"field":"booking.status","operator":"in","value":["requested","confirmed"]}]}'::jsonb),
    ('lead-nurture',
     '[{"key":"enquired","name":"Got in touch","kind":"capture"},{"key":"qualified","name":"Looked like a fit","kind":"qualify"},{"key":"engaged","name":"Replied to something","kind":"engage"},{"key":"bought","name":"Became a customer","kind":"convert"}]'::jsonb,
     '[{"key":"enquired","name":"Got in touch","kind":"capture","match":{"logic":"AND","conditions":[{"field":"event.type","operator":"eq","value":"form.submitted"}]}},{"key":"qualified","name":"Looked like a fit","kind":"qualify","match":{"logic":"AND","conditions":[{"field":"customer.lifecycleStage","operator":"in","value":["marketing_qualified_lead","sales_qualified_lead","opportunity"]}]}},{"key":"engaged","name":"Replied to something","kind":"engage","match":{"logic":"AND","conditions":[{"field":"event.type","operator":"eq","value":"crm.engagement.received"}]}},{"key":"bought","name":"Became a customer","kind":"convert"}]'::jsonb,
     '{"logic":"AND","conditions":[{"field":"customer.lifecycleStage","operator":"eq","value":"customer"}]}'::jsonb),
    ('win-back',
     '[{"key":"lapsed","name":"Went quiet","kind":"capture"},{"key":"reached","name":"We got back in touch","kind":"engage"},{"key":"returned","name":"Came back","kind":"convert"}]'::jsonb,
     '[{"key":"lapsed","name":"Went quiet","kind":"capture","match":{"logic":"AND","conditions":[{"field":"customer.hasOrdered","operator":"eq","value":true},{"field":"customer.daysSinceLastOrder","operator":"gte","value":120}]}},{"key":"returned","name":"Came back","kind":"convert"}]'::jsonb,
     '{"logic":"AND","conditions":[{"field":"order.paymentStatus","operator":"eq","value":"paid"}]}'::jsonb),
    ('quote-follow-up',
     '[{"key":"requested","name":"Asked for a quote","kind":"capture"},{"key":"sent","name":"We sent it","kind":"engage"},{"key":"viewed","name":"They opened it","kind":"engage"},{"key":"accepted","name":"Accepted","kind":"convert"}]'::jsonb,
     '[{"key":"requested","name":"Asked for a quote","kind":"capture","match":{"logic":"AND","conditions":[{"field":"quote.stageName","operator":"eq","value":"Submitted"}]}},{"key":"sent","name":"We sent it","kind":"engage","match":{"logic":"AND","conditions":[{"field":"quote.stageName","operator":"eq","value":"Quoted"}]}},{"key":"accepted","name":"Accepted","kind":"convert"}]'::jsonb,
     '{"logic":"AND","conditions":[{"field":"quote.stageName","operator":"eq","value":"Accepted"}]}'::jsonb),
    ('booking-no-show',
     '[{"key":"booked","name":"Booked in","kind":"capture"},{"key":"missed","name":"Did not turn up","kind":"engage"},{"key":"rebooked","name":"Booked again","kind":"convert"}]'::jsonb,
     '[{"key":"missed","name":"Did not turn up","kind":"capture","match":{"logic":"AND","conditions":[{"field":"booking.status","operator":"eq","value":"no_show"}]}},{"key":"rebooked","name":"Booked again","kind":"convert"}]'::jsonb,
     '{"logic":"AND","conditions":[{"field":"booking.status","operator":"in","value":["requested","confirmed"]}]}'::jsonb);

DO $$
DECLARE
  t        RECORD;
  touched  INT;
  steps    INT := 0;
  goals    INT := 0;
  -- Both shapes the library has shipped: `is_not_empty` (an operator that never
  -- existed) and then `is_set`. Measured on the dev database: 84 and 7 rows.
  old_goals CONSTANT JSONB[] := ARRAY[
    '{"logic":"AND","conditions":[{"field":"email","operator":"is_set"}]}'::jsonb,
    '{"logic":"AND","conditions":[{"field":"email","operator":"is_not_empty"}]}'::jsonb
  ];
BEGIN
  FOR t IN SELECT id FROM "tenants" LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);

    UPDATE "funnels" AS f
    SET "stages" = r.new_stages, "updated_at" = f."updated_at"
    FROM _recipe_refresh AS r
    WHERE f."origin" = 'system' AND f."recipe_key" = r.recipe_key AND f."stages" = r.old_stages;
    GET DIAGNOSTICS touched = ROW_COUNT;
    steps := steps + touched;

    UPDATE "funnels" AS f
    SET "goal" = r.new_goal, "updated_at" = f."updated_at"
    FROM _recipe_refresh AS r
    WHERE f."origin" = 'system' AND f."recipe_key" = r.recipe_key AND f."goal" = ANY (old_goals);
    GET DIAGNOSTICS touched = ROW_COUNT;
    goals := goals + touched;
  END LOOP;

  -- Says what LANDED, so a run that refreshes nothing is visible in the release log.
  RAISE NOTICE 'shipped campaigns: % given steps that record people, % given a goal that can come true', steps, goals;
END $$;

DROP TABLE _recipe_refresh;
