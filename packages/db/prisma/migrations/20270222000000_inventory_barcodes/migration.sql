-- docs/146 Phase 3.1 — Barcodes: the scan registry.
--
-- `commerce_product_variants.barcode` is a single nullable VARCHAR(14) written
-- once at import and read only by the channel feeds. It is a catalogue field,
-- not a scan registry, and it is short of what a warehouse needs in four ways:
--
--   1. A thing has MORE THAN ONE barcode — the unit UPC, the case ITF-14, the
--      supplier's own label, and whatever the previous system printed and stuck
--      on four hundred shelves. All of them are in the room; all must scan.
--   2. A case barcode means TWELVE. Scanning it and adding one is the commonest
--      silent receiving error there is — nothing about the number twelve appears
--      anywhere for anyone to have checked.
--   3. A barcode has a SYMBOLOGY. UPC-A and EAN-13 carry check digits that catch
--      a mis-key before the ledger; Code 128 carries none. Storing the format is
--      what makes validation possible at all.
--   4. Items with NO barcode need one, or "the ones we can scan and the ones we
--      can't" quietly turns a scan-first workflow back into typing.
--
-- ── UNIQUE (tenant_id, value), strictly ─────────────────────────────────────
--
-- A scan must resolve to exactly ONE variant, or every Phase 3 workflow ends at
-- a disambiguation prompt and there was no point scanning. Two variants sharing
-- a manufacturer GTIN is a real situation and this constraint refuses it — on
-- purpose, because the alternative is finding out on the dock at 6am rather than
-- when someone typed the second one in.
--
-- ── The variant column stays, as a derived mirror ───────────────────────────
--
-- Two dozen call sites read `variants.barcode` and all mean the same thing by
-- it: the GTIN this product is known by outside. It keeps meaning that. The
-- service mirrors a primary row down into the column only when that row is a
-- GTIN-family code — an internal Code 128 is ours and means nothing to Google.
--
-- RLS FOOTGUN (packages/db/CLAUDE.md): the backfill writes to a FORCE-RLS table
-- and `sparx_owner` is a NON-superuser in production, so it runs inside a
-- per-tenant `set_config('app.tenant_id', …)` loop. Unscoped it would touch zero
-- rows and still report success — and would PASS locally, where docker's owner
-- is a superuser.

-- ══════════════════════════════════════════════════════════════════════════
-- 1. The registry
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE "commerce_variant_barcodes" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"       UUID         NOT NULL,
  "variant_id"      UUID         NOT NULL,

  -- Normalized on write: trimmed, internal whitespace stripped, upper-cased for
  -- the alphanumeric symbologies. Without that the unique index below is
  -- defeated by a trailing space and the duplicate it exists to catch gets in.
  "value"           VARCHAR(64)  NOT NULL,

  "symbology"       VARCHAR(20)  NOT NULL DEFAULT 'code_128',

  -- Base units per ONE scan. The case-of-twelve problem made explicit.
  "pack_size"       INTEGER      NOT NULL DEFAULT 1,

  "is_primary"      BOOLEAN      NOT NULL DEFAULT false,

  -- The code on the SUPPLIER's packaging rather than ours. The same item arrives
  -- wearing a different label from each supplier and receiving accepts them all.
  "supplier_id"     UUID,

  "label"           VARCHAR(120),
  "source"          VARCHAR(20)  NOT NULL DEFAULT 'manual',

  -- Answers the only question that decides whether an old code can be retired:
  -- is anyone still scanning the labels we printed in 2019?
  "last_scanned_at" TIMESTAMPTZ,
  "scan_count"      INTEGER      NOT NULL DEFAULT 0,

  "is_active"       BOOLEAN      NOT NULL DEFAULT true,

  "created_at"      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "created_by"      VARCHAR(127),

  CONSTRAINT "commerce_variant_barcodes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commerce_variant_barcodes_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  CONSTRAINT "commerce_variant_barcodes_variant_fk"
    FOREIGN KEY ("variant_id") REFERENCES "commerce_product_variants" ("id") ON DELETE CASCADE,
  CONSTRAINT "commerce_variant_barcodes_supplier_fk"
    FOREIGN KEY ("supplier_id") REFERENCES "inventory_suppliers" ("id") ON DELETE SET NULL,

  CONSTRAINT "commerce_variant_barcodes_symbology_check" CHECK (
    "symbology" IN ('upc_a','upc_e','ean_13','ean_8','gtin_14','itf_14','code_128','code_39','qr','other')
  ),
  CONSTRAINT "commerce_variant_barcodes_source_check" CHECK (
    "source" IN ('manual','generated','import','supplier','channel','scan')
  ),
  -- A pack of zero would make scan-to-receive add nothing while reporting a
  -- scan, which is worse than refusing the row.
  CONSTRAINT "commerce_variant_barcodes_pack_size_check" CHECK ("pack_size" >= 1),
  CONSTRAINT "commerce_variant_barcodes_value_check" CHECK (length(btrim("value")) > 0)
);

-- The rule the whole scan layer rests on.
CREATE UNIQUE INDEX "commerce_variant_barcodes_tenant_value_unique"
  ON "commerce_variant_barcodes" ("tenant_id", "value");

-- Exactly one primary per variant. Partial, so the many non-primary rows do not
-- collide with each other.
CREATE UNIQUE INDEX "commerce_variant_barcodes_variant_primary_unique"
  ON "commerce_variant_barcodes" ("variant_id") WHERE "is_primary";

CREATE INDEX "commerce_variant_barcodes_tenant_variant_idx"
  ON "commerce_variant_barcodes" ("tenant_id", "variant_id");
CREATE INDEX "commerce_variant_barcodes_tenant_supplier_idx"
  ON "commerce_variant_barcodes" ("tenant_id", "supplier_id");

ALTER TABLE "commerce_variant_barcodes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commerce_variant_barcodes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "commerce_variant_barcodes"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 2. The internal-barcode allocator
-- ══════════════════════════════════════════════════════════════════════════
--
-- A stored counter rather than `MAX(value) + 1`, because the two differ in
-- exactly the case that matters: delete the highest internal barcode and
-- `MAX + 1` re-issues that number while four hundred labels carrying it are
-- still stuck to shelves. A printed barcode must never be re-used, so this only
-- ever goes up and deleting a registry row does not lower it.

CREATE TABLE "inventory_barcode_sequences" (
  "tenant_id"  UUID        NOT NULL,
  "next_value" BIGINT      NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "inventory_barcode_sequences_pkey" PRIMARY KEY ("tenant_id"),
  CONSTRAINT "inventory_barcode_sequences_tenant_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE,
  -- 10 digits is the body of a number-system-2 UPC-A; past that the code no
  -- longer fits the symbology and would have to change format mid-flight.
  CONSTRAINT "inventory_barcode_sequences_range_check" CHECK ("next_value" BETWEEN 1 AND 9999999999)
);

ALTER TABLE "inventory_barcode_sequences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_barcode_sequences" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "inventory_barcode_sequences"
  USING ("tenant_id" = current_tenant_id());

-- ══════════════════════════════════════════════════════════════════════════
-- 3. Backfill — every existing variant barcode becomes a registry row
-- ══════════════════════════════════════════════════════════════════════════
--
-- Symbology is inferred from length, which is total here: the column is
-- numeric-only VARCHAR(14), so 8/12/13/14 covers everything that can be in it.
-- Anything else is a value that was never a valid GTIN in the first place and is
-- recorded as `other` rather than guessed at.
--
-- DISTINCT ON handles the duplicates that the old nullable column allowed and
-- the new unique index forbids: the OLDEST variant keeps the claim. The losers
-- are NOT silently dropped — their `variants.barcode` column is left exactly as
-- it is, and `listBarcodeConflicts` in the service surfaces every variant whose
-- column value has no registry row, so the tenant sees the collision and picks a
-- winner rather than finding out when a scan lands on the wrong item.
--
-- `source = 'import'`: these came from outside, so they are not ours to reprint.

DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        PERFORM set_config('app.tenant_id', t.id::text, false);

        INSERT INTO "commerce_variant_barcodes"
            ("tenant_id", "variant_id", "value", "symbology", "is_primary", "source", "created_at")
        SELECT DISTINCT ON (v."tenant_id", btrim(v."barcode"))
               v."tenant_id",
               v."id",
               btrim(v."barcode"),
               CASE length(btrim(v."barcode"))
                 WHEN 8  THEN 'ean_8'
                 WHEN 12 THEN 'upc_a'
                 WHEN 13 THEN 'ean_13'
                 WHEN 14 THEN 'gtin_14'
                 ELSE 'other'
               END,
               true,
               'import',
               v."created_at"
          FROM "commerce_product_variants" v
         WHERE v."tenant_id" = t.id
           AND v."barcode" IS NOT NULL
           AND btrim(v."barcode") <> ''
           AND v."deleted_at" IS NULL
         ORDER BY v."tenant_id", btrim(v."barcode"), v."created_at", v."id"
        ON CONFLICT ("tenant_id", "value") DO NOTHING;
    END LOOP;
    PERFORM set_config('app.tenant_id', '', false);
END $$;
