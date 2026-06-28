import { Boxes } from 'lucide-react';

import { Badge, Container, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import type { FitmentDictionarySummary, FitmentDomainRow } from '../fitment-actions';
import { FitmentManager } from './_components/fitment-manager';

// Fitment dictionaries — the "what your products are compatible with"
// surface. Generalized across domains: a vehicle shop installs Vehicle
// (Make → Model → Engine + Year), a pet store installs Pet (Species → Breed +
// Weight), an apparel store installs Apparel sizes. There is NO platform-global
// default — every domain is tenant-scoped, installed from the dictionary
// library or built from scratch.
//
// Per-product fitment assignment lives on the product detail page's Fitment
// tab — this page manages the compatibility dictionary itself.

export const dynamic = 'force-dynamic';

export default async function FitmentReferencePage() {
  const [domains, dictionaries] = await Promise.all([
    api.get<FitmentDomainRow[]>('/v1/commerce/fitment/domains'),
    api.get<FitmentDictionarySummary[]>('/v1/commerce/fitment/dictionaries'),
  ]);

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Boxes className="h-5 w-5" />}
          title="Fitment dictionaries"
          badge={
            <Badge color="module">
              {domains.length} domain{domains.length === 1 ? '' : 's'}
            </Badge>
          }
          description={
            <>
              The compatibility dictionaries your products fit — Make/Model/Engine + Year for a
              vehicle shop, Species/Breed + Weight for a pet store, Size for apparel. Install one
              from the library or build your own; each is yours alone to edit, nothing is shared
              across tenants.
            </>
          }
        />

        <FitmentManager domains={domains} dictionaries={dictionaries} />
      </Stack>
    </Container>
  );
}
