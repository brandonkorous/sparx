import { notFound } from 'next/navigation';
import { ClipboardCheck } from 'lucide-react';

import { Badge, Card, CardBody } from 'silicaui-react';

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-row flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-row flex-wrap items-center gap-3">
            <ClipboardCheck className="h-5 w-5" />
            <h1 className="text-3xl font-semibold">{count.number}</h1>
            <Badge color={status.color}>{status.label}</Badge>
            {count.requiresApproval && count.status !== 'posted' && count.status !== 'cancelled' ? (
              <Badge color="warning" variant="soft">
                needs approval
              </Badge>
            ) : null}
          </div>
          <p className="text-base-content/70 text-sm">
            {countTypeLabel(count.type)} ·{' '}
            {count.warehouseName ?? count.warehouseCode ?? 'Warehouse'}
            {count.note ? ` · ${count.note}` : ''}
          </p>
        </div>
        <CountActionsBar
          id={count.id}
          status={count.status}
          requiresApproval={count.requiresApproval}
        />
      </div>

      <div className="flex flex-row flex-wrap gap-4">
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
      </div>

      <CountLinesPanel id={count.id} type={count.type} status={count.status} lines={count.lines} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="min-w-[9rem] flex-1">
      <CardBody>
        <div className="flex flex-col gap-1 py-2">
          <p className="text-base-content/70 text-xs">{label}</p>
          <p className="text-lg">{value}</p>
        </div>
      </CardBody>
    </Card>
  );
}
