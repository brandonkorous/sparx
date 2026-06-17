import { notFound } from 'next/navigation';
import { ClipboardCheck } from 'lucide-react';

import { Badge, Card, CardContent, Heading, Stack, Text } from '@sparx/ui';

import { api, type ApiRestError } from '@/lib/api-rest-client';

import {
  countStatus,
  countTypeLabel,
  formatDate,
  formatMoney,
  type InventoryCountDetail,
} from '../_components/types';
import { CountActionsBar } from './_components/count-actions-bar';
import { CountLinesPanel } from './_components/count-lines-panel';

// Inventory count detail (docs/100 P4) — the working surface for one count: the
// lifecycle bar (submit → approve → post), the lines table (expected / counted /
// variance), and — while counting — entering quantities + adding/removing lines.

export async function InventoryCountDetailContent({ id }: { id: string }) {
  let count: InventoryCountDetail;
  try {
    count = await api.get<InventoryCountDetail>(`/v1/inventory/counts/${id}`);
  } catch (err) {
    if ((err as ApiRestError).code === 'NOT_FOUND') notFound();
    throw err;
  }

  const status = countStatus(count.status);
  const postedAt = count.postedAt;

  return (
    <Stack gap={6}>
      <Stack direction="row" align="start" justify="between" wrap gap={4}>
        <Stack gap={1}>
          <Stack direction="row" align="center" gap={3} wrap>
            <ClipboardCheck className="h-5 w-5" />
            <Heading level={1}>{count.number}</Heading>
            <Badge color={status.color}>{status.label}</Badge>
            {count.requiresApproval && count.status !== 'posted' && count.status !== 'cancelled' ? (
              <Badge color="warning" variant="soft">
                needs approval
              </Badge>
            ) : null}
          </Stack>
          <Text size="sm" variant="muted">
            {countTypeLabel(count.type)} ·{' '}
            {count.warehouseName ?? count.warehouseCode ?? 'Warehouse'}
            {count.note ? ` · ${count.note}` : ''}
          </Text>
        </Stack>
        <CountActionsBar
          id={count.id}
          status={count.status}
          requiresApproval={count.requiresApproval}
        />
      </Stack>

      <Stack direction="row" gap={4} wrap>
        <Stat label="Counted" value={`${count.countedLineCount}/${count.lineCount} lines`} />
        <Stat
          label="Variance value"
          value={count.status === 'counting' ? '—' : formatMoney(count.varianceValueCents)}
        />
        <Stat label="Approval over" value={formatMoney(count.approvalThresholdCents)} />
        <Stat label="Started" value={formatDate(count.startedAt)} />
        <Stat
          label={postedAt ? 'Posted' : 'Submitted'}
          value={formatDate(postedAt ?? count.countedAt)}
        />
      </Stack>

      <CountLinesPanel id={count.id} type={count.type} status={count.status} lines={count.lines} />
    </Stack>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="min-w-[9rem] flex-1">
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
