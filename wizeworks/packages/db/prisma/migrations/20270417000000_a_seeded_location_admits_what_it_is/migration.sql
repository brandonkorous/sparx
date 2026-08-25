-- A seeded location admits what it is (issue 174).
--
-- Devi opened Stock → Locations and found a warehouse in Columbus, Ohio she had
-- never created. The answer to that — a `Sample` badge on rows an industry pack
-- wrote — is built and correct: the API returns `isSample` from
-- `metadata.sample`, and the list draws the badge beside the name.
--
-- It has never applied to a single row. The marker is stamped on CREATE only,
-- which is right (a tenant whose own location happens to share a code must keep
-- its own), and every pack-seeded location in existence predates the marker:
--
--     marked sample locations before this migration : 0
--     pack-seeded, unmarked                         : 13, across 8 tenants
--
-- Worse, they can never acquire one. A pack declares its warehouse by `code`, so
-- a later practice-data load upserts onto the row that is already there, takes
-- the `update` branch, and by design does not stamp it. Without this backfill the
-- label helps only businesses that do not exist yet, and the two rows that caused
-- the issue stay unexplained forever.
--
-- ── HOW A ROW IS IDENTIFIED, AND WHY IT IS THIS STRICT ──────────────────────
--
-- Four fields must match a pack's declaration exactly: code, name, city, region.
-- Not one of them alone, and not code+name — because a business could plausibly
-- have a "Dry Store", and could plausibly code it `DRYSTORE`. What it will not do
-- is also put it in Asheville, NC. The full tuple is a fingerprint of the pack
-- that wrote it; anything that differs in any field is left alone.
--
-- Verified against the live set before writing: all 13 candidates match their
-- pack's tuple exactly, and there are no near-misses to adjudicate.
--
-- ── WHY `MAIN` IS ABSENT FROM THIS LIST, DELIBERATELY ───────────────────────
--
-- `bootstrapDefaultWarehouse` seeds `MAIN` / `Main Warehouse` when the stock
-- module is switched on, from the owner's OWN business address, and writes an
-- audit entry saying so. That row is hers and the issue says so explicitly. Three
-- packs (auto-parts, electronics, generic) also declare code `MAIN`, so on those
-- tenants the two are indistinguishable after the fact — the pack upserted onto
-- her bootstrap row rather than creating one.
--
-- Labelling an ambiguous row "Sample" would put a false statement on her screen
-- about the one location the platform set up FOR her, which is a worse failure
-- than the one being fixed. So `MAIN` is excluded and stays excluded. 41 rows
-- carry it; not one is touched here.
--
-- (Electronics declares `MAIN` under the name "Fulfillment Center", which means
-- that pack RENAMES a tenant's bootstrap warehouse. That is its own bug and is
-- not addressed here — it is a write-side problem, not a labelling one.)
--
-- ── SAFETY ─────────────────────────────────────────────────────────────────
--
-- Additive and reversible: it merges one key into `metadata` and touches nothing
-- else — not the name, not the address, not the stock. A row that already carries
-- any `sample` value is skipped, so re-running is a no-op. `inventory_warehouses`
-- is not FORCE-RLS for the owner role, so a plain UPDATE sees every row (the same
-- reasoning the users backfill records one migration earlier).

UPDATE "inventory_warehouses" w
   SET "metadata" = COALESCE(w."metadata", '{}'::jsonb) || '{"sample": true}'::jsonb
  FROM (
    VALUES
      ('FC-1',       'Fulfillment Center',          'Columbus',  'OH'),
      ('WEST-3PL',   'West Coast 3PL',              'Reno',      'NV'),
      ('STUDIO',     'Front Desk Retail',           'Portland',  'OR'),
      ('STUDIO',     'Studio Stockroom',            'Portland',  'OR'),
      ('COOLER',     'Shop Cooler',                 'Asheville', 'NC'),
      ('DRYSTORE',   'Dry Store',                   'Asheville', 'NC'),
      ('ROAST',      'Roastery & Pantry',           'Portland',  'OR'),
      ('EAST-3PL',   'East Coast Fulfillment',      'Lancaster', 'PA'),
      ('DC1',        'Central Distribution Center', 'Columbus',  'OH'),
      ('DC2-3PL',    'Southeast 3PL',               'Atlanta',   'GA')
  ) AS pack(code, name, city, region)
 WHERE w."code"   = pack.code
   AND w."name"   = pack.name
   AND w."city"   = pack.city
   AND w."region" = pack.region
   AND w."deleted_at" IS NULL
   AND (w."metadata" -> 'sample') IS NULL;
