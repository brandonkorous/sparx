import { Container, PageHeader, Stack } from '@sparx/ui';
import {
  listProperties,
  listDomains,
  getActivePropertyId,
  type Property,
  type Domain,
} from '@/lib/sites';
import { SitesManager } from './sites-manager';

// Settings → Sites: the multi-site (web PROPERTY) management hub (docs/49). One
// tenant, many sites over a shared back office. Here you create sites, switch
// which one the Builder authors, set the primary, and connect custom domains.
// Reads go through api-rest (the dashboard never touches the DB); all mutations
// are server actions in ./actions.ts.

export const metadata = { title: 'Sites · Settings' };

export default async function SitesSettingsPage() {
  // Defensive: a failed read yields empties so the page still renders the create
  // affordance rather than 500-ing.
  const [properties, domains, activeId] = await Promise.all([
    listProperties().catch(() => [] as Property[]),
    listDomains().catch(() => [] as Domain[]),
    getActivePropertyId(),
  ]);

  return (
    <Container size="lg">
      <Stack gap={6} className="py-10">
        <PageHeader
          title="Sites"
          description="Each site is a distinct web property — its own pages, layout, and domains — over your shared back office."
        />
        <SitesManager properties={properties} domains={domains} activePropertyId={activeId} />
      </Stack>
    </Container>
  );
}
