'use client';

// Per-fulfillment carrier label actions (docs/09 real Shippo integration):
// get live rates → buy a label → show tracking + a link to the label PDF →
// void. Renders under each fulfillment row on the order detail page.

import * as React from 'react';
import { Loader2, Package, X } from 'lucide-react';
import { Badge, Button } from '@wizeworks/silicaui-react';
import { toast, useConfirm } from '@sparx/ui';

import {
  buyOutboundLabelAction,
  quoteOutboundRatesAction,
  voidOutboundLabelAction,
  type FulfillmentLabelDTO,
  type RateOptionDTO,
} from '../actions/order-label-actions';

const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3100';

function labelUrl(mediaAssetId: string, tenantSlug: string): string {
  return `${PUBLIC_API_URL}/v1/public/media/${encodeURIComponent(mediaAssetId)}?tenant=${encodeURIComponent(tenantSlug)}`;
}

function formatMoney(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

interface Props {
  orderId: string;
  fulfillmentId: string;
  fulfillmentStatus: string;
  tenantSlug: string;
  initialLabels: FulfillmentLabelDTO[];
}

export function FulfillmentLabelPanel({
  orderId,
  fulfillmentId,
  fulfillmentStatus,
  tenantSlug,
  initialLabels,
}: Props) {
  const confirm = useConfirm();
  const [labels, setLabels] = React.useState(initialLabels);
  const [rates, setRates] = React.useState<RateOptionDTO[] | null>(null);
  const [busy, setBusy] = React.useState(false);

  const activeLabel = labels.find((l) => !l.voidedAt) ?? null;

  async function handleGetRates() {
    setBusy(true);
    const result = await quoteOutboundRatesAction({ orderId, fulfillmentId });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    if (result.data.length === 0) {
      toast.error(
        'No carrier rates available — check your warehouse address and connected carrier.'
      );
      return;
    }
    setRates(result.data);
  }

  async function handleBuy(rateRef: string) {
    setBusy(true);
    const result = await buyOutboundLabelAction({ orderId, fulfillmentId, rateRef });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setRates(null);
    setLabels((prev) => [
      {
        id: result.data.trackingNumber,
        providerSlug: '',
        labelRef: '',
        trackingNumber: result.data.trackingNumber,
        trackingUrl: result.data.trackingUrl,
        labelMediaId: result.data.labelMediaId,
        costCents: result.data.costCents,
        voidedAt: null,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    toast.success('Label purchased.');
  }

  async function handleVoid(labelRef: string) {
    const ok = await confirm({
      title: 'Void this label?',
      description: 'The carrier will be asked to refund the postage. This cannot be undone.',
      confirmLabel: 'Void label',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    const result = await voidOutboundLabelAction({ orderId, fulfillmentId, labelRef });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setLabels((prev) =>
      prev.map((l) => (l.labelRef === labelRef ? { ...l, voidedAt: new Date().toISOString() } : l))
    );
    toast.success('Label voided.');
  }

  return (
    <div className="flex flex-col gap-2">
      {activeLabel && (
        <div className="flex flex-row flex-wrap items-center gap-2 text-xs">
          <Badge color="success" variant="soft" size="sm">
            Label purchased · {formatMoney(activeLabel.costCents, 'USD')}
          </Badge>
          {activeLabel.labelMediaId && (
            <a
              href={labelUrl(activeLabel.labelMediaId, tenantSlug)}
              target="_blank"
              rel="noreferrer"
              className="text-module hover:underline"
            >
              Print label
            </a>
          )}
          {activeLabel.trackingUrl && (
            <a
              href={activeLabel.trackingUrl}
              target="_blank"
              rel="noreferrer"
              className="text-module hover:underline"
            >
              Track shipment
            </a>
          )}
          {activeLabel.labelRef && (
            <Button
              size="xs"
              variant="ghost"
              color="danger"
              disabled={busy}
              onClick={() => handleVoid(activeLabel.labelRef)}
            >
              <X className="h-3 w-3" /> Void
            </Button>
          )}
        </div>
      )}

      {!activeLabel && fulfillmentStatus === 'pending' && !rates && (
        <Button size="xs" variant="soft" color="module" disabled={busy} onClick={handleGetRates}>
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Package className="h-3 w-3" />}
          Buy shipping label
        </Button>
      )}

      {rates && (
        <div className="border-base-300 flex flex-col gap-1 rounded-lg border p-2">
          {rates.map((r) => (
            <button
              key={r.rateRef}
              type="button"
              disabled={busy}
              onClick={() => handleBuy(r.rateRef)}
              className="hover:bg-base-200 flex flex-row items-center justify-between rounded px-2 py-1 text-left text-xs disabled:opacity-50"
            >
              <span>
                {r.carrier} — {r.service}
              </span>
              <span className="tabular-nums">{formatMoney(r.amountCents, r.currency)}</span>
            </button>
          ))}
          <Button size="xs" variant="ghost" onClick={() => setRates(null)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
