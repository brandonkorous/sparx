import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Package, CreditCard, Truck, Building2 } from 'lucide-react';

import { Stat, statusLabel, statusTone } from '@sparx/ui';
import { Badge, Card, CardBody, CardTitle, Table } from '@wizeworks/silicaui-react';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import { CreateFulfillmentPanel } from './components/create-fulfillment-panel';
import { FulfillmentLabelPanel } from './components/fulfillment-label-panel';
import type { FulfillmentLabelDTO } from './actions/order-label-actions';
import type { OrderLens } from './lens';

interface OrderItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  quantityFulfilled: number;
  quantityRefunded: number;
  unitPrice: string | number;
  lineTotal: string | number;
}

interface OrderWithItems {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  customerId: string;
  currency: string;
  total: string | number;
  amountPaid: string | number;
  refundTotal: string | number;
  placedAt: string | null;
  items: OrderItem[];
  /** Joined by the API so the detail never has to hit the CRM-gated
   *  /v1/crm/customers to name its own buyer. */
  customer: CustomerSummary;
}

interface PaymentRow {
  id: string;
  processor: string;
  status: string;
  amount: string | number;
  currency: string;
  capturedAt: string | null;
}

interface RefundRow {
  id: string;
  amount: string | number;
  currency: string;
  reason: string | null;
  refundedAt: string | null;
}

interface FulfillmentRow {
  id: string;
  status: string;
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
}

interface CustomerSummary {
  id: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
  b2bAccountId: string | null;
  b2bAccount: {
    id: string;
    companyName: string;
    paymentTerms: string | null;
    status: string;
  } | null;
}

export const dynamic = 'force-dynamic';

interface Props {
  id: string;
  /** The module lens this detail is being viewed through — decides which
   *  panels render and where its links point. See ./lens.ts. */
  lens: OrderLens;
}

export async function OrderDetailContent({ id, lens }: Props) {
  const shows = (panel: Parameters<typeof lens.panels.includes>[0]) => lens.panels.includes(panel);
  let order: OrderWithItems;
  try {
    order = await api.get<OrderWithItems>(`/v1/orders/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  // Only fetch what this lens actually renders. Beyond the wasted round-trip,
  // a CRM-only tenant has no entitlement to the shipping stack — the API
  // enforces that on the label endpoints, and this keeps the UI from asking.
  // The buyer comes joined on the order itself — NOT from /v1/crm/customers,
  // which is CRM-gated and would leave a commerce-only or B2B-only tenant
  // unable to see who placed their own order.
  const customer = order.customer;

  const [payments, refunds, fulfillments, tenant] = await Promise.all([
    shows('payments')
      ? api.get<PaymentRow[]>(`/v1/orders/${order.id}/payments`)
      : Promise.resolve([] as PaymentRow[]),
    shows('refunds')
      ? api.get<RefundRow[]>(`/v1/orders/${order.id}/refunds`)
      : Promise.resolve([] as RefundRow[]),
    shows('fulfillments')
      ? api.get<FulfillmentRow[]>(`/v1/orders/${order.id}/fulfillments`)
      : Promise.resolve([] as FulfillmentRow[]),
    api.get<{ slug: string }>('/v1/tenant'),
  ]);

  const unfulfilledLines = order.items
    .filter((i) => i.quantity > i.quantityFulfilled)
    .map((i) => ({
      orderItemId: i.id,
      sku: i.sku,
      name: i.name,
      remaining: i.quantity - i.quantityFulfilled,
    }));
  const canFulfill =
    unfulfilledLines.length > 0 && order.status !== 'cancelled' && order.status !== 'refunded';

  // Labels are commerce-only machinery — the API gates the endpoint on the
  // Commerce module on top of the shared order gate, so a lens without the
  // 'labels' panel never asks for them.
  const fulfillmentLabels = shows('labels')
    ? await Promise.all(
        fulfillments.map((f) =>
          api
            .get<FulfillmentLabelDTO[]>(`/v1/orders/${order.id}/fulfillments/${f.id}/labels`)
            .catch(() => [] as FulfillmentLabelDTO[])
        )
      )
    : fulfillments.map(() => [] as FulfillmentLabelDTO[]);

  return (
    // @container so the body responds to its OWN width — full-page (wide) vs. the
    // detail drawer (narrow), where viewport breakpoints would crush the columns.
    <div className="@container flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-row flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold">{order.orderNumber}</h1>
          <Badge color={statusTone(order.status)} variant="soft">
            {statusLabel(order.status)}
          </Badge>
          <Badge color={statusTone(order.paymentStatus)} variant="soft">
            {statusLabel(order.paymentStatus)}
          </Badge>
          {customer &&
            (() => {
              const name =
                [customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
                (customer.company ?? customer.email);
              const href = lens.customerHref?.(customer.id);
              return href ? (
                <Link href={href} className="hover:text-module text-sm hover:underline">
                  {name}
                </Link>
              ) : (
                <p className="text-base-content text-sm">{name}</p>
              );
            })()}
        </div>
      </div>

      <div className="grid gap-4 @[440px]:grid-cols-2 @[820px]:grid-cols-4">
        <Card className="bg-module bg-soft">
          <CardBody className="py-4">
            <Stat
              label="Total"
              value={`${order.currency} ${Number(order.total).toLocaleString()}`}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-4">
            <Stat
              label="Paid"
              value={`${order.currency} ${Number(order.amountPaid).toLocaleString()}`}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-4">
            <Stat
              label="Refunded"
              value={`${order.currency} ${Number(order.refundTotal).toLocaleString()}`}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-4">
            <Stat
              label="Placed"
              value={order.placedAt ? new Date(order.placedAt).toLocaleDateString() : '—'}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <CardTitle>
            <div className="flex flex-row items-center gap-2">
              <Package className="h-4 w-4" /> Line items
              <Badge color="neutral" variant="soft" size="sm">
                {order.items.length}
              </Badge>
            </div>
          </CardTitle>
          <Table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Fulfilled</th>
                <th className="text-right">Refunded</th>
                <th className="text-right">Unit price</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <code className="text-xs">{item.sku}</code>
                  </td>
                  <td>{item.name}</td>
                  <td className="text-right tabular-nums">{item.quantity}</td>
                  <td className="text-right tabular-nums">{item.quantityFulfilled}</td>
                  <td className="text-right tabular-nums">{item.quantityRefunded}</td>
                  <td className="text-right tabular-nums">
                    {order.currency} {Number(item.unitPrice).toLocaleString()}
                  </td>
                  <td className="text-right tabular-nums">
                    {order.currency} {Number(item.lineTotal).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>

      <div className="grid gap-6 @[680px]:grid-cols-2">
        {shows('payments') && (
          <Card>
            <CardBody>
              <CardTitle>
                <div className="flex flex-row items-center gap-2">
                  <CreditCard className="h-4 w-4" /> Payments
                  <Badge color="neutral" variant="soft" size="sm">
                    {payments.length}
                  </Badge>
                </div>
              </CardTitle>
              {payments.length === 0 ? (
                <p className="text-base-content text-sm">No payments recorded.</p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th>Processor</th>
                      <th>Status</th>
                      <th className="text-right">Amount</th>
                      <th>Captured</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <p className="text-sm">{p.processor}</p>
                        </td>
                        <td>
                          <Badge color={statusTone(p.status)} variant="soft" size="sm">
                            {statusLabel(p.status)}
                          </Badge>
                        </td>
                        <td className="text-right tabular-nums">
                          {p.currency} {Number(p.amount).toLocaleString()}
                        </td>
                        <td>
                          <p className="text-base-content text-xs">
                            {p.capturedAt ? new Date(p.capturedAt).toLocaleDateString() : '—'}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
              {shows('refunds') && refunds.length > 0 && (
                <div className="mt-4 flex flex-col gap-2">
                  <p className="text-sm font-medium">Refunds</p>
                  {refunds.map((r) => (
                    <div key={r.id} className="flex flex-row justify-between">
                      <p className="text-base-content text-xs">
                        {r.refundedAt ? new Date(r.refundedAt).toLocaleDateString() : '—'} ·{' '}
                        {r.reason ?? 'no reason'}
                      </p>
                      <p className="text-xs tabular-nums">
                        {r.currency} {Number(r.amount).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {shows('fulfillments') && (
          <Card>
            <CardBody>
              <CardTitle>
                <div className="flex flex-row items-center gap-2">
                  <Truck className="h-4 w-4" /> Fulfillments
                  <Badge color="neutral" variant="soft" size="sm">
                    {fulfillments.length}
                  </Badge>
                </div>
              </CardTitle>
              <div className="flex flex-col gap-3">
                {fulfillments.length === 0 ? (
                  <p className="text-base-content text-sm">No fulfillments yet.</p>
                ) : (
                  fulfillments.map((f, i) => (
                    <div key={f.id} className="flex flex-col gap-2">
                      <div className="flex flex-row justify-between">
                        <div className="flex flex-row items-center gap-2">
                          <Badge color={statusTone(f.status)} variant="soft" size="sm">
                            {statusLabel(f.status)}
                          </Badge>
                          {f.carrier && <p className="text-base-content text-sm">{f.carrier}</p>}
                          {f.trackingNumber && <code className="text-xs">{f.trackingNumber}</code>}
                        </div>
                        <p className="text-base-content text-xs">
                          {f.shippedAt ? new Date(f.shippedAt).toLocaleDateString() : '—'}
                        </p>
                      </div>
                      {shows('labels') && (
                        <FulfillmentLabelPanel
                          orderId={order.id}
                          fulfillmentId={f.id}
                          fulfillmentStatus={f.status}
                          tenantSlug={tenant.slug}
                          initialLabels={fulfillmentLabels[i] ?? []}
                        />
                      )}
                    </div>
                  ))
                )}
                {canFulfill && (
                  <CreateFulfillmentPanel orderId={order.id} lines={unfulfilledLines} />
                )}
              </div>
            </CardBody>
          </Card>
        )}

        {shows('terms') && customer?.b2bAccount && (
          <Card className="bg-module bg-soft">
            <CardBody>
              <CardTitle>
                <div className="flex flex-row items-center gap-2">
                  <Building2 className="h-4 w-4" /> Account terms
                </div>
              </CardTitle>
              <div className="flex flex-col gap-2">
                <div className="flex flex-row justify-between gap-2">
                  <p className="text-base-content text-sm">Account</p>
                  <p className="text-sm font-medium">{customer.b2bAccount.companyName}</p>
                </div>
                <div className="flex flex-row justify-between gap-2">
                  <p className="text-base-content text-sm">Payment terms</p>
                  <p className="text-sm font-medium">
                    {customer.b2bAccount.paymentTerms ?? 'Due on receipt'}
                  </p>
                </div>
                <div className="flex flex-row justify-between gap-2">
                  <p className="text-base-content text-sm">Balance due</p>
                  <p className="text-sm font-medium tabular-nums">
                    {order.currency}{' '}
                    {(Number(order.total) - Number(order.amountPaid)).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
