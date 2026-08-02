// First-party blueprint capture (docs/118 Phase 3) — the staff authoring path that
// turns a site built in the studio editor into the `site` half of a marketplace
// blueprint. Run locally against docker Postgres, pointed at the authoring tenant
// where the canonical site was composed:
//
//   pnpm --filter @sparx/api-rest blueprint:capture -- \
//     --tenant <tenantId> [--property <propertyId>] \
//     [--source draft|published] [--omit-theme] [--out path/to/site.json]
//
// It prints (or writes) the captured `SiteDecl` as JSON. That JSON is the hard,
// error-prone part of a bundle — the silica node trees — produced as DATA rather
// than hand-written; the author drops it into `marketplace-catalog/blueprints/<slug>/`
// (a `blueprint.ts` may `import site from './site.json'`, the loader supports relative
// import graphs) and completes the non-site fields (brand/commerce/content/emails)
// before `marketplace:self-register`. `--omit-theme` leaves the theme out so one captured
// base re-skins per installing tenant — the one-base-across-many-themes model.
//
// Staff/first-party only: it reads a tenant's authored site directly through the
// service layer. The tenant/partner self-service capture flow is a separate future
// surface (docs/85 Phase 2), not this script.

import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { captureBlueprintSite } from '../lib/blueprint-capture.js';
import { resolvePrimaryPropertyId } from '../lib/property.js';

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      tenant: { type: 'string' },
      property: { type: 'string' },
      source: { type: 'string', default: 'draft' },
      'omit-theme': { type: 'boolean', default: false },
      out: { type: 'string' },
    },
  });

  const tenantId = values.tenant;
  if (!tenantId) {
    throw new Error('Missing --tenant <tenantId>. Point capture at the authoring tenant.');
  }
  const source = values.source;
  if (source !== 'draft' && source !== 'published') {
    throw new Error(`--source must be "draft" or "published" (got "${source ?? ''}").`);
  }

  const propertyId = values.property ?? (await resolvePrimaryPropertyId(tenantId));
  console.error(
    `[blueprint-capture] capturing ${source} site of property ${propertyId} (tenant ${tenantId})…`
  );

  const site = await captureBlueprintSite(
    { tenantId, userId: null, propertyId },
    { source, omitTheme: values['omit-theme'] }
  );
  if (!site) {
    throw new Error(
      `No ${source} silica site is materialized for property ${propertyId}. Build (and, for --source published, publish) the site first.`
    );
  }

  const json = `${JSON.stringify(site, null, 2)}\n`;
  if (values.out) {
    await writeFile(values.out, json, 'utf8');
    console.error(
      `[blueprint-capture] wrote ${site.pages.length} page(s) → ${values.out}` +
        (site.theme ? ' (with theme)' : ' (theme omitted)')
    );
  } else {
    // Data on stdout, progress on stderr — so `> site.json` captures only the JSON.
    process.stdout.write(json);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('[blueprint-capture] failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
