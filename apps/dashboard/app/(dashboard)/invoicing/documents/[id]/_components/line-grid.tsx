'use client';

// The structured line composer (docs/87 §6) — NOT a canvas. Each line is a typed
// charge: a line type (which carries pricing + tax behavior), description, qty,
// unit price, an optional cost basis (so margin shows), and a per-line taxable
// flag. Edits commit to the server per field (on blur / change) and refresh so the
// document's totals + AR status recompute. A locked stage (final/paid) freezes the
// grid to read-only.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Plus, Trash2 } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Stack,
  Text,
  useConfirm,
} from '@sparx/ui';

import { addLineAction, removeLineAction, updateLineAction } from '../../../document-actions';
import { formatMoney } from '../../../_components/format';

interface LineRow {
  id: string;
  lineTypeId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  costCents: number | null;
  taxable: boolean;
  lineTotal: number;
  markup: { ruleName: string | null; marginPct: number } | null;
}
interface LineTypeOption {
  id: string;
  key: string;
  label: string;
  pricingMode: string;
  defaultTaxable: boolean;
}

interface LineGridProps {
  documentId: string;
  currency: string;
  locked: boolean;
  lines: LineRow[];
  lineTypes: LineTypeOption[];
}

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-2 text-sm text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]';

export function LineGrid({ documentId, currency, locked, lines, lineTypes }: LineGridProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Stack direction="row" align="center" gap={2}>
            Line items
            <Badge variant="outline">{lines.length}</Badge>
            {locked && (
              <Badge color="neutral" variant="soft" className="text-xs">
                <Lock className="mr-1 h-3 w-3" /> Locked
              </Badge>
            )}
          </Stack>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Stack gap={3}>
          <div className="hidden grid-cols-12 gap-2 px-1 text-xs font-medium tracking-wide text-[var(--color-text-muted)] uppercase md:grid">
            <div className="col-span-2">Type</div>
            <div className="col-span-4">Description</div>
            <div className="col-span-1 text-right">Qty</div>
            <div className="col-span-2 text-right">Unit price</div>
            <div className="col-span-2 text-right">Line total</div>
            <div className="col-span-1" />
          </div>

          {lines.length === 0 && (
            <Text size="sm" variant="muted" className="px-1 py-2">
              No line items yet. Add the first charge below.
            </Text>
          )}

          {lines.map((line) => (
            <EditableLineRow
              key={line.id}
              documentId={documentId}
              currency={currency}
              locked={locked}
              line={line}
              lineTypes={lineTypes}
            />
          ))}

          {!locked && <AddLineRow documentId={documentId} lineTypes={lineTypes} />}
        </Stack>
      </CardContent>
    </Card>
  );
}

// ── Existing line (edit in place, commit on blur/change) ──────────────────────

function EditableLineRow({
  documentId,
  currency,
  locked,
  line,
  lineTypes,
}: {
  documentId: string;
  currency: string;
  locked: boolean;
  line: LineRow;
  lineTypes: LineTypeOption[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const currentType = lineTypes.find((t) => t.id === line.lineTypeId);

  function commit(patch: Record<string, unknown>) {
    startTransition(async () => {
      setError(null);
      const res = await updateLineAction(documentId, line.id, patch);
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      router.refresh();
    });
  }

  async function remove() {
    const ok = await confirm({
      title: 'Remove this line?',
      description: line.description ? `“${line.description}” will be removed.` : undefined,
      tone: 'danger',
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    startTransition(async () => {
      setError(null);
      const res = await removeLineAction(documentId, line.id);
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      router.refresh();
    });
  }

  if (locked) {
    return (
      <div className="grid grid-cols-12 items-center gap-2 rounded-md border border-[var(--color-border-default)] px-2 py-2">
        <div className="col-span-2 text-sm text-[var(--color-text-muted)]">
          {currentType?.label ?? '—'}
        </div>
        <div className="col-span-4 text-sm">{line.description}</div>
        <div className="col-span-1 text-right text-sm tabular-nums">{line.quantity}</div>
        <div className="col-span-2 text-right text-sm tabular-nums">
          {formatMoney(line.unitPrice, currency)}
        </div>
        <div className="col-span-3 text-right text-sm font-medium tabular-nums">
          {formatMoney(line.lineTotal, currency)}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[var(--color-border-default)] px-2 py-2">
      <div className="grid grid-cols-12 items-center gap-2">
        <div className="col-span-12 md:col-span-2">
          <select
            aria-label="Line type"
            className={SELECT_CLASS}
            defaultValue={line.lineTypeId ?? ''}
            disabled={pending}
            onChange={(e) => {
              const t = lineTypes.find((x) => x.id === e.target.value);
              if (t) commit({ lineTypeKey: t.key });
            }}
          >
            {!currentType && <option value="">(none)</option>}
            {lineTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-12 md:col-span-4">
          <Input
            aria-label="Description"
            defaultValue={line.description}
            disabled={pending}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== line.description) commit({ description: v });
            }}
          />
        </div>
        <div className="col-span-4 md:col-span-1">
          <Input
            aria-label="Quantity"
            type="number"
            min="0"
            step="0.001"
            className="text-right"
            defaultValue={line.quantity}
            disabled={pending}
            onBlur={(e) => {
              const v = Math.max(0, Number(e.target.value) || 0);
              if (v !== line.quantity) commit({ quantity: v });
            }}
          />
        </div>
        <div className="col-span-4 md:col-span-2">
          <Input
            aria-label="Unit price"
            type="number"
            min="0"
            step="0.01"
            className="text-right"
            defaultValue={line.unitPrice}
            disabled={pending}
            onBlur={(e) => {
              const v = Math.max(0, Number(e.target.value) || 0);
              if (v !== line.unitPrice) commit({ unitPrice: v });
            }}
          />
        </div>
        <div className="col-span-3 text-right text-sm font-medium tabular-nums md:col-span-2">
          {formatMoney(line.lineTotal, currency)}
        </div>
        <div className="col-span-1 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            shape="square"
            size="sm"
            disabled={pending}
            onClick={() => void remove()}
            aria-label="Remove line"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Stack direction="row" align="center" gap={3} className="mt-2 px-1" wrap>
        <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <input
            type="checkbox"
            defaultChecked={line.taxable}
            disabled={pending}
            onChange={(e) => commit({ taxable: e.target.checked })}
          />
          Taxable
        </label>
        {line.markup && (
          <Badge color="module" variant="soft" className="text-xs">
            {line.markup.ruleName ?? 'Markup'} · {line.markup.marginPct}% margin
          </Badge>
        )}
        {error && (
          <Text size="xs" variant="danger" role="alert">
            {error}
          </Text>
        )}
      </Stack>
    </div>
  );
}

// ── Add a line ────────────────────────────────────────────────────────────────

function AddLineRow({
  documentId,
  lineTypes,
}: {
  documentId: string;
  lineTypes: LineTypeOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const firstType = lineTypes[0];
  const [lineTypeKey, setLineTypeKey] = React.useState(firstType?.key ?? '');
  const [description, setDescription] = React.useState('');
  const [quantity, setQuantity] = React.useState('1');
  const [unitPrice, setUnitPrice] = React.useState('0');
  const [cost, setCost] = React.useState('');

  function reset() {
    setDescription('');
    setQuantity('1');
    setUnitPrice('0');
    setCost('');
  }

  function add() {
    if (!description.trim()) {
      setError('Add a description.');
      return;
    }
    const costNum = cost.trim() ? Number(cost) : null;
    const input = {
      lineTypeKey: lineTypeKey || undefined,
      description: description.trim(),
      quantity: Math.max(0.001, Number(quantity) || 1),
      unitPrice: Math.max(0, Number(unitPrice) || 0),
      ...(costNum != null && Number.isFinite(costNum)
        ? { explicitCostCents: Math.round(costNum * 100) }
        : {}),
    };
    startTransition(async () => {
      setError(null);
      const res = await addLineAction(documentId, input);
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      reset();
      router.refresh();
    });
  }

  return (
    <div className="rounded-md border border-dashed border-[var(--color-border-default)] px-2 py-3">
      <div className="grid grid-cols-12 items-end gap-2">
        <div className="col-span-12 md:col-span-2">
          <Label className="text-xs">Type</Label>
          <select
            className={SELECT_CLASS}
            value={lineTypeKey}
            disabled={pending}
            onChange={(e) => setLineTypeKey(e.target.value)}
          >
            {lineTypes.map((t) => (
              <option key={t.id} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-12 md:col-span-4">
          <Label className="text-xs">Description</Label>
          <Input
            value={description}
            disabled={pending}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this charge?"
          />
        </div>
        <div className="col-span-3 md:col-span-1">
          <Label className="text-xs">Qty</Label>
          <Input
            type="number"
            min="0"
            step="0.001"
            className="text-right"
            value={quantity}
            disabled={pending}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="col-span-4 md:col-span-2">
          <Label className="text-xs">Unit price</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            className="text-right"
            value={unitPrice}
            disabled={pending}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
        </div>
        <div className="col-span-3 md:col-span-2">
          <Label className="text-xs">Cost (opt.)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            className="text-right"
            value={cost}
            disabled={pending}
            onChange={(e) => setCost(e.target.value)}
            placeholder="—"
          />
        </div>
        <div className="col-span-2 flex justify-end md:col-span-1">
          <Button
            type="button"
            color="module"
            size="sm"
            shape="square"
            disabled={pending}
            onClick={add}
            aria-label="Add line"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {error && (
        <Text size="xs" variant="danger" className="mt-2" role="alert">
          {error}
        </Text>
      )}
    </div>
  );
}
