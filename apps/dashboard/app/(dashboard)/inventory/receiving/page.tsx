import { PackageCheck, ClipboardList } from 'lucide-react';

import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';
import { ListPageShell, PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';

import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { getUserPreferences } from '../../_shell/preferences';
import type { PurchaseOrderRow } from '../purchase-orders/_components/types';
import { AwaitingReceiptList } from './_components/awaiting-receipt-list';
import { ReceiptsList } from './_components/receipts-list';
import type { GoodsReceiptRow } from './_components/types';

// Receiving (docs/100 P3c) — the inbound work surface: purchase orders awaiting
// goods + a feed of recent receipts. "Receive" books stock against a PO, writing
// `receive` movements and advancing the order to partial/received.
//
// Two groups, same shape as `/crm/tasks`: "Awaiting receipt" is a bounded work
// queue (submitted/partial POs, merged from two status fetches — search runs
// server-side on each), "Recent receipts" is the one genuinely paginated group
// (an append-only feed), each rendered through the shared `SelectionList`
// dual-view substrate instead of the old hand-rolled Card + flex-row list.

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ReceivingPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const q = stringParam(params.q);

  const awaitingQs = new URLSearchParams({ take: '100' });
  if (q) awaitingQs.set('search', q);

  const recentQs = new URLSearchParams({ take: String(take), skip: String(skip) });
  if (q) recentQs.set('q', q);

  const [prefs, submitted, partial, recent] = await Promise.all([
    getUserPreferences(),
    api.getPaged<PurchaseOrderRow[]>(
      `/v1/inventory/purchase-orders?status=submitted&${awaitingQs.toString()}`
    ),
    api.getPaged<PurchaseOrderRow[]>(
      `/v1/inventory/purchase-orders?status=partial&${awaitingQs.toString()}`
    ),
    api.getPaged<GoodsReceiptRow[]>(`/v1/inventory/receipts?${recentQs.toString()}`),
  ]);

  const awaiting = [...submitted.data, ...partial.data].sort(byExpected);
  const receipts = recent.data;
  const recentTotal = (recent.meta?.total as number | undefined) ?? receipts.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      header={
        <PageHeader
          className="mb-0"
          icon={<PackageCheck className="h-5 w-5" />}
          title="Receiving"
          description="Book goods against your purchase orders. Receiving raises stock through the ledger (moving-average cost) and advances each order to partial or received."
        />
      }
      toolbar={
        <ListToolbar
          searchPlaceholder="Search PO number, receipt number, supplier, or warehouse…"
          enableViewToggle
        />
      }
      // Paginates the "Recent receipts" group only — "Awaiting receipt" is a
      // bounded work queue, same convention as /crm/tasks.
      pager={<ListPager total={recentTotal} />}
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <div className="flex flex-row items-center gap-2">
            <h3 className="text-lg font-semibold">Awaiting receipt</h3>
            <Badge color="module">{awaiting.length}</Badge>
          </div>
          {awaiting.length === 0 ? (
            <Card>
              <EmptyState
                icon={<PackageCheck className="h-5 w-5" />}
                title={q ? 'No purchase orders match this search' : 'Nothing awaiting receipt'}
                description={
                  q
                    ? 'Try a different PO number or supplier name.'
                    : 'Submit a purchase order to start receiving against it.'
                }
              />
            </Card>
          ) : (
            <AwaitingReceiptList purchaseOrders={awaiting} view={view} />
          )}
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold">Recent receipts</h3>
          {receipts.length === 0 ? (
            <Card>
              <EmptyState
                icon={<ClipboardList className="h-5 w-5" />}
                title={q ? 'No receipts match this search' : 'No goods received yet'}
                description={
                  q ? 'Try a different receipt number, PO number, or warehouse name.' : undefined
                }
              />
            </Card>
          ) : (
            <ReceiptsList receipts={receipts} view={view} />
          )}
        </div>
      </div>
    </ListPageShell>
  );
}

function byExpected(a: PurchaseOrderRow, b: PurchaseOrderRow): number {
  const av = a.expectedArrivalAt ? Date.parse(a.expectedArrivalAt) : Number.POSITIVE_INFINITY;
  const bv = b.expectedArrivalAt ? Date.parse(b.expectedArrivalAt) : Number.POSITIVE_INFINITY;
  return av - bv;
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
