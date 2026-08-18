-- docs/57 rebuild — NavMenu leaf → container of NavItem nodes.
--
-- The Builder's NavMenu was a LEAF that stored its links in `props.links[]` (a
-- black-box array edited by the near-invisible "navlinks" control). It is now a
-- CONTAINER whose links are individually-selectable NavItem child nodes. This
-- migration converts every existing NavMenu's `props.links[]` into NavItem
-- children so authored navs survive the change, then drops the legacy prop.
--
-- The renderer keeps a back-compat branch that renders `props.links[]` when a
-- NavMenu has no children (renderLegacyNavLinks), so an UN-migrated tree still
-- renders during the rollout; this migration makes the conversion permanent.
--
-- Idempotent: conversion is gated on a non-empty `props.links[]`, and the prop is
-- removed afterwards, so a re-run is a no-op. Each minted NavItem id is a full
-- UUID suffix (`navitem-<32hex>`) — globally unique, per the Builder id invariant
-- (root CLAUDE.md: ids double as React keys + dnd-kit sortable ids).
--
-- DATA migration over jsonb trees, so it loops tenants + set_config('app.tenant_id')
-- to read/write the FORCE-RLS builder tables (sparx_owner is non-superuser in prod).

-- Recursive walker: convert a legacy NavMenu, recurse into every node's children.
CREATE OR REPLACE FUNCTION pg_temp.navmenu_container_convert(node jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $func$
DECLARE
  child jsonb;
  link jsonb;
  links jsonb;
  converted jsonb := '[]'::jsonb;
  new_children jsonb := '[]'::jsonb;
BEGIN
  IF node->>'type' = 'NavMenu' THEN
    links := node->'props'->'links';
    IF jsonb_typeof(links) = 'array' AND jsonb_array_length(links) > 0 THEN
      -- Each non-blank legacy link → one NavItem child node. The markup a childless
      -- NavItem renders (`<a class="st-nav__item">`) is identical to the old leaf's,
      -- so the nav looks unchanged. Blank-label links rendered nothing before, so
      -- they're dropped rather than carried as empty NavItems.
      FOR link IN SELECT * FROM jsonb_array_elements(links) LOOP
        IF COALESCE(link->>'label', '') <> '' THEN
          converted := converted || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
            'id', 'navitem-' || replace(gen_random_uuid()::text, '-', ''),
            'type', 'NavItem',
            'props', jsonb_strip_nulls(jsonb_build_object(
              'label', link->>'label',
              'href', COALESCE(link->>'href', '#'),
              'openInNewTab', CASE WHEN (link->>'openInNewTab')::boolean THEN true ELSE NULL END
            ))
          )));
        END IF;
      END LOOP;

      -- Prepend the converted NavItems to any existing children (a legacy leaf has
      -- none; the COALESCE keeps a hand-authored container's children safe).
      node := jsonb_set(
        node,
        '{children}',
        CASE WHEN jsonb_typeof(node->'children') = 'array'
             THEN converted || node->'children'
             ELSE converted END,
        true
      );
      -- Drop the legacy leaf prop → the container renders children + re-run is a no-op.
      node := node #- '{props,links}';
    END IF;
  END IF;

  IF jsonb_typeof(node->'children') = 'array' THEN
    FOR child IN SELECT * FROM jsonb_array_elements(node->'children') LOOP
      new_children := new_children || jsonb_build_array(pg_temp.navmenu_container_convert(child));
    END LOOP;
    node := jsonb_set(node, '{children}', new_children, true);
  END IF;

  RETURN node;
END;
$func$;

DO $do$
DECLARE
  t record;
  rec record;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);

    -- NavMenu is site chrome (authored in layouts), but convert pages too in case a
    -- stray/imported tree carries one, so nothing is left rendering via the
    -- transitional back-compat branch.
    FOR rec IN SELECT id FROM builder_layouts LOOP
      UPDATE builder_layouts
         SET draft_tree = pg_temp.navmenu_container_convert(draft_tree),
             published_tree = CASE
               WHEN published_tree IS NOT NULL
               THEN pg_temp.navmenu_container_convert(published_tree)
               ELSE published_tree END
       WHERE id = rec.id;
    END LOOP;

    FOR rec IN SELECT id FROM builder_pages LOOP
      UPDATE builder_pages
         SET draft_tree = pg_temp.navmenu_container_convert(draft_tree),
             published_tree = CASE
               WHEN published_tree IS NOT NULL
               THEN pg_temp.navmenu_container_convert(published_tree)
               ELSE published_tree END
       WHERE id = rec.id;
    END LOOP;
  END LOOP;
END;
$do$;
