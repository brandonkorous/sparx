import { Container, PageHeader, Stack } from '@sparx/ui';
import { api } from '@/lib/api-rest-client';
import {
  listProperties,
  listDomains,
  getActivePropertyId,
  type Property,
  type Domain,
} from '@/lib/sites';
import { SitesManager } from './sites-manager';
import type { SiteBlueprintOption } from './new-site-wizard';

// Settings → Sites: the multi-site (web PROPERTY) management hub (docs/49). One
// tenant, many sites over a shared back office. Here you create sites (via the
// New-site wizard, Phase 8b), switch which one the Builder authors, set the
// primary, and connect custom domains. Reads go through api-rest (the dashboard
// never touches the DB); all mutations are server actions in ./actions.ts.

export const metadata = { title: 'Sites · Settings' };

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

export default async function SitesSettingsPage() {
  // Defensive: a failed read yields empties so the page still renders the create
  // affordance rather than 500-ing.
  const [properties, domains, activeId, catalog, tenant] = await Promise.all([
    listProperties().catch(() => [] as Property[]),
    listDomains().catch(() => [] as Domain[]),
    getActivePropertyId(),
    api
      .get<{ blueprints: CatalogBlueprint[] }>('/v1/blueprints')
      .then((r) => r.blueprints)
      .catch(() => [] as CatalogBlueprint[]),
    api.get<{ slug: string }>('/v1/tenant').catch(() => ({ slug: 'your-store' })),
  ]);

  return (
    <Container size="lg">
      <Stack gap={6} className="py-10">
        <PageHeader
          title="Sites"
          description="Each site is a distinct web property — its own pages, layout, and domains — over your shared back office."
        />
        <SitesManager
          properties={properties}
          domains={domains}
          activePropertyId={activeId}
          blueprints={catalog.map(toOption)}
          zoneSuffix={`${tenant.slug}.sparx.zone`}
        />
      </Stack>
    </Container>
  );
}
