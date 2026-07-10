import { notFound } from 'next/navigation';

import { statusLabel, statusTone } from '@sparx/ui';
import { Badge, Card, CardBody, Table } from '@wizeworks/silicaui-react';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import { DetailHeaderSlot } from '../../../_components/detail-header-slot';

import { SubscriptionActionsBar } from './_components/subscription-actions-bar';

export const dynamic = 'force-dynamic';

interface Props {
  id: string;
}

type SubscriptionStatus = 'active' | 'trialing' | 'paused' | 'past_due' | 'cancelled';

interface SubscriptionItem {
  id: string;
  variantId: string;
  variantSku: string | null;
  productTitle: string | null;
  quantity: number;
  unitPriceCents: number;
  addonOfId: string | null;
  addonOfName: string | null;
}

interface SubscriptionDetail {
  id: string;
  customerId: string;
  customerName: string | null;
  status: SubscriptionStatus;
  nextOccurrenceAt: string | null;
  itemCount: number;
  monthlyRecurringRevenueCents: number;
  currency: string;
  providerSlug: string;
  intervalUnit: string;
  intervalCount: number;
  deliveriesPerCycle: number;
  trialEndsAt: string | null;
  startedAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  pausedUntil: string | null;
  cancelledAt: string | null;
  shippingAddress: unknown;
  billingAddress: unknown;
  items: SubscriptionItem[];
}

export async function SubscriptionDetailContent({ id }: Props) {
  let sub: SubscriptionDetail;
  try {
    sub = await api.get<SubscriptionDetail>(`/v1/commerce/subscriptions/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Lifecycle controls teleport into the shared detail chrome's header
          (drawer/modal chrome or the full-page shell), parity with Product. */}
      <DetailHeaderSlot>
        <SubscriptionActionsBar subscriptionId={sub.id} status={sub.status} />
      </DetailHeaderSlot>

      <div className="flex flex-row flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex flex-row items-center gap-2">
            <h1 className="font-mono text-2xl font-semibold">{sub.id.slice(0, 8)}</h1>
            <Badge color={statusTone(sub.status)} variant="soft" size="sm">
              {statusLabel(sub.status)}
            </Badge>
          </div>
          <p className="text-base-content/70 text-base">
            {sub.customerName ?? `Customer ${sub.customerId.slice(0, 8)}`} · Every{' '}
            {sub.intervalCount} {sub.intervalUnit}
            {sub.intervalCount > 1 ? 's' : ''} · {sub.deliveriesPerCycle} per cycle
          </p>
        </div>
      </div>

      <div className="flex flex-row flex-wrap gap-4">
        <Stat label="MRR" value={`$${(sub.monthlyRecurringRevenueCents / 100).toFixed(2)}`} />
        <Stat label="Currency" value={sub.currency} />
        <Stat label="Items" value={String(sub.itemCount)} />
        <Stat
          label="Next charge"
          value={sub.nextOccurrenceAt ? new Date(sub.nextOccurrenceAt).toLocaleDateString() : '—'}
        />
        <Stat
          label="Started"
          value={sub.startedAt ? new Date(sub.startedAt).toLocaleDateString() : '—'}
        />
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Items</h3>
            <p className="opacity-70">Each renewal generates a CRM Order with these line items.</p>
          </div>
          <Table>
            <thead>
              <tr>
                <th>Variant</th>
                <th>Quantity</th>
                <th>Unit price</th>
                <th>Add-on of</th>
              </tr>
            </thead>
            <tbody>
              {sub.items.map((it) => (
                <tr key={it.id}>
                  <td>
                    <div className="flex flex-col gap-0">
                      <p className="text-sm">{it.productTitle ?? it.variantId.slice(0, 8)}</p>
                      {it.variantSku && (
                        <p className="text-base-content/70 font-mono text-xs">{it.variantSku}</p>
                      )}
                    </div>
                  </td>
                  <td>{it.quantity}</td>
                  <td>${(it.unitPriceCents / 100).toFixed(2)}</td>
                  <td>
                    {it.addonOfId ? (
                      <p className="text-sm">{it.addonOfName ?? it.addonOfId.slice(0, 8)}</p>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Lifecycle</h3>
            <p className="opacity-70">
              The provider drives the actual charge schedule; the platform records the resulting
              state transitions here.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Row label="Status" value={statusLabel(sub.status)} />
            <Row
              label="Period"
              value={
                sub.currentPeriodStart && sub.currentPeriodEnd
                  ? `${new Date(sub.currentPeriodStart).toLocaleDateString()} → ${new Date(
                      sub.currentPeriodEnd
                    ).toLocaleDateString()}`
                  : '—'
              }
            />
            <Row
              label="Trial ends"
              value={sub.trialEndsAt ? new Date(sub.trialEndsAt).toLocaleString() : '—'}
            />
            <Row
              label="Paused until"
              value={sub.pausedUntil ? new Date(sub.pausedUntil).toLocaleString() : '—'}
            />
            <Row
              label="Cancelled"
              value={sub.cancelledAt ? new Date(sub.cancelledAt).toLocaleString() : '—'}
            />
            <Row label="Provider" value={sub.providerSlug} />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-base-300 flex flex-col gap-1 rounded border p-3">
      <p className="text-base-content/70 text-xs">{label}</p>
      <p className="text-base font-medium">{value}</p>
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
