import { Receipt } from 'lucide-react';

import { ListPageShell, PageHeader } from '@sparx/ui';
import { Badge, Card, CardBody, EmptyState } from '@wizeworks/silicaui-react';

import { api } from '@/lib/api-rest-client';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { parsePageParams } from '@/lib/pagination';
import { getUserPreferences } from '../../_shell/preferences';
import { ArAgingSummary, type AgingReport } from './_components/ar-aging-summary';
import { InvoicesList, type InvoiceRow } from './_components/invoices-list';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const STATUS_OPTIONS = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partially paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
  { value: 'void', label: 'Voided' },
];

const OPEN_STATUSES = ['unpaid', 'partial', 'overdue'];

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export default async function B2bInvoicesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const status = stringParam(params.status);
  const accountId = stringParam(params.account_id);

  const query = new URLSearchParams({ take: String(take), skip: String(skip) });
  if (status) query.set('status', status);
  if (accountId) query.set('account_id', accountId);

  // Pull the canonical AR aging report (owned by invoicing, scoped to B2B) into
  // this view alongside the invoice list. It sums ALL open B2B AR server-side —
  // not just the loaded page — so the buckets are accurate. Supplementary, so a
  // failure never breaks the list.
  const [prefs, { data: invoices, meta }, aging] = await Promise.all([
    getUserPreferences(),
    api.getPaged<InvoiceRow[]>(`/v1/b2b/invoices?${query.toString()}`),
    api.get<AgingReport>('/v1/invoicing/aging?scope=b2b').catch(() => null),
  ]);
  const total = (meta?.total as number | undefined) ?? invoices.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  const overdueCount = invoices.filter((i) => i.status === 'overdue').length;
  const totalOwed = invoices
    .filter((i) => OPEN_STATUSES.includes(i.status))
    .reduce((sum, i) => sum + i.balanceCents, 0);

  return (
    <ListPageShell
      header={
        <PageHeader
          icon={<Receipt className="h-5 w-5" />}
          title="Invoices"
          badge={
            <Badge color="module">
              {total} invoice{total === 1 ? '' : 's'}
            </Badge>
          }
          description={`Net-terms invoices across all B2B accounts. ${overdueCount > 0 ? `${overdueCount} overdue.` : 'All current.'}`}
          actions={
            overdueCount > 0 ? (
              <Badge color="danger" variant="soft">
                {overdueCount} overdue — {formatCents(totalOwed)} outstanding
              </Badge>
            ) : (
              <p className="text-base-content text-sm">{formatCents(totalOwed)} outstanding</p>
            )
          }
          className="mb-0"
        />
      }
      toolbar={
        <>
          {aging ? <ArAgingSummary aging={aging} /> : null}
          <ListToolbar
            searchPlaceholder="Search by invoice # or account…"
            filters={[{ key: 'status', label: 'Status', options: STATUS_OPTIONS }]}
            enableViewToggle
          />
        </>
      }
      pager={<ListPager total={total} />}
    >
      {invoices.length === 0 ? (
        <Card>
          <CardBody className="p-0">
            <EmptyState
              icon={<Receipt className="h-5 w-5" />}
              title="No invoices yet"
              description="Net-terms orders automatically generate invoices. Manual invoices can also be created from an account's detail page."
            />
          </CardBody>
        </Card>
      ) : (
        <InvoicesList invoices={invoices} view={view} />
      )}
    </ListPageShell>
  );
}
