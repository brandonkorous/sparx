import { notFound } from 'next/navigation';
import { CircleAlert } from 'lucide-react';

import { Badge, Card, CardContent, Heading, Stack, Text } from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import {
  formatDate,
  hazmatLabel,
  recallBadge,
  serialStatusLabel,
  type LotDetail,
  type SerialRow,
} from '../_components/types';
import { LotActionsBar } from './_components/lot-actions-bar';
import { SerialsPanel } from './_components/serials-panel';

// Lot detail (docs/100 P4d) — one batch: its metadata, recall state + actions, and
// the serial roster (list / add / status changes). Quantities are traceability
// metadata; authoritative on-hand lives on the (variant, warehouse) level.

export async function LotDetailContent({ id }: { id: string }) {
  let lot: LotDetail;
  try {
    lot = await api.get<LotDetail>(`/v1/inventory/lots/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }
  const { data: serials } = await api.getPaged<SerialRow[]>(
    `/v1/inventory/lots/${id}/serials?take=500`
  );

  const recall = recallBadge(lot.recallStatus);

  return (
    <Stack gap={6}>
      <Stack direction="row" align="start" justify="between" wrap gap={4}>
        <Stack gap={1}>
          <Stack direction="row" align="center" gap={3} wrap>
            <CircleAlert className="h-5 w-5" />
            <Heading level={1} className="font-mono">
              {lot.lotNumber}
            </Heading>
            {recall ? <Badge color={recall.color}>{recall.label}</Badge> : null}
            {lot.hazmatClass !== 'none' ? (
              <Badge color="warning" variant="soft">
                {hazmatLabel(lot.hazmatClass)}
              </Badge>
            ) : null}
          </Stack>
          <Text size="sm" variant="muted">
            {lot.productTitle ?? lot.variantSku ?? lot.variantId.slice(0, 8)}
            {lot.variantSku ? ` · ${lot.variantSku}` : ''} ·{' '}
            {lot.warehouseName ?? lot.warehouseCode ?? 'Warehouse'}
          </Text>
        </Stack>
        <LotActionsBar id={lot.id} recallStatus={lot.recallStatus} />
      </Stack>

      {recall && lot.recallStatus === 'active' ? (
        <Card>
          <CardContent>
            <Stack gap={1} className="py-1">
              <Text size="sm" className="font-medium text-[var(--color-danger)]">
                Recall active
              </Text>
              <Text size="sm">{lot.recallReason ?? 'No reason recorded.'}</Text>
              <Text size="xs" variant="muted">
                Recalled {formatDate(lot.recalledAt)}
              </Text>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <Stack direction="row" gap={4} wrap>
        <Stat label="Quantity" value={String(lot.quantity)} />
        <Stat label="Serials" value={String(lot.serialCount)} />
        <Stat label="Manufactured" value={formatDate(lot.manufacturedAt)} />
        <Stat label="Expires" value={formatDate(lot.expiresAt)} />
        <Stat label="Supplier ref" value={lot.supplierBatchRef ?? '—'} />
      </Stack>

      {lot.serialCounts.length > 0 ? (
        <Stack direction="row" gap={2} wrap align="center">
          <Text size="sm" variant="muted">
            Serial status:
          </Text>
          {lot.serialCounts.map((c) => (
            <Badge key={c.status} variant="outline">
              {serialStatusLabel(c.status)} · {c.count}
            </Badge>
          ))}
        </Stack>
      ) : null}

      <SerialsPanel
        lotId={lot.id}
        variantId={lot.variantId}
        warehouseId={lot.warehouseId}
        serials={serials}
      />
    </Stack>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="min-w-[8rem] flex-1">
      <CardContent>
        <Stack gap={1} className="py-2">
          <Text size="xs" variant="muted">
            {label}
          </Text>
          <Text size="lg">{value}</Text>
        </Stack>
      </CardContent>
    </Card>
  );
}
