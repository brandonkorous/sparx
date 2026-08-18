-- Two tenant-wide contacts could hold the same email address forever.
--
-- `customers_tenant_property_email_unique` is `(tenant_id, property_id, email)`,
-- and Postgres counts NULLs as DISTINCT. A contact that belongs to the whole
-- tenant rather than one site has `property_id IS NULL`, so no two of them ever
-- compared equal and the constraint never fired for them. It protected
-- site-scoped contacts only. The gap is invisible from the application: inserts
-- succeed, nothing errors, and one person quietly becomes two records with half
-- their history each.
--
-- WHY A SECOND INDEX RATHER THAN `NULLS NOT DISTINCT` ON THE FIRST ONE. That
-- keyword applies to the whole index, not one column, so it would also make two
-- contacts with NO email collide — and a phone-only contact is completely
-- normal in a CRM. Turning a silent gap into "you cannot add a second contact
-- without an email address" would be the worse bug. A partial index over
-- exactly the rows that need it says the same thing without the side effect.
--
-- WHY LIVE ROWS ONLY, when the site-scoped index deliberately counts deleted
-- ones. At site scope, a deleted contact holding its address is a feature — the
-- save fails and the app can say "that contact is in your bin", which is the
-- only answer that explains why. At TENANT scope the same rule would let one
-- deleted contact reserve an address across every site the business runs,
-- forever, with no way to release it short of a hard delete. The narrower
-- guarantee is the deliberate one.

-- ── 1. Retire duplicates that carry nothing ──────────────────────────────────
--
-- Only rows that no other table references at all: no order, deal, ticket,
-- activity, booking, consent record, nothing. By construction those lose no
-- history, and a soft delete is reversible if this judged one wrong. Anything
-- carrying real data is left exactly as it is and reported in step 2 — merging
-- customers relinks ~39 foreign keys and belongs in `mergeService`, which has
-- tests, not in a migration.
--
-- The tenant loop is not decoration: `customers` is FORCE RLS and `sparx_owner`
-- is a NON-SUPERUSER in production, so a query without `app.tenant_id` set
-- returns zero rows there while quietly passing here on a superuser — and the
-- cleanup would silently do nothing before the index below failed the deploy.
DO $$
DECLARE
  t          RECORD;
  dup        RECORD;
  ref        RECORD;
  referenced BOOLEAN;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    PERFORM set_config('app.tenant_id', t.id::text, TRUE);

    FOR dup IN
      SELECT id FROM (
        SELECT c.id,
               row_number() OVER (
                 PARTITION BY c.email ORDER BY c.created_at, c.id
               ) AS rn
        FROM customers c
        WHERE c.tenant_id = t.id
          AND c.property_id IS NULL
          AND c.email IS NOT NULL
          AND c.deleted_at IS NULL
      ) ranked
      WHERE rn > 1
    LOOP
      referenced := FALSE;

      -- Every table that points at a customer, discovered rather than listed,
      -- so a table added next year is covered without anybody remembering to
      -- come back here. A false positive only means "left alone", which is the
      -- safe direction.
      FOR ref IN
        SELECT c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables tb
          ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
        WHERE c.table_schema = 'public'
          AND c.column_name = 'customer_id'
          AND tb.table_type = 'BASE TABLE'
      LOOP
        EXECUTE format(
          'SELECT EXISTS (SELECT 1 FROM public.%I WHERE customer_id = $1)',
          ref.table_name
        ) INTO referenced USING dup.id;
        EXIT WHEN referenced;
      END LOOP;

      IF NOT referenced THEN
        UPDATE customers
           SET deleted_at = now()
         WHERE id = dup.id;
      END IF;
    END LOOP;
  END LOOP;

  PERFORM set_config('app.tenant_id', '', TRUE);
END $$;

-- ── 2. Stop here if a real conflict is left ──────────────────────────────────
--
-- Deliberately loud. The alternative is a `CREATE UNIQUE INDEX` that fails with
-- "could not create unique index" and a row id, which says nothing about whose
-- data it is or what to do about it. The data stage runs BEFORE containers roll,
-- so a stop here leaves the previous release serving while somebody merges the
-- pair in the Duplicates screen — the surface built for it, and the only thing
-- that moves the orders and conversations across correctly.
--
-- IF THIS FIRES IN A DEPLOY, recovery is two steps, not one. Prisma runs each
-- migration in a transaction, so nothing above has been applied — but the
-- attempt is still recorded as FAILED in `_prisma_migrations`, and every later
-- `migrate deploy` refuses until that record is cleared. Merge the pairs it
-- names, then `prisma migrate resolve --rolled-back
-- 20270220000000_crm_customer_tenant_wide_email_unique` before re-running.
DO $$
DECLARE
  t         RECORD;
  conflicts TEXT[] := '{}';
  row_text  TEXT;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    PERFORM set_config('app.tenant_id', t.id::text, TRUE);

    FOR row_text IN
      SELECT format('tenant %s: %s (%s contacts)', t.id, c.email, count(*))
      FROM customers c
      WHERE c.tenant_id = t.id
        AND c.property_id IS NULL
        AND c.email IS NOT NULL
        AND c.deleted_at IS NULL
      GROUP BY c.email
      HAVING count(*) > 1
    LOOP
      conflicts := conflicts || row_text;
    END LOOP;
  END LOOP;

  PERFORM set_config('app.tenant_id', '', TRUE);

  IF array_length(conflicts, 1) > 0 THEN
    RAISE EXCEPTION
      'Cannot make tenant-wide contact emails unique: % address(es) are still held by more than one contact that carries real history. Merge each pair in the CRM Duplicates screen, then re-run. %',
      array_length(conflicts, 1),
      array_to_string(conflicts[1:20], '; ');
  END IF;
END $$;

-- ── 3. The constraint ────────────────────────────────────────────────────────
CREATE UNIQUE INDEX "customers_tenant_global_email_unique"
    ON "customers" ("tenant_id", "email")
 WHERE "property_id" IS NULL AND "email" IS NOT NULL AND "deleted_at" IS NULL;

COMMENT ON INDEX "customers_tenant_global_email_unique" IS
  'Tenant-wide contacts (property_id IS NULL) share one address book, so one live contact per email. Partial rather than NULLS NOT DISTINCT so that contacts without an email are unconstrained.';
