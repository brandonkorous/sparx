'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Heading,
  Input,
  Label,
  Stack,
  Text,
} from '@sparx/ui';

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
      <CardHeader>
        <Stack direction="row" align="center" justify="between" wrap gap={3}>
          <Heading level={3}>Lines</Heading>
          {editable && (
            <Button variant="outline" size="sm" disabled={pending} onClick={matchExpected}>
              Match expected
            </Button>
          )}
        </Stack>
      </CardHeader>
      <CardContent>
        <Stack gap={2}>
          {lines.length === 0 ? (
            <Text size="sm" variant="muted">
              No lines on this count yet{editable ? ' — add a SKU below.' : '.'}
            </Text>
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
        </Stack>
      </CardContent>
      {editable && (
        <CardFooter>
          <Stack direction="row" gap={3} align="center" justify="between" className="w-full">
            <Stack direction="row" align="center" gap={2}>
              {error && (
                <Text size="sm" className="text-[var(--color-danger)]">
                  {error}
                </Text>
              )}
              {saved && !error && (
                <Stack direction="row" align="center" gap={1}>
                  <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />
                  <Text size="sm" variant="muted">
                    Counts saved
                  </Text>
                </Stack>
              )}
            </Stack>
            <Button color="module" disabled={pending} onClick={saveCounts}>
              {pending ? 'Saving…' : 'Save counts'}
            </Button>
          </Stack>
        </CardFooter>
      )}
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
    <Stack
      direction="row"
      align="center"
      gap={3}
      wrap
      className="rounded border border-[var(--color-border-default)] px-3 py-2"
    >
      <Stack gap={0} className="min-w-[12rem] flex-1">
        <Text size="sm" className="font-medium">
          {l.productTitle ?? l.variantSku ?? l.variantId.slice(0, 8)}
        </Text>
        <Text size="xs" variant="muted" className="font-mono">
          {l.variantSku ?? l.variantId}
        </Text>
      </Stack>

      <Stat label="Expected" value={String(l.expectedQuantity)} />

      {editable ? (
        <Stack gap={0} className="w-[5.5rem]">
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
        </Stack>
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
          <Stack direction="row" gap={1} align="center">
            <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setArmed(false)}>
              Keep
            </Button>
            <Button color="danger" size="sm" disabled={disabled} onClick={onRemove}>
              Remove
            </Button>
          </Stack>
        ) : (
          <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setArmed(true)}>
            Remove
          </Button>
        ))}
    </Stack>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'pos' | 'neg' }) {
  const color =
    tone === 'pos'
      ? 'text-[var(--color-success)]'
      : tone === 'neg'
        ? 'text-[var(--color-danger)]'
        : undefined;
  return (
    <Stack gap={0} className="w-[5rem] text-right">
      <Text size="xs" variant="muted">
        {label}
      </Text>
      <Text size="sm" className={color ? `font-medium ${color}` : 'font-medium'}>
        {value}
      </Text>
    </Stack>
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
    <Stack gap={2}>
      <Stack
        direction="row"
        gap={3}
        align="end"
        wrap
        className="rounded border border-dashed border-[var(--color-border-default)] p-3"
      >
        <Stack gap={1} className="min-w-[12rem] flex-1">
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
        </Stack>
        <Button color="module" type="button" onClick={add} disabled={busy || disabled}>
          {busy ? 'Adding…' : 'Add item'}
        </Button>
      </Stack>
      {error && (
        <Text size="sm" className="text-[var(--color-danger)]">
          {error}
        </Text>
      )}
    </Stack>
  );
}

function initCounts(lines: InventoryCountLineRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of lines) out[l.id] = l.countedQuantity === null ? '' : String(l.countedQuantity);
  return out;
}
