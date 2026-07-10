import { FileText, Plus } from 'lucide-react';

import { ListPageShell, PageHeader } from '@sparx/ui';
import { Badge, Card, CardBody, EmptyState } from '@wizeworks/silicaui-react';

import { api } from '@/lib/api-rest-client';
import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { parsePageParams } from '@/lib/pagination';
import { getUserPreferences } from '../../_shell/preferences';
import { QuotesList, type QuoteRow } from './_components/quotes-list';

// A B2B quote/RFQ IS a BillingDocument on the system `b2b-quotes` workflow
// (docs/87 convergence). This is a thin scoped list — creating, pricing lines,
// and advancing the lifecycle all happen on the Invoicing document surface;
// rows deep-link there instead of to a separate B2B quote detail page.

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const STAGE_OPTIONS = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Submitted', label: 'Submitted' },
  { value: 'Under Review', label: 'Under review' },
  { value: 'Quoted', label: 'Quoted' },
  { value: 'Accepted', label: 'Accepted' },
  { value: 'Declined', label: 'Declined' },
  { value: 'Expired', label: 'Expired' },
];

const PENDING_RESPONSE_STAGES = new Set(['Submitted', 'Under Review']);

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function B2bQuotesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const stage = stringParam(params.stage);
  const accountId = stringParam(params.account_id);

  const query = new URLSearchParams({ take: String(take), skip: String(skip) });
  if (stage) query.set('stage', stage);
  if (accountId) query.set('account_id', accountId);

  const [prefs, { data: quotes, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<QuoteRow[]>(`/v1/b2b/quotes?${query.toString()}`),
  ]);
  const total = (meta?.total as number | undefined) ?? quotes.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  const pendingResponse = quotes.filter((q) => PENDING_RESPONSE_STAGES.has(q.stage.name));

  return (
    <ListPageShell
      header={
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
          className="mb-0"
        />
      }
      toolbar={
        <ListToolbar
          searchPlaceholder="Search by quote # or account…"
          filters={[{ key: 'stage', label: 'Stage', options: STAGE_OPTIONS }]}
          enableViewToggle
          primaryAction={
            <EntityCreateButton
              entityType="billing-document"
              newHref="/invoicing/documents/new?workflow=b2b-quotes"
              color="module"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New quote
            </EntityCreateButton>
          }
        />
      }
      pager={<ListPager total={total} />}
    >
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
    </ListPageShell>
  );
}
