import 'server-only';
import { api } from '@/lib/api-rest-client';
import type { SiteBlueprintOption } from '../new-site-wizard';

// Server data for the New-site wizard, shared by BOTH presentations (docs/86):
// the full-page `/settings/sites/new` route and the drawer/modal create overlay
// (the `SiteCreateOverlay` wrapper in detail-slot). Loads the blueprint catalog +
// the tenant slug that anchors the instant `<handle>.<tenant>.sparx.zone` address.

// The catalog GET shape we consume (subset). `contents` is a loose record on the
// data-first marketplace row, so coerce defensively into the wizard's option.
interface CatalogBlueprint {
  key: string;
  name: string;
  summary?: string;
  vertical?: string;
  preview?: string;
  contents?: Record<string, unknown>;
}

function toOption(bp: CatalogBlueprint): SiteBlueprintOption {
  const c = bp.contents ?? {};
  const num = (v: unknown): number => (typeof v === 'number' ? v : 0);
  return {
    key: bp.key,
    name: bp.name,
    summary: bp.summary ?? '',
    vertical: bp.vertical ?? '',
    ...(bp.preview ? { preview: bp.preview } : {}),
    contents: {
      products: num(c.products),
      content: num(c.content),
      pages: num(c.pages),
      emails: num(c.emails),
      components: num(c.components),
      theme: typeof c.theme === 'string' ? c.theme : 'Default',
    },
  };
}

export interface NewSiteData {
  blueprints: SiteBlueprintOption[];
  zoneSuffix: string;
}

export async function loadNewSiteData(): Promise<NewSiteData> {
  const [catalog, tenant] = await Promise.all([
    api
      .getPaged<CatalogBlueprint[]>('/v1/blueprints?take=250')
      .then((r) => r.data)
      .catch(() => [] as CatalogBlueprint[]),
    api.get<{ slug: string }>('/v1/tenant').catch(() => ({ slug: 'your-store' })),
  ]);
  return { blueprints: catalog.map(toOption), zoneSuffix: `${tenant.slug}.sparx.zone` };
}
