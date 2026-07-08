import { FileText } from 'lucide-react';

import { PageHeader } from '@sparx/ui';
import { Badge, Card, CardBody, EmptyState } from 'silicaui-react';

import { api } from '@/lib/api-rest-client';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { parsePageParams } from '@/lib/pagination';
import { getUserPreferences } from '../../_shell/preferences';
import { QuotesList, type QuoteRow } from './_components/quotes-list';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under review' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' },
];

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function B2bQuotesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const status = stringParam(params.status);
  const accountId = stringParam(params.account_id);

  const query = new URLSearchParams({ take: String(take), skip: String(skip) });
  if (status) query.set('status', status);
  if (accountId) query.set('account_id', accountId);

  const [prefs, { data: quotes, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<QuoteRow[]>(`/v1/b2b/quotes?${query.toString()}`),
  ]);
  const total = (meta?.total as number | undefined) ?? quotes.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  const pendingResponse = quotes.filter((q) => ['submitted', 'under_review'].includes(q.status));

  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<FileText className="h-5 w-5" />}
          title="Quotes / RFQ"
          badge={
            <Badge color="module">
              {total} quote{total === 1 ? '' : 's'}
            </Badge>
          }
          description="Manage B2B price requests. Submitted quotes need a merchant response before the customer can accept."
          actions={
            pendingResponse.length > 0 ? (
              <Badge color="warning" variant="soft">
                {pendingResponse.length} pending response
              </Badge>
            ) : undefined
          }
        />

        <ListToolbar
          searchPlaceholder="Search by quote # or account…"
          filters={[{ key: 'status', label: 'Status', options: STATUS_OPTIONS }]}
          enableViewToggle
        />

        {quotes.length === 0 ? (
          <Card>
            <CardBody className="p-0">
              <EmptyState
                icon={<FileText className="h-5 w-5" />}
                title="No quotes yet"
                description="B2B accounts can request quotes. They'll appear here for you to price and respond."
              />
            </CardBody>
          </Card>
        ) : (
          <QuotesList quotes={quotes} view={view} />
        )}

        <ListPager total={total} />
      </div>
    </div>
  );
}
