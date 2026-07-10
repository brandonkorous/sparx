import { notFound } from 'next/navigation';

import { Badge, Card, CardBody, Table } from '@wizeworks/silicaui-react';

import { statusLabel, statusTone, type StatusTone } from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import { DetailHeaderSlot } from '../../../_components/detail-header-slot';

import { ReturnApprovalForm } from './_components/return-approval-form';
import { ReturnInspectionForm } from './_components/return-inspection-form';
import { ReturnRefundForm } from './_components/return-refund-form';
import { ReturnStatusBar } from './_components/return-status-bar';

export const dynamic = 'force-dynamic';

// A *refunded* return is the happy terminal state (money returned as the customer
// wanted), so it reads green here — the platform status dictionary treats a bare
// "refunded" as danger (order money-out), which is the wrong reading in the returns
// domain. Everything else follows the shared tone map.
function returnTone(status: string): StatusTone {
  return status === 'refunded' ? 'success' : statusTone(status);
}

// Inspection condition has a natural quality gradient, so the badge carries a
// semantic tone (resaleable → success, used → warning, write-off → danger)
// rather than a flat tag — it lets staff scan restock-worthiness at a glance.
const CONDITION_TONE: Record<string, StatusTone> = {
  unopened: 'success',
  like_new: 'success',
  used_good: 'warning',
  used_acceptable: 'warning',
  damaged: 'danger',
  destroyed: 'danger',
};
function conditionTone(condition: string): StatusTone {
  return CONDITION_TONE[condition] ?? 'neutral';
}

interface Props {
  id: string;
}

type ReturnStatus =
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

interface ReturnItem {
  id: string;
  orderItemId: string;
  orderItemName: string | null;
  quantity: number;
  approvedQuantity: number;
  reasonCode: string;
  customerNote: string | null;
  mediaAssetIds: string[];
}

interface ReturnInspection {
  id: string;
  returnLineItemId: string;
  lineItemName: string | null;
  condition: string;
  restockable: boolean;
  warehouseId: string | null;
  warehouseName: string | null;
  note: string | null;
}

interface ReturnLabel {
  id: string;
  providerSlug: string;
  labelRef: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  labelMediaId: string | null;
  costCents: number;
}

const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3100';

// Mirrors apps/dashboard's other public-media-redirect call sites (product
// media panel, builder brand lib) — the one resolver that works for both
// stored uploads and hot-linked keys.
function labelUrl(mediaAssetId: string, tenantSlug: string): string {
  return `${PUBLIC_API_URL}/v1/public/media/${encodeURIComponent(mediaAssetId)}?tenant=${encodeURIComponent(tenantSlug)}`;
}

interface ReturnDetail {
  id: string;
  orderId: string;
  orderNumber: string | null;
  customerId: string | null;
  customerName: string | null;
  status: ReturnStatus;
  preferredOutcome: string;
  itemCount: number;
  requestedAt: string;
  staffNote: string | null;
  refundedAmountCents: number | null;
  restockingFeeCents: number | null;
  refundIssuedAs: string | null;
  approvedAt: string | null;
  receivedAt: string | null;
  refundedAt: string | null;
  cancelledAt: string | null;
  items: ReturnItem[];
  inspections: ReturnInspection[];
  labels: ReturnLabel[];
}

export async function ReturnDetailContent({ id }: Props) {
  let ret: ReturnDetail;
  try {
    ret = await api.get<ReturnDetail>(`/v1/commerce/returns/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }
  const tenant = await api.get<{ slug: string }>('/v1/tenant');

  return (
    <div className="flex flex-col gap-6">
      {/* Lifecycle controls teleport into the shared detail chrome's header
          (drawer/modal chrome or the full-page shell), parity with Product. */}
      <DetailHeaderSlot>
        <ReturnStatusBar returnId={ret.id} status={ret.status} />
      </DetailHeaderSlot>

      <div className="flex flex-row flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex flex-row items-center gap-2">
            <h1 className="font-mono text-2xl font-semibold">{ret.id.slice(0, 8)}</h1>
            <Badge color={returnTone(ret.status)} variant="soft" size="sm">
              {statusLabel(ret.status)}
            </Badge>
            <Badge color="info" variant="soft" size="sm">
              {statusLabel(ret.preferredOutcome)}
            </Badge>
          </div>
          <p className="text-base-content/70">
            Order{' '}
            <span className="font-mono text-sm">{ret.orderNumber ?? ret.orderId.slice(0, 8)}</span>
            {(ret.customerName ?? ret.customerId) && (
              <>
                {' · '}
                {ret.customerName ?? (
                  <span className="font-mono text-sm">{ret.customerId!.slice(0, 8)}</span>
                )}
              </>
            )}
          </p>
        </div>
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Requested items</h3>
            <p className="opacity-70">
              Customer asked to return these. Use Approve below to set per-line approved quantity.
            </p>
          </div>
          <Table>
            <thead>
              <tr>
                <th>Order item</th>
                <th>Requested qty</th>
                <th>Approved qty</th>
                <th>Reason</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {ret.items.map((it) => (
                <tr key={it.id}>
                  <td>
                    {it.orderItemName ?? (
                      <p className="text-base-content/70 font-mono text-xs">
                        {it.orderItemId.slice(0, 8)}
                      </p>
                    )}
                  </td>
                  <td>{it.quantity}</td>
                  <td>{it.approvedQuantity}</td>
                  <td>
                    <Badge color="neutral" variant="soft" size="sm">
                      {statusLabel(it.reasonCode)}
                    </Badge>
                  </td>
                  <td>{it.customerNote ?? <p className="text-base-content/70 text-xs">—</p>}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>

      {ret.status === 'requested' && (
        <Card>
          <CardBody>
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-semibold">Approve</h3>
              <p className="opacity-70">Per-line approved quantity may be less than requested.</p>
            </div>
            <ReturnApprovalForm returnId={ret.id} items={ret.items} />
          </CardBody>
        </Card>
      )}

      {(ret.status === 'received' || ret.status === 'inspecting') && (
        <Card>
          <CardBody>
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-semibold">Record inspection</h3>
              <p className="opacity-70">
                Mark each line&apos;s condition and whether it can be restocked.
              </p>
            </div>
            <ReturnInspectionForm returnId={ret.id} items={ret.items} />
          </CardBody>
        </Card>
      )}

      {(ret.status === 'inspected' || ret.status === 'received') && (
        <Card>
          <CardBody>
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-semibold">Issue refund</h3>
              <p className="opacity-70">
                Refund to original payment or as account credit. Provider-side settlement runs
                alongside.
              </p>
            </div>
            <ReturnRefundForm returnId={ret.id} preferredOutcome={ret.preferredOutcome} />
          </CardBody>
        </Card>
      )}

      {(ret.status === 'approved' ||
        ret.status === 'awaiting_shipment' ||
        ret.status === 'in_transit') &&
        ret.labels.length === 0 && (
          <Card>
            <CardBody>
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-semibold">Return label</h3>
                <p className="opacity-70">
                  No label was auto-purchased — connect a carrier from Commerce → Providers, or
                  print one manually and email it to the customer.
                </p>
              </div>
            </CardBody>
          </Card>
        )}

      {ret.labels.length > 0 && (
        <Card>
          <CardBody>
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-semibold">Return label</h3>
            </div>
            <div className="flex flex-col gap-2">
              {ret.labels.map((lbl) => (
                <div key={lbl.id} className="flex flex-row flex-wrap items-center gap-3 text-sm">
                  <Badge color="success" variant="soft" size="sm">
                    ${(lbl.costCents / 100).toFixed(2)}
                  </Badge>
                  {lbl.trackingNumber && <code className="text-xs">{lbl.trackingNumber}</code>}
                  {lbl.labelMediaId && (
                    <a
                      href={labelUrl(lbl.labelMediaId, tenant.slug)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-module hover:underline"
                    >
                      Print label
                    </a>
                  )}
                  {lbl.trackingUrl && (
                    <a
                      href={lbl.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-module hover:underline"
                    >
                      Track shipment
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {ret.inspections.length > 0 && (
        <Card>
          <CardBody>
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-semibold">Inspection history</h3>
            </div>
            <Table>
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Condition</th>
                  <th>Restockable</th>
                  <th>Warehouse</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {ret.inspections.map((ins) => (
                  <tr key={ins.id}>
                    <td>
                      {ins.lineItemName ?? (
                        <p className="text-base-content/70 font-mono text-xs">
                          {ins.returnLineItemId.slice(0, 8)}
                        </p>
                      )}
                    </td>
                    <td>
                      <Badge color={conditionTone(ins.condition)} variant="soft" size="sm">
                        {statusLabel(ins.condition)}
                      </Badge>
                    </td>
                    <td>{ins.restockable ? 'yes' : 'no'}</td>
                    <td>{ins.warehouseName ?? ins.warehouseId?.slice(0, 8) ?? '—'}</td>
                    <td>{ins.note ?? <p className="text-base-content/70 text-xs">—</p>}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      )}

      {ret.status === 'refunded' && (
        <Card>
          <CardBody>
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-semibold">Settlement</h3>
            </div>
            <div className="flex flex-col gap-2">
              <Row
                label="Refunded amount"
                value={
                  ret.refundedAmountCents != null
                    ? `$${(ret.refundedAmountCents / 100).toFixed(2)}`
                    : '—'
                }
              />
              <Row
                label="Restocking fee"
                value={
                  ret.restockingFeeCents != null
                    ? `$${(ret.restockingFeeCents / 100).toFixed(2)}`
                    : '—'
                }
              />
              <Row
                label="Issued as"
                value={ret.refundIssuedAs ? statusLabel(ret.refundIssuedAs) : '—'}
              />
              <Row
                label="Refunded at"
                value={ret.refundedAt ? new Date(ret.refundedAt).toLocaleString() : '—'}
              />
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-row gap-4">
      <p className="text-base-content/70 w-40 text-sm">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
