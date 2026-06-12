import { Container, PageHeader, Stack } from '@sparx/ui';
import { listProperties, listDomains, type Property, type Domain } from '@/lib/sites';
import { DomainsManager } from './domains-manager';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Domains · Settings' };

export default async function DomainsSettingsPage() {
  const [properties, domains] = await Promise.all([
    listProperties().catch(() => [] as Property[]),
    listDomains().catch(() => [] as Domain[]),
  ]);

  // Domain-checkout gate (mirrors api-rest's DOMAIN_PURCHASE_ENABLED, the security
  // boundary). Off → buying a new domain shows "checkout opens soon"; searching,
  // connecting an owned domain, and managing existing domains stay fully live.
  const purchaseEnabled = process.env.DOMAIN_PURCHASE_ENABLED === 'true';

  return (
    <Container size="lg">
      <Stack gap={6} className="py-10">
        <PageHeader
          title="Domains"
          description="Purchase new domains, track renewals, and manage WHOIS privacy and DNS settings."
        />
        <DomainsManager
          properties={properties}
          domains={domains}
          purchaseEnabled={purchaseEnabled}
        />
      </Stack>
    </Container>
  );
}
