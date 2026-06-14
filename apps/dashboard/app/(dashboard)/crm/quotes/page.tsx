import { FileText, Plus } from 'lucide-react';

import { Badge, Card, Container, EmptyState, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { parsePageParams } from '@/lib/pagination';
import { getUserPreferences } from '../../_shell/preferences';
import { QuotesList } from './_components/quotes-list';
import type { QuoteRow } from './_components/quotes-list';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' },
  { value: 'converted', label: 'Converted' },
];

export default async function QuotesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const status = stringParam(params.status);
  const q = stringParam(params.q);

  const query = new URLSearchParams({
    take: String(take),
    skip: String(skip),
    sort_by: 'createdAt',
  });
  if (status) query.set('status', status);
  if (q) query.set('q', q);

  const [prefs, { data: quotes, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<QuoteRow[]>(`/v1/crm/quotes?${query.toString()}`),
  ]);
  const total = (meta?.total as number | undefined) ?? quotes.length;

  // `?view=` overrides; absent → the user's saved default (§7.2).
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<FileText className="h-5 w-5" />}
          title="Quotes"
          badge={
            <Badge color="module">
              {total} quote{total === 1 ? '' : 's'}
            </Badge>
          }
          description="Sales quotes — draft, submitted, accepted, declined, expired, converted to an order. Accepted quotes convert atomically to a new Order via the quote detail page."
          actions={
            <EntityCreateButton
              entityType="quote"
              newHref="/crm/quotes/new"
              color="module"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New
            </EntityCreateButton>
          }
        />

        <ListToolbar
          searchable={false}
          filters={[{ key: 'status', label: 'Statuses', options: STATUS_OPTIONS }]}
          enableViewToggle
        />

        {quotes.length === 0 ? (
          <Card padding="none">
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title="No quotes match"
              description="Quotes appear here once created. Start one from a deal or directly here."
            />
          </Card>
        ) : (
          <QuotesList quotes={quotes} view={view} />
        )}

        <ListPager total={total} />
      </Stack>
    </Container>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}
