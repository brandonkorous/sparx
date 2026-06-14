import { MessageSquare, Star } from 'lucide-react';

import { Badge, Card, Container, EmptyState, PageHeader, Stack, Text } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { ListToolbar } from '../../_components/list-toolbar';
import { getUserPreferences } from '../../_shell/preferences';
import { ReviewsList, type ReviewListRow } from './_components/reviews-list';

export const dynamic = 'force-dynamic';

type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'flagged';

// Empty filter value = the moderation queue (the default landing).
const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'flagged', label: 'Flagged' },
];

type Filter = { kind: 'queue' } | { kind: 'all' } | { kind: 'status'; status: ReviewStatus };

function parseFilter(raw: string | undefined): Filter {
  if (raw === undefined || raw === 'queue') return { kind: 'queue' };
  if (raw === 'all') return { kind: 'all' };
  if (raw === 'pending' || raw === 'approved' || raw === 'rejected' || raw === 'flagged') {
    return { kind: 'status', status: raw };
  }
  return { kind: 'queue' };
}

function labelFor(f: Filter): string {
  if (f.kind === 'queue') return 'Moderation queue';
  if (f.kind === 'all') return 'All reviews';
  return f.status.charAt(0).toUpperCase() + f.status.slice(1);
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; productId?: string; view?: string }>;
}) {
  const { status: statusParam, productId, view: viewParam } = await searchParams;
  const filter = parseFilter(statusParam);

  const [prefs, rows] = await Promise.all([getUserPreferences(), fetchRows(filter, productId)]);

  const view = (viewParam ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Star className="h-5 w-5" />}
          title="Reviews"
          badge={<Badge color="module">{rows.length} shown</Badge>}
          description={
            <>
              Verified-purchase reviews auto-approve. Anonymous + non-verified land here for
              moderation. Approving fires <code>review.published</code> so the storefront cache
              invalidates.
            </>
          }
        />

        <ListToolbar
          searchable={false}
          filters={[{ key: 'status', label: 'Statuses', options: STATUS_OPTIONS }]}
          enableViewToggle
        />

        {rows.length === 0 ? (
          <Card variant="module" padding="none">
            <EmptyState
              icon={<MessageSquare className="h-5 w-5" />}
              title="Nothing here"
              description="Reviews land here as customers submit them on storefront PDPs."
            />
          </Card>
        ) : (
          <>
            <Text size="sm" variant="muted">
              {labelFor(filter)} — click a review to read the full body + media, respond as the
              merchant, or moderate.
            </Text>
            <ReviewsList rows={rows} view={view} />
          </>
        )}
      </Stack>
    </Container>
  );
}

async function fetchRows(filter: Filter, productId?: string): Promise<ReviewListRow[]> {
  if (filter.kind === 'queue') {
    return api.get<ReviewListRow[]>('/v1/commerce/reviews/pending');
  }
  if (productId) {
    const params = new URLSearchParams({ take: '250' });
    if (filter.kind === 'status') params.set('status', filter.status);
    return api.get<ReviewListRow[]>(
      `/v1/commerce/products/${productId}/reviews?${params.toString()}`
    );
  }
  const params = new URLSearchParams({ take: '250' });
  if (filter.kind === 'status') params.set('status', filter.status);
  return api.get<ReviewListRow[]>(`/v1/commerce/reviews?${params.toString()}`);
}
