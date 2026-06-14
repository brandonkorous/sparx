import { Plus, Tag } from 'lucide-react';

import { Badge, Card, Container, EmptyState, PageHeader, Stack, Text } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { parsePageParams } from '@/lib/pagination';
import { getUserPreferences } from '../../_shell/preferences';
import { DiscountsImportExport } from './_components/discounts-import-export';
import { DiscountsList, type DiscountRow } from './_components/discounts-list';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

export default async function DiscountsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const status = stringParam(params.status);
  const q = stringParam(params.q);

  const query = new URLSearchParams({ take: String(take), skip: String(skip) });
  if (status) query.set('status', status);
  if (q) query.set('q', q);

  const [prefs, { data: discounts, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<DiscountRow[]>(`/v1/commerce/discounts?${query.toString()}`),
  ]);
  const total = (meta?.total as number | undefined) ?? discounts.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Tag className="h-5 w-5" />}
          title="Discounts"
          badge={
            <Badge color="module">
              {total} discount{total === 1 ? '' : 's'}
            </Badge>
          }
          description="Codes activate when a shopper enters them; automatic discounts apply silently when their conditions match. Stacking rules govern combining with subscribe-and-save and loyalty."
          actions={
            <Stack direction="row" gap={2}>
              <DiscountsImportExport />
              <EntityCreateButton
                entityType="discount"
                newHref="/commerce/discounts/new"
                color="module"
                leftIcon={<Plus className="h-4 w-4" />}
              >
                New
              </EntityCreateButton>
            </Stack>
          }
        />

        <ListToolbar
          searchPlaceholder="Search code or name…"
          filters={[{ key: 'status', label: 'Statuses', options: STATUS_OPTIONS }]}
          enableViewToggle
        />

        {discounts.length === 0 ? (
          <Card variant="module" padding="none">
            <EmptyState
              icon={<Tag className="h-5 w-5" />}
              title="No discounts yet"
              description="Create a code (e.g. WELCOME10) for new-customer promos, or an automatic discount that applies when conditions are met."
              action={
                <EntityCreateButton
                  entityType="discount"
                  newHref="/commerce/discounts/new"
                  color="module"
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  New
                </EntityCreateButton>
              }
            />
          </Card>
        ) : (
          <>
            <Text size="sm" variant="muted">
              Higher-priority discounts evaluate first when multiple are eligible. Per-customer
              limits and total caps are enforced at redemption time.
            </Text>
            <DiscountsList discounts={discounts} view={view} />
          </>
        )}

        <ListPager total={total} />
      </Stack>
    </Container>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
