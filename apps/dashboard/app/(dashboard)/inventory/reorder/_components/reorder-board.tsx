'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Package } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardActions,
  CardBody,
  Checkbox,
  Input,
} from '@wizeworks/silicaui-react';

import { draftReorderAction } from '../../_lib/reorder-actions';
import {
  formatDate,
  formatMoney,
  type DraftReorderLine,
  type ReorderGroup,
  type ReorderSuggestionLine,
} from './types';

interface RowState {
  selected: boolean;
  qty: string;
}

const lineKey = (supplierId: string, l: ReorderSuggestionLine): string =>
  `${supplierId}::${l.variantId}::${l.warehouseId}`;

// Reorder board (docs/100 P3d). Each (supplier, warehouse) group becomes one draft
// PO; the buyer toggles lines + tunes quantities, then drafts. Lines already on an
// open PO default OFF (so nothing is double-ordered) but can be re-selected.

export function ReorderBoard({ groups }: { groups: ReorderGroup[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<string[] | null>(null);
  const [rows, setRows] = React.useState<Record<string, RowState>>(() => initRows(groups));

  function patch(key: string, field: keyof RowState, value: string | boolean): void {
    setRows((prev) => {
      const current = prev[key] ?? { selected: false, qty: '' };
      const next: RowState =
        field === 'selected'
          ? { ...current, selected: value === true }
          : { ...current, qty: String(value) };
      return { ...prev, [key]: next };
    });
  }

  function collect(scope: ReorderGroup[]): DraftReorderLine[] {
    const lines: DraftReorderLine[] = [];
    for (const g of scope) {
      for (const l of g.lines) {
        const row = rows[lineKey(g.supplierId, l)];
        const qty = Number(row?.qty);
        if (row?.selected && Number.isFinite(qty) && qty > 0) {
          lines.push({
            variantId: l.variantId,
            warehouseId: l.warehouseId,
            supplierId: g.supplierId,
            quantity: Math.round(qty),
          });
        }
      }
    }
    return lines;
  }

  function draft(scope: ReorderGroup[]): void {
    setError(null);
    setCreated(null);
    const lines = collect(scope);
    if (lines.length === 0) {
      setError('Select at least one line with a quantity above zero.');
      return;
    }
    startTransition(async () => {
      const result = await draftReorderAction({ lines });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setCreated(result.data.purchaseOrders.map((po) => po.number));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {created && created.length > 0 ? (
        <Card className="border-success">
          <CardBody>
            <div className="flex flex-row items-center gap-2 py-1">
              <CheckCircle2 className="text-success h-4 w-4" />
              <p className="text-sm">
                Drafted {created.length} purchase order{created.length === 1 ? '' : 's'}:{' '}
                <span className="font-mono">{created.join(', ')}</span> — review and submit them on
                Purchase orders.
              </p>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {error ? <p className="text-danger text-sm">{error}</p> : null}

      {groups.length > 1 ? (
        <div className="flex flex-row flex-wrap items-center gap-3">
          <p className="text-base-content/70 text-sm">
            {groups.length} suppliers · draft a separate purchase order for each.
          </p>
          <Button
            color="module"
            size="sm"
            className="ml-auto"
            disabled={pending}
            onClick={() => draft(groups)}
          >
            {pending ? 'Drafting…' : 'Draft all suggested POs'}
          </Button>
        </div>
      ) : null}

      {groups.map((g) => (
        <GroupCard
          key={`${g.supplierId}-${g.warehouseId}`}
          group={g}
          rows={rows}
          pending={pending}
          onPatch={patch}
          onDraft={() => draft([g])}
        />
      ))}
    </div>
  );
}

function GroupCard({
  group: g,
  rows,
  pending,
  onPatch,
  onDraft,
}: {
  group: ReorderGroup;
  rows: Record<string, RowState>;
  pending: boolean;
  onPatch: (key: string, field: keyof RowState, value: string | boolean) => void;
  onDraft: () => void;
}) {
  const selectedTotal = g.lines.reduce((sum, l) => {
    const row = rows[lineKey(g.supplierId, l)];
    const qty = Number(row?.qty);
    if (row?.selected && Number.isFinite(qty) && qty > 0 && l.unitCostCents !== null) {
      return sum + l.unitCostCents * Math.round(qty);
    }
    return sum;
  }, 0);

  return (
    <Card>
      <CardBody>
        <div className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-row flex-wrap items-center gap-3">
            <Package className="h-5 w-5" />
            <div className="flex flex-col gap-0">
              <h3 className="text-xl font-semibold">{g.supplierName}</h3>
              <p className="text-base-content/70 text-xs">
                {g.warehouseName} · {g.lines.length} item{g.lines.length === 1 ? '' : 's'}
                {g.expectedArrivalAt ? ` · ETA ${formatDate(g.expectedArrivalAt)}` : ''}
              </p>
            </div>
          </div>
          <p className="text-base-content/70 text-sm">
            {selectedTotal > 0 ? formatMoney(selectedTotal, g.currency) : '—'} selected
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {g.lines.map((l) => (
            <LineRow
              key={l.variantId}
              line={l}
              currency={g.currency}
              row={rows[lineKey(g.supplierId, l)]}
              lineId={lineKey(g.supplierId, l)}
              onPatch={onPatch}
            />
          ))}
        </div>
        <CardActions>
          <Button color="module" className="ml-auto" disabled={pending} onClick={onDraft}>
            {pending ? 'Drafting…' : 'Draft purchase order'}
          </Button>
        </CardActions>
      </CardBody>
    </Card>
  );
}

function LineRow({
  line: l,
  currency,
  row,
  lineId,
  onPatch,
}: {
  line: ReorderSuggestionLine;
  currency: string;
  row: RowState | undefined;
  lineId: string;
  onPatch: (key: string, field: keyof RowState, value: string | boolean) => void;
}) {
  const selected = row?.selected ?? false;
  const qty = row?.qty ?? '';
  const lineCost =
    l.unitCostCents !== null && Number(qty) > 0 ? l.unitCostCents * Number(qty) : null;

  return (
    <div className="border-base-300 flex flex-row flex-wrap items-center gap-3 rounded border px-3 py-2">
      <Checkbox
        color="module"
        checked={selected}
        onChange={(e) => onPatch(lineId, 'selected', e.target.checked)}
        aria-label="Include in draft"
      />
      <div className="flex min-w-[12rem] flex-1 flex-col gap-0">
        <p className="text-sm font-medium">{l.title ?? l.sku ?? l.variantId.slice(0, 8)}</p>
        <p className="text-base-content/70 font-mono text-xs">
          {l.sku ?? l.variantId} · {l.available}/{l.reorderPoint} reorder pt
        </p>
      </div>
      {l.onOrder > 0 ? (
        <Badge color="info" variant="soft">
          {l.onOrder} on order
        </Badge>
      ) : null}
      <div className="flex w-[5.5rem] flex-col gap-0">
        <Input
          type="number"
          value={qty}
          aria-label="Order quantity"
          onChange={(e) => onPatch(lineId, 'qty', e.target.value)}
        />
      </div>
      <p className="text-base-content/70 w-[6rem] text-right text-sm">
        {l.unitCostCents !== null ? formatMoney(l.unitCostCents, currency) : '—'}
      </p>
      <p className="w-[6rem] text-right text-sm font-medium">
        {lineCost !== null ? formatMoney(lineCost, currency) : '—'}
      </p>
    </div>
  );
}

function initRows(groups: ReorderGroup[]): Record<string, RowState> {
  const rows: Record<string, RowState> = {};
  for (const g of groups) {
    for (const l of g.lines) {
      rows[lineKey(g.supplierId, l)] = {
        // Default OFF when already on order — don't double-order what's inbound.
        selected: l.onOrder === 0,
        qty: String(l.suggestedQuantity),
      };
    }
  }
  return rows;
}
