import { Globe } from 'lucide-react';
import { PageHeader } from '@sparx/ui';
import { Badge, EmptyState } from 'silicaui-react';
import { listProperties, listDomains, type Domain, type Property } from '@/lib/sites';
import { getUserPreferences } from '../../_shell/preferences';
import { ListToolbar } from '../../_components/list-toolbar';
import { DomainsInventory } from './_components/domains-inventory';
import { DomainSearch } from './_components/domain-search';

// Settings → Domains: the tenant's domain inventory + search/buy. The inventory
// is on the sitewide list substrate ([[list-substrate]]) — `SelectionList`
// table/cards honoring `defaultListView`, per-domain registrar actions in a row
// menu. Connected custom domains are also managed per-site under Settings → Sites.

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Domains · Settings' };

function str(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? '';
  return typeof v === 'string' ? v : '';
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DomainsSettingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const [prefs, properties, domains] = await Promise.all([
    getUserPreferences(),
    listProperties().catch(() => [] as Property[]),
    listDomains().catch(() => [] as Domain[]),
  ]);

  // Domain-checkout gate (mirrors api-rest's DOMAIN_PURCHASE_ENABLED, the security
  // boundary). Off → buying a new domain shows "checkout opens soon"; searching,
  // connecting an owned domain, and managing existing domains stay fully live.
  const purchaseEnabled = process.env.DOMAIN_PURCHASE_ENABLED === 'true';
  const view = (str(params.view) || prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <div className="mx-auto w-full max-w-screen-lg px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<Globe className="h-5 w-5" />}
          title="Domains"
          badge={
            <Badge color="neutral">
              {domains.length} domain{domains.length === 1 ? '' : 's'}
            </Badge>
          }
          description="Purchase new domains, track renewals, and manage WHOIS privacy and DNS settings. Connected domains are also managed per-site under Sites."
        />

        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">Your domains</h2>
          <ListToolbar enableViewToggle searchable={false} />
          {domains.length === 0 ? (
            <EmptyState
              icon={<Globe className="h-5 w-5" />}
              title="No domains yet"
              description="Purchase a new domain below, or connect one you already own from Settings → Sites."
            />
          ) : (
            <DomainsInventory domains={domains} properties={properties} view={view} />
          )}
        </div>

        <DomainSearch properties={properties} purchaseEnabled={purchaseEnabled} />
      </div>
    </div>
  );
}
