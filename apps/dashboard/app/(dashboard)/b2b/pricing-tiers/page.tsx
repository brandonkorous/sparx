import { DollarSign } from 'lucide-react';

import { Badge, Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { getUserPreferences } from '../../_shell/preferences';
import { ListToolbar } from '../../_components/list-toolbar';
import { TierCreateButton } from './_components/tier-create-button';
import { PricingTiersList, type PricingTierRow } from './_components/pricing-tiers-list';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PricingTiersPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const [prefs, paged] = await Promise.all([
    getUserPreferences(),
    api.getPaged<PricingTierRow[]>('/v1/b2b/pricing-tiers'),
  ]);
  const tiers = paged.data;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <Container size="xl">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<DollarSign className="h-5 w-5" />}
          title="Pricing tiers"
          badge={
            <Badge color="module">
              {tiers.length} tier{tiers.length === 1 ? '' : 's'}
            </Badge>
          }
          description="Named discount structures applied to B2B accounts. Product-level overrides take precedence over tier discounts."
          actions={<TierCreateButton />}
        />

        <ListToolbar searchable={false} enableViewToggle />

        {tiers.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<DollarSign className="h-5 w-5" />}
              title="No pricing tiers yet"
              description="Create a pricing tier to apply automatic discounts to wholesale or fleet accounts."
              action={<TierCreateButton />}
            />
          </Card>
        ) : (
          <PricingTiersList rows={tiers} view={view} />
        )}
      </Stack>
    </Container>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
