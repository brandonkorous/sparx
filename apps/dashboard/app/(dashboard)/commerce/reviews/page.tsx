import { MessageSquare, Star } from 'lucide-react';

import { Badge, Card, Container, EmptyState, PageHeader, Stack, Text } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { parsePageParams } from '@/lib/pagination';
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
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const statusParam = stringParam(params.status);
  const productId = stringParam(params.productId);
  const viewParam = stringParam(params.view);
  const filter = parseFilter(statusParam);
  const pageWindow = parsePageParams(params);

  const [prefs, { rows, total, paged }] = await Promise.all([
    getUserPreferences(),
    fetchRows(filter, productId, pageWindow),
  ]);

  const view = (viewParam ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<Star className="h-5 w-5" />}
          title="Reviews"
          badge={<Badge color="module">{total} shown</Badge>}
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

        {paged ? <ListPager total={total} /> : null}
      </Stack>
    </Container>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}

interface FetchedReviews {
  rows: ReviewListRow[];
  total: number;
  // The tenant-wide list is the only offset-paged branch; the moderation
  // queue + product-scoped views are special-purpose (capped / per-product)
  // and don't carry a page window.
  paged: boolean;
}

async function fetchRows(
  filter: Filter,
  productId: string | undefined,
  window: { skip: number; take: number }
): Promise<FetchedReviews> {
  if (filter.kind === 'queue') {
    const rows = await api.get<ReviewListRow[]>('/v1/commerce/reviews/pending');
    return { rows, total: rows.length, paged: false };
  }
  if (productId) {
    const params = new URLSearchParams({ take: '250' });
    if (filter.kind === 'status') params.set('status', filter.status);
    const { items } = await api.get<{ items: ReviewListRow[]; total: number }>(
      `/v1/commerce/products/${productId}/reviews?${params.toString()}`
    );
    return { rows: items, total: items.length, paged: false };
  }
  const params = new URLSearchParams({
    take: String(window.take),
    skip: String(window.skip),
  });
  if (filter.kind === 'status') params.set('status', filter.status);
  const { data, meta } = await api.getPaged<ReviewListRow[]>(
    `/v1/commerce/reviews?${params.toString()}`
  );
  return { rows: data, total: (meta?.total as number | undefined) ?? data.length, paged: true };
}
