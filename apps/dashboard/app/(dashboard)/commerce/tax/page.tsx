import { FileBadge, Globe2, Plus, Receipt } from 'lucide-react';

import { Badge, Card, CardBody, EmptyState } from '@wizeworks/silicaui-react';

import { ListPageShell, PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { getUserPreferences } from '../../_shell/preferences';
import { TaxZonesList, type TaxZoneRow } from './_components/tax-zones-list';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TaxPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);

  const [prefs, zonesPage] = await Promise.all([
    getUserPreferences(),
    api.getPaged<TaxZoneRow[]>(
      `/v1/commerce/tax/zones?${new URLSearchParams({
        take: String(take),
        skip: String(skip),
      }).toString()}`
    ),
  ]);

  const zones = zonesPage.data;
  const total = (zonesPage.meta?.total as number | undefined) ?? zones.length;
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  // Special case: the toolbar's shared "Nexus zones" heading precedes the
  // ListToolbar in the original layout (it labels the whole zones section, not
  // just the toolbar), so it's kept pinned alongside the toolbar rather than
  // moved below it. The single ListPager stays inline in `children` (not the
  // dedicated `pager` slot) because it's followed by the unrelated, unpaginated
  // "Exemption certificates" card — pinning it to the shell's bottom edge would
  // strand that card above a sticky pager that isn't its own.
  return (
    <ListPageShell
      header={
        <PageHeader
          icon={<Receipt className="h-5 w-5" />}
          title="Tax"
          badge={
            <Badge color="module">
              {total} zone{total === 1 ? '' : 's'}
            </Badge>
          }
          description="Register a tax zone for every jurisdiction where the merchant has nexus. Manual rates below run when no TaxProvider (Stripe Tax, TaxJar, Avalara) is installed; the provider wins as soon as one is connected from Commerce → Providers. B2B exemption certificates attach per customer or per B2B account."
          className="mb-0"
        />
      }
      toolbar={
        <>
          <div className="flex flex-col gap-1">
            <div className="flex flex-row items-center gap-2">
              <Globe2 className="h-4 w-4" />
              <h3 className="text-xl font-semibold">Nexus zones</h3>
            </div>
            <p className="text-base-content text-sm">
              Country-wide or region-narrowed (US-CA, US-OR…). Click a zone to add rates.
            </p>
          </div>

          <ListToolbar
            enableViewToggle
            searchable={false}
            primaryAction={
              <EntityCreateButton
                entityType="tax-zone"
                newHref="/commerce/tax/zones/new"
                color="module"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
              >
                New tax zone
              </EntityCreateButton>
            }
          />
        </>
      }
    >
      {zones.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Globe2 className="h-5 w-5" />}
            title="No tax zones yet"
            description="Add a zone for every jurisdiction with nexus."
            actions={
              <EntityCreateButton
                entityType="tax-zone"
                newHref="/commerce/tax/zones/new"
                color="module"
              >
                New tax zone
              </EntityCreateButton>
            }
          />
        </Card>
      ) : (
        <TaxZonesList zones={zones} view={view} />
      )}

      <ListPager total={total} />

      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <div className="flex flex-row items-center gap-2">
              <FileBadge className="h-4 w-4" />
              <h3 className="text-xl font-semibold">Exemption certificates</h3>
            </div>
            <p className="opacity-70">
              Customer- or B2B-account-scoped exemptions are attached from the CRM customer detail
              page; the checkout pipeline reads them automatically.
            </p>
          </div>
          <p className="text-base-content text-sm">
            Open a customer (CRM → Customers) or a B2B account (CRM → B2B accounts) and use the Tax
            exemptions panel to upload certificates.
          </p>
        </CardBody>
      </Card>
    </ListPageShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
