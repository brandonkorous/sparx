-- docs/57 — Navigation into the Builder: convert existing CMS-menu-bound NavMenu
-- nodes in Builder layout/page trees into node-owned `props.links`, so navigation
-- is fully Builder-owned and the storefront no longer needs the transitional CMS
-- fallback (loadSiteData's site.primaryNav/footerNav resolution).
--
-- Mirrors the storefront's exact nav resolution (services/api-rest .../public/
-- content.ts buildNavTree + apps/site navToItems): TOP-LEVEL menu items only,
-- href = external_url, else `/<slug>` for a PUBLISHED, non-deleted linked entry,
-- else the item is dropped (no dead links). open_in_new_tab → openInNewTab.
--
-- DATA migration over jsonb trees, so it loops tenants + set_config('app.tenant_id')
-- to read the FORCE-RLS navigation_menus / navigation_items / content_entries and
-- write the FORCE-RLS builder tables (sparx_owner is non-superuser in prod).

-- Recursive walker: for every NavMenu node carrying a site.primaryNav/footerNav
-- binding, set props.links from the matching menu array and drop the binding.
-- Every other node passes through unchanged; children recurse.
CREATE OR REPLACE FUNCTION pg_temp.nav57_convert(node jsonb, header jsonb, footer jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $func$
DECLARE
  child jsonb;
  new_children jsonb := '[]'::jsonb;
  bind_path text;
BEGIN
  IF node->>'type' = 'NavMenu' THEN
    bind_path := node #>> '{binding,path}';
    IF bind_path = 'site.primaryNav' OR bind_path = 'site.footerNav' THEN
      IF node->'props' IS NULL OR jsonb_typeof(node->'props') <> 'object' THEN
        node := jsonb_set(node, '{props}', '{}'::jsonb, true);
      END IF;
      node := jsonb_set(
        node,
        '{props,links}',
        CASE WHEN bind_path = 'site.primaryNav' THEN header ELSE footer END,
        true
      );
      node := node #- '{binding}';
    END IF;
  END IF;

  IF jsonb_typeof(node->'children') = 'array' THEN
    FOR child IN SELECT * FROM jsonb_array_elements(node->'children') LOOP
      new_children := new_children || jsonb_build_array(pg_temp.nav57_convert(child, header, footer));
    END LOOP;
    node := jsonb_set(node, '{children}', new_children, true);
  END IF;

  RETURN node;
END;
$func$;

-- Build a menu's top-level NavLink[] for one location, mirroring the storefront.
CREATE OR REPLACE FUNCTION pg_temp.nav57_links(loc text)
RETURNS jsonb LANGUAGE sql AS $links$
  SELECT COALESCE(jsonb_agg(x.link ORDER BY x.position), '[]'::jsonb)
  FROM (
    SELECT
      ni.position,
      jsonb_build_object(
        'label', ni.label,
        'href', CASE WHEN ni.external_url IS NOT NULL THEN ni.external_url ELSE '/' || ce.slug END,
        'openInNewTab', ni.open_in_new_tab
      ) AS link
    FROM navigation_menus nm
    JOIN navigation_items ni ON ni.menu_id = nm.id AND ni.parent_item_id IS NULL
    LEFT JOIN content_entries ce ON ce.id = ni.entry_id
    WHERE nm.location = loc
      AND (
        ni.external_url IS NOT NULL
        OR (ce.id IS NOT NULL AND ce.status = 'published' AND ce.deleted_at IS NULL)
      )
  ) x;
$links$;

DO $do$
DECLARE
  t record;
  rec record;
  header jsonb;
  footer jsonb;
BEGIN
  FOR t IN SELECT id FROM tenants LOOP
    PERFORM set_config('app.tenant_id', t.id::text, true);

    header := pg_temp.nav57_links('header');
    footer := pg_temp.nav57_links('footer');

    -- NavMenu is site chrome (only authorable in layouts), but convert pages too
    -- in case a stray/imported tree carries one, so removing the fallback can
    -- never leave a bound NavMenu rendering empty.
    FOR rec IN SELECT id, draft_tree, published_tree FROM builder_layouts LOOP
      UPDATE builder_layouts
         SET draft_tree = pg_temp.nav57_convert(draft_tree, header, footer),
             published_tree = CASE
               WHEN published_tree IS NOT NULL
               THEN pg_temp.nav57_convert(published_tree, header, footer)
               ELSE published_tree END
       WHERE id = rec.id;
    END LOOP;

    FOR rec IN SELECT id, draft_tree, published_tree FROM builder_pages LOOP
      UPDATE builder_pages
         SET draft_tree = pg_temp.nav57_convert(draft_tree, header, footer),
             published_tree = CASE
               WHEN published_tree IS NOT NULL
               THEN pg_temp.nav57_convert(published_tree, header, footer)
               ELSE published_tree END
       WHERE id = rec.id;
    END LOOP;
  END LOOP;
END;
$do$;
