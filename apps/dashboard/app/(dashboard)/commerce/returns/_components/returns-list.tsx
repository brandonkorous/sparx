'use client';

import { Badge } from '@wizeworks/silicaui-react';

import { SelectionList, type SelectionCard, type SelectionColumn, statusLabel } from '@sparx/ui';

import { EntityRowLink } from '../../../_components/entity-row-link';

// Client wrapper for the Returns list. SelectionList takes render functions
// (columns/card), which can't cross the server→client boundary, so the server
// page hands rows + view here and this builds the views. Read-only —
// `selectable={false}` (no checkboxes / bulk bar); rows open the inspection
// queue via EntityRowLink in the user's detail-view surface.

export type ReturnStatus =
  | 'requested'
  | 'approved'
  | 'denied'
  | 'awaiting_shipment'
  | 'in_transit'
  | 'received'
  | 'inspecting'
  | 'inspected'
  | 'refunded'
  | 'cancelled';

export interface ReturnSummary {
  id: string;
  orderId: string;
  orderNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  status: ReturnStatus;
  preferredOutcome: string;
  itemCount: number;
  requestedAt: string;
}

interface ReturnsListProps {
  rows: ReturnSummary[];
  view: 'table' | 'card';
}

// Return-flow tones — a CURATED domain map, not the generic statusTone(): here
// `refunded` is the happy END state (the return completed), so it's success —
// the opposite of the order/payment context where statusTone('refunded')=danger.
function StatusBadge({ status }: { status: ReturnStatus }) {
  const tone: Record<ReturnStatus, 'success' | 'warning' | 'info' | 'danger' | 'neutral'> = {
    requested: 'warning',
    approved: 'info',
    denied: 'danger',
    awaiting_shipment: 'warning',
    in_transit: 'info',
    received: 'info',
    inspecting: 'info',
    inspected: 'info',
    refunded: 'success',
    cancelled: 'neutral',
  };
  return (
    <Badge color={tone[status]} variant="soft" size="sm">
      {statusLabel(status)}
    </Badge>
  );
}

export function ReturnsList({ rows, view }: ReturnsListProps) {
  const idLink = (r: ReturnSummary) => (
    <EntityRowLink
      href={`/commerce/returns/${r.id}`}
      entityType="return"
      entityId={r.id}
      className="hover:text-module font-mono text-xs"
    >
      {r.id.slice(0, 8)}
    </EntityRowLink>
  );

  const customerCell = (r: ReturnSummary) =>
    r.customerName ? (
      <p className="text-sm">{r.customerName}</p>
    ) : r.customerId ? (
      <p className="text-base-content/70 font-mono text-xs">{r.customerId.slice(0, 8)}</p>
    ) : (
      <>—</>
    );

  const columns: SelectionColumn<ReturnSummary>[] = [
    { header: 'ID', cell: idLink },
    {
      header: 'Order',
      cell: (r) => <p className="font-mono text-sm">{r.orderNumber ?? r.orderId.slice(0, 8)}</p>,
    },
    { header: 'Customer', cell: customerCell },
    { header: 'Items', cell: (r) => <>{r.itemCount}</> },
    {
      header: 'Preferred outcome',
      cell: (r) => (
        <Badge color="info" variant="soft" size="sm">
          {statusLabel(r.preferredOutcome)}
        </Badge>
      ),
    },
    { header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
    { header: 'Requested', cell: (r) => <>{new Date(r.requestedAt).toLocaleDateString()}</> },
  ];

  const card: SelectionCard<ReturnSummary> = {
    title: (r) => idLink(r),
    subtitle: (r) => (
      <p className="text-base-content/70 text-xs">
        order <span className="font-mono">{r.orderNumber ?? r.orderId.slice(0, 8)}</span>
      </p>
    ),
    badge: (r) => <StatusBadge status={r.status} />,
    body: (r) => (
      <>
        <div className="flex flex-row items-center justify-between gap-2">
          <Badge color="info" variant="soft" size="sm">
            {statusLabel(r.preferredOutcome)}
          </Badge>
          <p className="text-sm">
            {r.itemCount} item{r.itemCount === 1 ? '' : 's'}
          </p>
        </div>
        <p className="text-base-content/70 text-xs">
          {r.customerName ? `${r.customerName} · ` : ''}requested{' '}
          {new Date(r.requestedAt).toLocaleDateString()}
        </p>
      </>
    ),
  };

  return (
    <SelectionList
      items={rows}
      view={view}
      getId={(r) => r.id}
      getRowLabel={(r) => r.id.slice(0, 8)}
      entityLabelPlural="returns"
      selectable={false}
      columns={columns}
      card={card}
    />
  );
}
