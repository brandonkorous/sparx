'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Button,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  NativeSelect,
} from '@wizeworks/silicaui-react';
import { useFieldValidation } from '@sparx/forms';

import { adjustInventoryAction, setReorderPolicyAction } from '../../_lib/inventory-actions';

const REASONS = [
  'recount',
  'receive',
  'loss',
  'damage',
  'manual',
  'transfer_in',
  'transfer_out',
] as const;

export interface InventoryRow {
  variantId: string;
  warehouseId: string;
  warehouseCode: string;
  onHand: number;
  allocated: number;
  available: number;
  reorderPoint: number | null;
  reorderQuantity: number | null;
  leadTimeDays: number | null;
  sku: string;
  variantTitle: string | null;
  productId: string;
  productTitle: string;
}

// Cell-friendly inventory editor — the interactive island reused by the
// inventory list in BOTH the table (an "Actions" column cell) and card views.
// Renders the Adjust / Reorder buttons and an inline expandable form panel
// below them (no row-spanning <TableRow>, so it drops into a <TableCell> or a
// card body unchanged). Every adjustment is recorded as an audited change.
export function InventoryRowControls({
  row,
  warehouseId,
}: {
  row: InventoryRow;
  warehouseId: string;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<'view' | 'adjust' | 'reorder'>('view');
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [delta, setDelta] = React.useState('0');
  const [reason, setReason] = React.useState('manual');
  const [note, setNote] = React.useState('');
  const [reorderPoint, setReorderPoint] = React.useState(row.reorderPoint?.toString() ?? '0');
  const [reorderQuantity, setReorderQuantity] = React.useState(
    row.reorderQuantity?.toString() ?? ''
  );
  const [leadTimeDays, setLeadTimeDays] = React.useState(row.leadTimeDays?.toString() ?? '');

  const adjustV = useFieldValidation(
    { delta },
    {
      delta: (val) => {
        const n = Number(String(val).trim());
        if (!Number.isFinite(n)) return 'Enter a number.';
        if (n === 0) return 'Delta must be a non-zero number.';
        return null;
      },
    }
  );

  const reorderV = useFieldValidation(
    { reorderPoint, reorderQuantity, leadTimeDays },
    {
      reorderPoint: (val) => {
        const n = Number(String(val).trim());
        return Number.isFinite(n) && n >= 0 ? null : 'Reorder point must be 0 or higher.';
      },
      reorderQuantity: (val) => {
        const n = Number(String(val).trim());
        return Number.isFinite(n) && n > 0 ? null : 'Reorder quantity must be positive.';
      },
      leadTimeDays: (val) => {
        const s = String(val).trim();
        if (s === '') return null;
        const n = Number(s);
        return Number.isFinite(n) && n >= 0 ? null : 'Lead time must be 0 or higher.';
      },
    }
  );

  function onAdjust(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!adjustV.validate()) return;
    startTransition(async () => {
      const result = await adjustInventoryAction({
        variantId: row.variantId,
        warehouseId,
        delta: Number(delta.trim()),
        reason,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setMode('view');
      router.refresh();
    });
  }

  function onSetReorder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!reorderV.validate()) return;
    const input: Record<string, unknown> = {
      variantId: row.variantId,
      warehouseId,
      reorderPoint: Number(reorderPoint.trim()),
      reorderQuantity: Number(reorderQuantity.trim()),
    };
    const leadTrim = leadTimeDays.trim();
    if (leadTrim) input.leadTimeDays = Number(leadTrim);
    startTransition(async () => {
      const result = await setReorderPolicyAction(input);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setMode('view');
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-row gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMode(mode === 'adjust' ? 'view' : 'adjust')}
        >
          Adjust
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMode(mode === 'reorder' ? 'view' : 'reorder')}
        >
          Reorder
        </Button>
      </div>

      {mode === 'adjust' && (
        <form onSubmit={onAdjust} className="bg-base-200 rounded p-3">
          <div className="flex flex-row flex-wrap items-end gap-3">
            <Field className="w-[6rem]" {...adjustV.field('delta')}>
              <FieldLabel>Delta (±)</FieldLabel>
              <FieldControl
                type="number"
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                {...adjustV.control('delta')}
              />
            </Field>
            <Field>
              <FieldLabel>Reason</FieldLabel>
              <FieldControl
                render={
                  <NativeSelect>
                    {REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </NativeSelect>
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <Field className="min-w-[14rem] flex-1">
              <FieldLabel>Note (optional)</FieldLabel>
              <FieldControl
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. damaged in transit, recount after audit"
              />
            </Field>
            <div className="flex flex-row gap-2">
              <Button variant="ghost" size="sm" type="button" onClick={() => setMode('view')}>
                Cancel
              </Button>
              <Button color="module" size="sm" type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Apply'}
              </Button>
            </div>
          </div>
          {error && (
            <FieldStatus
              status="error"
              attached={false}
              role="alert"
              aria-live="polite"
              className="mt-2"
            >
              {error}
            </FieldStatus>
          )}
        </form>
      )}

      {mode === 'reorder' && (
        <form onSubmit={onSetReorder} className="bg-base-200 rounded p-3">
          <div className="flex flex-row flex-wrap items-end gap-3">
            <Field className="w-[6rem]" {...reorderV.field('reorderPoint')}>
              <FieldLabel>Reorder point</FieldLabel>
              <FieldControl
                type="number"
                min={0}
                value={reorderPoint}
                onChange={(e) => setReorderPoint(e.target.value)}
                {...reorderV.control('reorderPoint')}
              />
            </Field>
            <Field className="w-[6rem]" {...reorderV.field('reorderQuantity')}>
              <FieldLabel>Reorder qty</FieldLabel>
              <FieldControl
                type="number"
                min={0}
                value={reorderQuantity}
                onChange={(e) => setReorderQuantity(e.target.value)}
                {...reorderV.control('reorderQuantity')}
              />
            </Field>
            <Field className="w-[8rem]" {...reorderV.field('leadTimeDays')}>
              <FieldLabel>Lead time (days)</FieldLabel>
              <FieldControl
                type="number"
                min={0}
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(e.target.value)}
                {...reorderV.control('leadTimeDays')}
              />
            </Field>
            <div className="flex flex-row gap-2">
              <Button variant="ghost" size="sm" type="button" onClick={() => setMode('view')}>
                Cancel
              </Button>
              <Button color="module" size="sm" type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Save policy'}
              </Button>
            </div>
          </div>
          {error && (
            <FieldStatus
              status="error"
              attached={false}
              role="alert"
              aria-live="polite"
              className="mt-2"
            >
              {error}
            </FieldStatus>
          )}
        </form>
      )}
    </div>
  );
}
