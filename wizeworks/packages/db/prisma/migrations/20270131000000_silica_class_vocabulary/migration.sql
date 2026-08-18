-- Retire the `st-*` class vocabulary from persisted Builder trees.
--
-- Every builder node carries its look as a CLASS STRING (docs/47). Until now that
-- string was written in a sparx-only recipe vocabulary — `st-btn st-c-primary
-- st-v-solid st-btn--sz-md` — resolved by @sparx/site-ui's stylesheet. The render
-- path now emits silicaui's own classes (`btn btn-primary btn-md`) and site-ui is
-- gone, so a tree still holding the old spelling would render as UNSTYLED markup:
-- a button with no fill, a badge with no pill, an alert with no surface.
--
-- New stamps have been clean since the catalog change; this converts what is
-- already SAVED. It must run BEFORE the site-ui stylesheet stops being served.
-- See docs/implementation/st-token-retirement.md.
--
-- ── The mapping ────────────────────────────────────────────────────────────────
--
-- A token's silica equivalent depends on which COMPONENT wears it (`st-c-primary`
-- is `btn-primary` on a Button and `badge-primary` on a Tag), so the rewrite is
-- driven by `node.type` → the silica family, then applied token by token:
--
--   st-<family-base>          → <family>            (the base class)
--   st-c-<color>             → <family>-<color>
--   st-v-solid                → dropped             (silica's default emits nothing)
--   st-v-soft|outline|ghost|link → <family>-<same>
--   st-v-dashed               → <family>-dash       (silica's spelling)
--   st-v-glass                → glass               (a universal treatment)
--   st-fv-*                   → dropped             (silica fields have one look)
--   st-<base>--sz-<step>      → <family>-<step>
--
-- Two colors have no silica counterpart and are handled deliberately:
--   · `surface` — the light-glass slot. Dropped; on a button `st-v-glass` already
--     became `glass`, which is what actually produced that look.
--   · `highlight` / `danger` — both ARE registered with the plugin in each app's
--     globals.css, so they carry through unchanged.
--
-- Anything that is not an `st-` token (Tailwind utilities, `bx-*` behaviour
-- classes) is preserved verbatim and in order.
--
-- Typography nodes have no family; their retired classes map to silica's own type
-- scale (`st-h--1` → `h1`, `st-text--meta` → `text-sm`, …) — see the CASE below.
--
-- IDEMPOTENT: the rewrite only ever consumes tokens starting with `st-` and emits
-- none, and every UPDATE is guarded on the row containing an `st-` TOKEN — so a
-- second run matches no rows and writes nothing.
--
-- That guard is `~ '["[:space:]]st-'`, not `LIKE '%st-%'`, and the difference is
-- not pedantry. A class token can only ever start right after a quote (it opens
-- the JSON string) or after a space (it follows another class), so requiring one
-- of those costs nothing in recall. A bare substring match, by contrast, fires on
-- ordinary CONTENT: `best-selling`, `fast-growing`, `first-time`, `list-none`,
-- `/request-demo`, `Cast-iron` — all contain "st-". On the real dev dataset that
-- was 28 rows with no `st-` class between them, which the loose guard would have
-- rewritten to an identical value on this run and on every future one.
--
-- DATA migration over jsonb trees, so it loops tenants + set_config('app.tenant_id')
-- to read/write the FORCE-RLS builder tables (sparx_owner is non-superuser in prod).

-- ── The silica family for a node type ────────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.silica_family(node_type text)
RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE node_type
    WHEN 'Button'         THEN 'btn'
    WHEN 'Badge'          THEN 'badge'
    WHEN 'Tag'            THEN 'badge'
    WHEN 'Alert'          THEN 'alert'
    WHEN 'Callout'        THEN 'alert'
    WHEN 'Input'          THEN 'input'
    WHEN 'Textarea'       THEN 'textarea'
    WHEN 'Select'         THEN 'select'
    WHEN 'Checkbox'       THEN 'checkbox'
    WHEN 'Radio'          THEN 'radio'
    WHEN 'Switch'         THEN 'switch'
    WHEN 'Range'          THEN 'range'
    WHEN 'FileInput'      THEN 'file-input'
    WHEN 'Label'          THEN 'label'
    WHEN 'Field'          THEN 'field'
    WHEN 'Progress'       THEN 'progress'
    WHEN 'RadialProgress' THEN 'radial-progress'
    WHEN 'Skeleton'       THEN 'skeleton'
    WHEN 'Spinner'        THEN 'loading'
    WHEN 'Avatar'         THEN 'avatar'
    WHEN 'Rating'         THEN 'rating'
    WHEN 'Kbd'            THEN 'kbd'
    WHEN 'Status'         THEN 'status'
    WHEN 'Table'          THEN 'table'
    WHEN 'List'           THEN 'list'
    WHEN 'ChatBubble'     THEN 'chat'
    WHEN 'Countdown'      THEN 'countdown'
    WHEN 'Menu'           THEN 'menu'
    WHEN 'Steps'          THEN 'steps'
    WHEN 'Pagination'     THEN 'pagination'
    WHEN 'Breadcrumb'     THEN 'breadcrumb'
    WHEN 'Link'           THEN 'link'
    WHEN 'Dock'           THEN 'dock'
    WHEN 'Indicator'      THEN 'indicator'
    WHEN 'Join'           THEN 'join'
    WHEN 'Mask'           THEN 'mask'
    WHEN 'Browser'        THEN 'mockup-browser'
    WHEN 'Window'         THEN 'mockup-window'
    WHEN 'Phone'          THEN 'mockup-phone'
    WHEN 'Code'           THEN 'mockup-code'
    WHEN 'Swap'           THEN 'swap'
    WHEN 'Filter'         THEN 'filter'
    WHEN 'Calendar'       THEN 'calendar'
    WHEN 'Diff'           THEN 'diff'
    -- A Dialog's class styles its TRIGGER, which is a button.
    WHEN 'Dialog'         THEN 'btn'
    ELSE NULL
  END;
$fn$;

-- ── One class string → its silica equivalent ─────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.silica_class(cls text, node_type text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $fn$
DECLARE
  fam text := pg_temp.silica_family(node_type);
  tok text;
  out_toks text[] := ARRAY[]::text[];
  mapped text;
  suffix text;
BEGIN
  IF cls IS NULL OR cls = '' THEN RETURN cls; END IF;
  -- Nothing to do unless an `st-` token is actually present. Keeps the function a
  -- no-op (and the UPDATE a no-op) for already-migrated trees.
  IF position('st-' in cls) = 0 THEN RETURN cls; END IF;

  FOREACH tok IN ARRAY regexp_split_to_array(trim(cls), '\s+') LOOP
    IF tok = '' THEN
      CONTINUE;
    ELSIF tok NOT LIKE 'st-%' THEN
      -- A Tailwind utility or a `bx-*` behaviour class: keep it verbatim.
      out_toks := out_toks || tok;
      CONTINUE;
    END IF;

    mapped := NULL;

    -- Typography, which has no component family — map to silica's type scale.
    IF tok IN ('st-h', 'st-text', 'st-text--body') THEN
      mapped := NULL;                       -- structural only; silica needs nothing
    ELSIF tok = 'st-h--1' THEN mapped := 'h1';
    ELSIF tok = 'st-h--2' THEN mapped := 'h2';
    ELSIF tok = 'st-h--3' THEN mapped := 'h3';
    ELSIF tok = 'st-h--display' THEN mapped := 'display-1';
    -- `meta` was a MUTED ink on text a reader is meant to read, which RULE #3
    -- forbids; it becomes smaller rather than fainter.
    ELSIF tok = 'st-text--meta' THEN mapped := 'text-sm';
    -- An eyebrow is a RULE #2 violation and the component no longer offers one.
    ELSIF tok = 'st-text--eyebrow' THEN mapped := NULL;

    -- Color.
    ELSIF tok LIKE 'st-c-%' THEN
      suffix := substring(tok from 6);
      IF suffix = 'surface' THEN
        mapped := NULL;                     -- no silica counterpart; see the header
      ELSIF fam IS NOT NULL THEN
        mapped := fam || '-' || suffix;
      END IF;

    -- Field treatment: silica's inputs have a single look, so these all drop.
    ELSIF tok LIKE 'st-fv-%' THEN
      mapped := NULL;

    -- Button / chip treatment.
    ELSIF tok LIKE 'st-v-%' THEN
      suffix := substring(tok from 6);
      IF suffix = 'solid' THEN
        mapped := NULL;                     -- silica's default emits no class
      ELSIF suffix = 'glass' THEN
        mapped := 'glass';                  -- a universal treatment, family-free
      ELSIF suffix = 'dashed' THEN
        IF fam IS NOT NULL THEN mapped := fam || '-dash'; END IF;
      ELSIF fam IS NOT NULL THEN
        mapped := fam || '-' || suffix;
      END IF;

    -- Size — `st-<base>--sz-<step>`.
    ELSIF tok ~ '^st-[a-z0-9-]+--sz-(xs|sm|md|lg|xl)$' THEN
      suffix := substring(tok from '--sz-([a-z]+)$');
      IF fam IS NOT NULL THEN mapped := fam || '-' || suffix; END IF;

    -- The family's own base class (`st-btn`, `st-alert`, `st-input`, …).
    ELSIF fam IS NOT NULL THEN
      mapped := fam;

    END IF;

    IF mapped IS NOT NULL AND NOT (mapped = ANY (out_toks)) THEN
      out_toks := out_toks || mapped;
    END IF;
  END LOOP;

  -- The base class first, so a rewritten string reads like an authored one.
  IF fam IS NOT NULL AND NOT (fam = ANY (out_toks))
     AND EXISTS (SELECT 1 FROM unnest(out_toks) t WHERE t LIKE fam || '-%') THEN
    out_toks := ARRAY[fam] || out_toks;
  END IF;

  RETURN array_to_string(out_toks, ' ');
END;
$fn$;

-- ── Recursive tree walker ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.silica_class_convert(node jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $func$
DECLARE
  child jsonb;
  new_children jsonb := '[]'::jsonb;
  next_class text;
BEGIN
  IF jsonb_typeof(node) <> 'object' THEN RETURN node; END IF;

  IF node ? 'class' AND jsonb_typeof(node->'class') = 'string' THEN
    next_class := pg_temp.silica_class(node->>'class', node->>'type');
    IF next_class IS DISTINCT FROM node->>'class' THEN
      node := jsonb_set(node, '{class}', to_jsonb(next_class), true);
    END IF;
  END IF;

  IF jsonb_typeof(node->'children') = 'array' THEN
    FOR child IN SELECT * FROM jsonb_array_elements(node->'children') LOOP
      new_children := new_children || jsonb_build_array(pg_temp.silica_class_convert(child));
    END LOOP;
    node := jsonb_set(node, '{children}', new_children, true);
  END IF;

  RETURN node;
END;
$func$;

DO $do$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);

    -- Pages + layouts: draft AND published, so a live site is fixed without
    -- waiting for its owner to re-publish.
    -- Every UPDATE is guarded on the row actually carrying an `st-` TOKEN (see
    -- the header for why the guard is a token-boundary regex rather than a bare
    -- substring). The walker rebuilds a node's `children` array unconditionally,
    -- so without a guard a clean row is still rewritten to a byte-identical
    -- value — the migration would touch every builder row in the fleet, and each
    -- re-run would do it again.

    -- Pages + layouts: draft AND published, so a live site is fixed without
    -- waiting for its owner to re-publish.
    UPDATE builder_pages
       SET draft_tree = pg_temp.silica_class_convert(draft_tree),
           published_tree = CASE
             WHEN published_tree IS NOT NULL
             THEN pg_temp.silica_class_convert(published_tree)
             ELSE published_tree END
     WHERE draft_tree::text ~ '["[:space:]]st-'
        OR published_tree::text ~ '["[:space:]]st-';

    UPDATE builder_layouts
       SET draft_tree = pg_temp.silica_class_convert(draft_tree),
           published_tree = CASE
             WHEN published_tree IS NOT NULL
             THEN pg_temp.silica_class_convert(published_tree)
             ELSE published_tree END
     WHERE draft_tree::text ~ '["[:space:]]st-'
        OR published_tree::text ~ '["[:space:]]st-';

    -- Emails render through the same leaf map, so their trees carry the same
    -- vocabulary.
    UPDATE builder_emails
       SET draft_tree = pg_temp.silica_class_convert(draft_tree),
           published_tree = CASE
             WHEN published_tree IS NOT NULL
             THEN pg_temp.silica_class_convert(published_tree)
             ELSE published_tree END
     WHERE draft_tree::text ~ '["[:space:]]st-'
        OR published_tree::text ~ '["[:space:]]st-';

    -- Reusable single-node blocks.
    UPDATE builder_email_blocks
       SET node = pg_temp.silica_class_convert(node)
     WHERE node::text ~ '["[:space:]]st-';

    -- Tenant-authored components + archetypes: the source a future stamp copies
    -- FROM, so leaving these unconverted would re-introduce the old vocabulary
    -- into new pages.
    UPDATE builder_component_versions
       SET tree = pg_temp.silica_class_convert(tree)
     WHERE tree IS NOT NULL
       AND tree::text ~ '["[:space:]]st-';

    UPDATE builder_archetypes
       SET tree = pg_temp.silica_class_convert(tree)
     WHERE tree::text ~ '["[:space:]]st-';
  END LOOP;

  -- The published platform catalog is PLATFORM-scoped, not tenant-scoped, so it
  -- sits outside the loop. Its data-as-code source already emits silica classes;
  -- this converts rows published before that change, which a tenant would
  -- otherwise stamp the old vocabulary FROM.
  UPDATE platform_components
     SET tree = pg_temp.silica_class_convert(tree)
   WHERE tree::text ~ '["[:space:]]st-';
END;
$do$;

-- NOT converted, deliberately:
--   · builder_draft_versions.manifest / builder_releases.manifest — reference
--     lists ([{ownerKind, ownerId, hash}]), not trees.
--   · builder_page_artifacts.tree / builder_email_versions.document — the silica
--     page + email documents (docs/126), authored in silica's vocabulary from the
--     start, so they never held an `st-` class.
