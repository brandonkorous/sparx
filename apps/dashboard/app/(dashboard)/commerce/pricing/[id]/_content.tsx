import { notFound } from 'next/navigation';
import { DollarSign } from 'lucide-react';

import { Badge, Card, CardBody } from '@wizeworks/silicaui-react';
import { statusLabel, statusTone } from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import { DetailHeaderSlot } from '../../../_components/detail-header-slot';

import { PriceListStatusBar } from './_components/price-list-status-bar';
import { PriceListEntriesEditor } from './_components/price-list-entries-editor';
import { PriceListTargetingCard } from './_components/price-list-targeting-card';
import { loadPriceListTargetingOptions } from '../_lib/targeting-options';

export const dynamic = 'force-dynamic';

interface Props {
  id: string;
}

interface PriceListDetail {
  id: string;
  name: string;
  description: string | null;
  currency: string;
  channel: string | null;
  customerSegmentId: string | null;
  b2bAccountId: string | null;
  collectionId: string | null;
  priority: number;
  validFrom: string | null;
  validTo: string | null;
  status: string;
  entryCount: number;
  updatedAt: string;
}

interface EntryRow {
  id: string;
  variantId: string;
  variantSku: string;
  productTitle: string;
  fixedPriceCents: number | null;
  percentOffList: number | null;
  minQuantity: number;
  maxQuantity: number | null;
}

interface VariantListRow {
  id: string;
  sku: string;
  title: string | null;
  priceCents: number;
  productTitle: string;
}

export async function PriceListDetailContent({ id }: Props) {
  let priceList: PriceListDetail;
  try {
    priceList = await api.get<PriceListDetail>(`/v1/commerce/price-lists/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  const [entries, variantRows, targetingOptions] = await Promise.all([
    api.get<EntryRow[]>(`/v1/commerce/price-lists/${id}/entries`),
    api.get<VariantListRow[]>('/v1/commerce/variants?take=500'),
    loadPriceListTargetingOptions(),
  ]);

  const variantSummaries = variantRows.map((v) => ({
    id: v.id,
    sku: v.sku,
    title: v.title,
    basePriceCents: v.priceCents,
    productTitle: v.productTitle,
  }));

  const targetLabel = priceList.b2bAccountId
    ? targetingOptions.b2bAccounts.find((a) => a.id === priceList.b2bAccountId)?.label
    : priceList.customerSegmentId
      ? targetingOptions.segments.find((s) => s.id === priceList.customerSegmentId)?.label
      : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Lifecycle controls teleport into the shared detail chrome's header
          (drawer/modal chrome or the full-page shell), parity with
          ConfiguratorTemplate. */}
      <DetailHeaderSlot>
        <PriceListStatusBar priceListId={priceList.id} status={priceList.status} />
      </DetailHeaderSlot>

      <div className="flex flex-row flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-row flex-wrap items-center gap-3">
            <DollarSign className="h-5 w-5" />
            <h1 className="text-3xl font-semibold">{priceList.name}</h1>
            <Badge color={statusTone(priceList.status)} variant="soft" size="sm">
              {statusLabel(priceList.status)}
            </Badge>
            <Badge color="neutral" variant="soft" size="sm" className="font-mono">
              {priceList.currency}
            </Badge>
            {priceList.channel && (
              <Badge color="neutral" variant="soft" size="sm">
                {statusLabel(priceList.channel)}
              </Badge>
            )}
            {targetLabel && (
              <Badge color="module" variant="soft" size="sm">
                {targetLabel}
              </Badge>
            )}
          </div>
          <p className="text-base-content text-sm">
            Priority {priceList.priority} · {entries.length} entries
          </p>
        </div>
      </div>

      {priceList.description && (
        <Card>
          <CardBody>
            <p className="text-base">{priceList.description}</p>
          </CardBody>
        </Card>
      )}

      <PriceListTargetingCard
        priceListId={priceList.id}
        b2bAccountId={priceList.b2bAccountId}
        customerSegmentId={priceList.customerSegmentId}
        b2bAccounts={targetingOptions.b2bAccounts}
        segments={targetingOptions.segments}
      />

      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Per-variant entries</h3>
            <p className="opacity-70">
              Pick a variant from the dropdown, then set either a fixed price or a percent-off-list.
              Quantity ranges let you ladder pricing (e.g. 1-9 at $20, 10+ at $18).
            </p>
          </div>
          <PriceListEntriesEditor
            priceListId={priceList.id}
            entries={entries}
            variants={variantSummaries}
          />
        </CardBody>
      </Card>
    </div>
  );
}
