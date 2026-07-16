'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardActions,
  CardBody,
  Input,
  Label,
} from '@wizeworks/silicaui-react';

import {
  addCountLineAction,
  enterCountsAction,
  removeCountLineAction,
} from '../../../_lib/count-actions';
import { lookupVariantBySkuAction } from '../../../_lib/supplier-actions';
import { formatDelta, formatMoney, type InventoryCountLineRow } from '../../_components/types';

// The count lines surface (docs/100 P4). While `counting`: an editable counted
// quantity per line (live variance), add-by-SKU (cycle), remove, and a "Match
// expected" helper, saved in bulk. Once submitted it is read-only — after posting
// it shows the applied delta (which may differ from the count-time variance when
// stock moved mid-count).

export function CountLinesPanel({
  id,
  type,
  status,
  lines,
}: {
  id: string;
  type: 'cycle' | 'full';
  status: string;
  lines: InventoryCountLineRow[];
}) {
  const router = useRouter();
  const editable = status === 'counting';
  const posted = status === 'posted';
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [counts, setCounts] = React.useState<Record<string, string>>(() => initCounts(lines));

  // Re-seed from the server after a save / add / remove refresh.
  const signature = lines.map((l) => `${l.id}:${l.countedQuantity ?? ''}`).join('|');
  React.useEffect(() => {
    setCounts(initCounts(lines));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signature captures lines
  }, [signature]);

  function setCount(lineId: string, value: string) {
    setSaved(false);
    setCounts((prev) => ({ ...prev, [lineId]: value }));
  }

  function matchExpected() {
    setSaved(false);
    setCounts((prev) => {
      const next = { ...prev };
      for (const l of lines) {
        const current = next[l.id];
        // Fill only the still-blank lines — don't overwrite an entered count.
        if (current === undefined || current.trim() === '') {
          next[l.id] = String(l.expectedQuantity);
        }
      }
      return next;
    });
  }

  function saveCounts() {
    setError(null);
    const entries = lines
      .map((l) => ({ lineId: l.id, raw: counts[l.id] ?? '' }))
      .filter((e) => e.raw.trim() !== '')
      .map((e) => ({ lineId: e.lineId, countedQuantity: Math.round(Number(e.raw)) }))
      .filter((e) => Number.isFinite(e.countedQuantity) && e.countedQuantity >= 0);
    if (entries.length === 0) {
      setError('Enter at least one counted quantity.');
      return;
    }
    startTransition(async () => {
      const result = await enterCountsAction(id, { entries });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  function removeLine(lineId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeCountLineAction(id, lineId);
      if (!result.ok) setError(result.error.message);
      else router.refresh();
    });
  }

  return (
    <Card>
      <CardBody>
        <div className="flex flex-row flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-semibold">Lines</h3>
          {editable && (
            <Button variant="outline" size="sm" disabled={pending} onClick={matchExpected}>
              Match expected
            </Button>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {lines.length === 0 ? (
            <p className="text-base-content text-sm">
              No lines on this count yet{editable ? ' — add a SKU below.' : '.'}
            </p>
          ) : (
            lines.map((l) => (
              <LineRow
                key={l.id}
                line={l}
                editable={editable}
                posted={posted}
                value={counts[l.id] ?? ''}
                disabled={pending}
                onChange={(v) => setCount(l.id, v)}
                onRemove={() => removeLine(l.id)}
              />
            ))
          )}
          {editable && type === 'cycle' && <AddLineRow id={id} disabled={pending} />}
        </div>
        {editable && (
          <CardActions>
            <div className="flex w-full flex-row items-center justify-between gap-3">
              <div className="flex flex-row items-center gap-2">
                {error && <p className="text-danger text-sm">{error}</p>}
                {saved && !error && (
                  <div className="flex flex-row items-center gap-1">
                    <CheckCircle2 className="text-success h-4 w-4" />
                    <p className="text-base-content text-sm">Counts saved</p>
                  </div>
                )}
              </div>
              <Button color="module" disabled={pending} onClick={saveCounts}>
                {pending ? 'Saving…' : 'Save counts'}
              </Button>
            </div>
          </CardActions>
        )}
      </CardBody>
    </Card>
  );
}

function LineRow({
  line: l,
  editable,
  posted,
  value,
  disabled,
  onChange,
  onRemove,
}: {
  line: InventoryCountLineRow;
  editable: boolean;
  posted: boolean;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onRemove: () => void;
}) {
  const [armed, setArmed] = React.useState(false);
  const counted = editable
    ? value.trim() === ''
      ? null
      : Math.round(Number(value))
    : l.countedQuantity;
  const variance = counted === null || Number.isNaN(counted) ? null : counted - l.expectedQuantity;
  const valueCents =
    variance !== null && l.unitCostCents !== null ? Math.abs(variance) * l.unitCostCents : null;

  return (
    <div className="border-base-300 flex flex-row flex-wrap items-center gap-3 rounded border px-3 py-2">
      <div className="flex min-w-[12rem] flex-1 flex-col gap-0">
        <p className="text-sm font-medium">
          {l.productTitle ?? l.variantSku ?? l.variantId.slice(0, 8)}
        </p>
        <p className="text-base-content font-mono text-xs">{l.variantSku ?? l.variantId}</p>
      </div>

      <Stat label="Expected" value={String(l.expectedQuantity)} />

      {editable ? (
        <div className="flex w-[5.5rem] flex-col gap-0">
          <Label htmlFor={`cnt-${l.id}`} className="sr-only">
            Counted
          </Label>
          <Input
            id={`cnt-${l.id}`}
            type="number"
            value={value}
            placeholder="—"
            aria-label="Counted quantity"
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      ) : (
        <Stat label="Counted" value={counted === null ? '—' : String(counted)} />
      )}

      <Stat
        label="Variance"
        value={variance === null ? '—' : formatDelta(variance)}
        tone={variance ? (variance > 0 ? 'pos' : 'neg') : undefined}
      />
      <Stat label="Value" value={valueCents === null ? '—' : formatMoney(valueCents)} />

      {posted && l.appliedDelta !== null ? (
        <Badge color={l.appliedDelta === 0 ? 'neutral' : 'info'} variant="soft">
          applied {formatDelta(l.appliedDelta)}
        </Badge>
      ) : null}

      {editable &&
        (armed ? (
          <div className="flex flex-row items-center gap-1">
            <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setArmed(false)}>
              Keep
            </Button>
            <Button color="danger" size="sm" disabled={disabled} onClick={onRemove}>
              Remove
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setArmed(true)}>
            Remove
          </Button>
        ))}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'pos' | 'neg' }) {
  const color = tone === 'pos' ? 'text-success' : tone === 'neg' ? 'text-danger' : undefined;
  return (
    <div className="flex w-[5rem] flex-col gap-0 text-right">
      <p className="text-base-content text-xs">{label}</p>
      <p className={color ? `text-sm font-medium ${color}` : 'text-sm font-medium'}>{value}</p>
    </div>
  );
}

function AddLineRow({ id, disabled }: { id: string; disabled: boolean }) {
  const router = useRouter();
  const [value, setValue] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function add() {
    const sku = value.trim();
    if (!sku) {
      setError('Enter a variant SKU.');
      return;
    }
    setError(null);
    setBusy(true);
    void (async () => {
      const lookup = await lookupVariantBySkuAction(sku);
      if (!lookup.ok) {
        setError(`No variant found for SKU "${sku}".`);
        setBusy(false);
        return;
      }
      const result = await addCountLineAction(id, { variantId: lookup.data.variantId });
      if (!result.ok) {
        setError(result.error.message);
        setBusy(false);
        return;
      }
      setValue('');
      setBusy(false);
      router.refresh();
    })();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="border-base-300 flex flex-row flex-wrap items-end gap-3 rounded border border-dashed p-3">
        <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <Label htmlFor="count-line-sku">Add item by SKU</Label>
          <Input
            id="count-line-sku"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder="e.g. FUEL-FILTER-1"
          />
        </div>
        <Button color="module" type="button" onClick={add} disabled={busy || disabled}>
          {busy ? 'Adding…' : 'Add item'}
        </Button>
      </div>
      {error && <p className="text-danger text-sm">{error}</p>}
    </div>
  );
}

function initCounts(lines: InventoryCountLineRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of lines) out[l.id] = l.countedQuantity === null ? '' : String(l.countedQuantity);
  return out;
}
