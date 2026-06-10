'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Play, Plus, Trash2 } from 'lucide-react';

import { applyMarkupRule, type MarkupRuleSpec } from '@sparx/commerce-schemas';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Heading,
  Input,
  NativeSelect,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  useConfirm,
} from '@sparx/ui';

import {
  applyMarkupRuleAction,
  createMarkupRuleAction,
  deleteMarkupRuleAction,
  previewMarkupRuleAction,
  updateMarkupRuleAction,
} from '../../markup-actions';

// ─── Types mirrored from the markupService row ─────────────────────────

interface RoundingSpec {
  strategy: 'none' | 'nearest' | 'charm';
  precisionCents?: number | null;
  endingCents?: number | null;
}
interface Scope {
  type: 'all' | 'collection' | 'product_type' | 'vendor' | 'products';
  value?: string;
  ids?: string[];
}
export interface CollectionOption {
  id: string;
  name: string;
}
type BandMethod = 'percentage' | 'multiplier' | 'flat' | 'margin_target';
interface MatrixBand {
  costMinCents: number;
  costMaxCents: number | null;
  method: BandMethod;
  value: number;
}
export interface MarkupRuleRow {
  id: string;
  name: string;
  method: 'percentage' | 'multiplier' | 'flat' | 'margin_target' | 'matrix';
  value: number | null;
  bands: unknown[];
  costBasis: 'variant_cost' | 'supplier_cost' | 'average_cost' | 'last_po_cost';
  rounding: RoundingSpec;
  floorProfitCents: number | null;
  floorMargin: number | null;
  ceilingSrc: 'none' | 'compare_at' | 'msrp' | 'fixed';
  ceilingValueCents: number | null;
  appliesTo: 'catalog' | 'document' | 'both';
  scope: Scope;
  priority: number;
  isActive: boolean;
  boundVariantCount: number;
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const fmt = (cents: number | null | undefined) => (cents == null ? '—' : money.format(cents / 100));

// ─── Method ⇄ display-value conversions (docs/48 §2) ────────────────────
// percentage / margin_target store a fraction (0.40); the form shows a percent.
// multiplier stores the factor; flat stores dollars.
function toDisplayValue(method: string, stored: number | null): string {
  if (stored == null) return '';
  if (method === 'percentage' || method === 'margin_target') return String(stored * 100);
  return String(stored);
}
function toStoredValue(method: string, display: string): number | null {
  const n = Number(display);
  if (!Number.isFinite(n)) return null;
  if (method === 'percentage' || method === 'margin_target') return n / 100;
  return n;
}

// ─── Matrix band editing (docs/48 §3.4) ─────────────────────────────────
// A matrix prices each cost tier by its own sub-method. The form edits dollars
// + a display value per band; submit converts to the cents/fraction the engine
// stores. The top band may leave its upper bound blank (open-ended).

interface BandRowState {
  minStr: string; // dollars
  maxStr: string; // dollars; '' = open-ended top band
  method: BandMethod;
  valueStr: string; // display value, per-method unit
}

function emptyBandRow(): BandRowState {
  return { minStr: '0', maxStr: '', method: 'percentage', valueStr: '' };
}

function bandsToRows(bands: MatrixBand[]): BandRowState[] {
  if (!bands || bands.length === 0) return [emptyBandRow()];
  return bands.map((b) => ({
    minStr: String(b.costMinCents / 100),
    maxStr: b.costMaxCents == null ? '' : String(b.costMaxCents / 100),
    method: b.method,
    valueStr: toDisplayValue(b.method, b.value),
  }));
}

/** Convert the editable rows to engine bands, or null if any row is invalid. */
function rowsToBands(rows: BandRowState[]): MatrixBand[] | null {
  const out: MatrixBand[] = [];
  for (const r of rows) {
    const min = Math.round(Number(r.minStr) * 100);
    const max = r.maxStr.trim() === '' ? null : Math.round(Number(r.maxStr) * 100);
    const value = toStoredValue(r.method, r.valueStr);
    if (!Number.isFinite(min) || value == null) return null;
    if (max != null && (!Number.isFinite(max) || max < min)) return null;
    out.push({ costMinCents: Math.max(0, min), costMaxCents: max, method: r.method, value });
  }
  return out.length > 0 ? out : null;
}

const BAND_UNIT: Record<BandMethod, string> = {
  percentage: '% over cost',
  margin_target: '% margin',
  multiplier: '× mult',
  flat: '$ flat',
};

function MatrixBandsEditor({
  rows,
  onChange,
}: {
  rows: BandRowState[];
  onChange: (rows: BandRowState[]) => void;
}) {
  function patch(i: number, next: Partial<BandRowState>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...next } : r)));
  }
  function add() {
    const last = rows[rows.length - 1];
    const nextMin = last && last.maxStr.trim() !== '' ? last.maxStr : '';
    onChange([...rows, { ...emptyBandRow(), minStr: nextMin || '0' }]);
  }
  function remove(i: number) {
    onChange(rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows);
  }

  return (
    <Stack gap={2}>
      <Text size="xs" variant="muted" weight="medium">
        Cost bands
      </Text>
      <Stack gap={2}>
        {rows.map((r, i) => (
          <Stack key={i} direction="row" gap={2} align="end" wrap>
            <Field label="Cost ≥ ($)" className="w-28">
              <Input
                type="number"
                inputMode="decimal"
                step="any"
                value={r.minStr}
                onChange={(e) => patch(i, { minStr: e.target.value })}
              />
            </Field>
            <Field label="Cost < ($)" className="w-28">
              <Input
                type="number"
                inputMode="decimal"
                step="any"
                value={r.maxStr}
                onChange={(e) => patch(i, { maxStr: e.target.value })}
                placeholder="∞"
              />
            </Field>
            <Field label="Method" className="w-40">
              <NativeSelect
                value={r.method}
                onChange={(e) => patch(i, { method: e.target.value as BandMethod })}
              >
                <option value="percentage">Percentage</option>
                <option value="multiplier">Multiplier</option>
                <option value="flat">Flat</option>
                <option value="margin_target">Target margin</option>
              </NativeSelect>
            </Field>
            <Field label={BAND_UNIT[r.method]} className="w-28">
              <Input
                type="number"
                inputMode="decimal"
                step="any"
                value={r.valueStr}
                onChange={(e) => patch(i, { valueStr: e.target.value })}
              />
            </Field>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              color="danger"
              className="mb-1"
              leftIcon={<Trash2 className="h-3.5 w-3.5" />}
              onClick={() => remove(i)}
              disabled={rows.length === 1}
              aria-label={`Remove band ${i + 1}`}
            >
              Remove
            </Button>
          </Stack>
        ))}
      </Stack>
      <div>
        <Button
          type="button"
          size="xs"
          variant="outline"
          leftIcon={<Plus className="h-3.5 w-3.5" />}
          onClick={add}
        >
          Add band
        </Button>
      </div>
      <Text size="xs" variant="muted">
        Bands are matched low → high by cost. Leave the top band’s upper bound blank for open-ended.
        A cost outside every band clamps to the nearest.
      </Text>
    </Stack>
  );
}

function methodSummary(r: MarkupRuleRow): string {
  switch (r.method) {
    case 'percentage':
      return `+${((r.value ?? 0) * 100).toFixed(0)}%`;
    case 'multiplier':
      return `×${r.value ?? 0}`;
    case 'flat':
      return `+${money.format(r.value ?? 0)}`;
    case 'margin_target':
      return `${((r.value ?? 0) * 100).toFixed(0)}% margin`;
    case 'matrix':
      return `matrix (${r.bands.length} bands)`;
  }
}

function scopeSummary(s: Scope): string {
  switch (s.type) {
    case 'all':
      return 'All products';
    case 'product_type':
      return `Type: ${s.value}`;
    case 'vendor':
      return `Vendor: ${s.value}`;
    case 'collection':
      return `${s.ids?.length ?? 0} collection(s)`;
    case 'products':
      return `${s.ids?.length ?? 0} product(s)`;
  }
}

// ─── Manager ────────────────────────────────────────────────────────────

export function MarkupRulesManager({
  initialRules,
  collections,
}: {
  initialRules: MarkupRuleRow[];
  collections: CollectionOption[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = React.useState<MarkupRuleRow | 'new' | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function onApply(rule: MarkupRuleRow) {
    setError(null);
    setNotice(null);
    setBusyId(rule.id);
    try {
      const preview = await previewMarkupRuleAction(rule.id);
      if (!preview.ok) {
        setError(preview.error.message);
        return;
      }
      const p = preview.data;
      const ok = await confirm({
        title: `Apply "${rule.name}" to ${p.totalVariants} variant(s)?`,
        description: `${p.pricedVariants} will be repriced from cost${
          p.unpriceableVariants > 0
            ? `, ${p.unpriceableVariants} have no cost and will be skipped`
            : ''
        }${p.truncated ? ' (showing a sample; the full scope is larger)' : ''}. This rewrites their list price.`,
        confirmLabel: 'Apply markup',
        tone: 'module',
      });
      if (!ok) return;
      const applied = await applyMarkupRuleAction(rule.id);
      if (!applied.ok) {
        setError(applied.error.message);
        return;
      }
      setNotice(
        `Repriced ${applied.data.applied} variant(s)${
          applied.data.skipped > 0 ? `, skipped ${applied.data.skipped} without a cost` : ''
        }${applied.data.capped ? ' (capped — re-run to finish the rest)' : ''}.`
      );
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(rule: MarkupRuleRow) {
    const ok = await confirm({
      title: `Delete "${rule.name}"?`,
      description:
        rule.boundVariantCount > 0
          ? `${rule.boundVariantCount} variant(s) are priced by this rule. They keep their current price but detach to manual pricing.`
          : 'This markup rule will be removed.',
      confirmLabel: 'Delete rule',
      tone: 'danger',
    });
    if (!ok) return;
    setError(null);
    setNotice(null);
    setBusyId(rule.id);
    try {
      const res = await deleteMarkupRuleAction(rule.id);
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Stack gap={5}>
      {notice && (
        <Text size="sm" variant="success" role="status">
          {notice}
        </Text>
      )}
      {error && (
        <Text size="sm" variant="danger" role="alert">
          {error}
        </Text>
      )}

      {editing && (
        <RuleForm
          key={editing === 'new' ? 'new' : editing.id}
          rule={editing === 'new' ? null : editing}
          collections={collections}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      <Card>
        <CardHeader>
          <Stack direction="row" align="center" justify="between" wrap gap={3}>
            <Heading level={3}>Rules</Heading>
            {!editing && (
              <Button
                color="module"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => setEditing('new')}
              >
                New rule
              </Button>
            )}
          </Stack>
        </CardHeader>
        <CardContent>
          {initialRules.length === 0 ? (
            <Text variant="muted" className="py-6 text-center">
              No markup rules yet. Create one to price products from their cost.
            </Text>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Cost basis</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead className="text-right">Bound</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialRules.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Text weight="medium">{r.name}</Text>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{methodSummary(r)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Text size="sm" variant="muted">
                        {r.costBasis === 'supplier_cost' ? 'Supplier cost' : 'Variant cost'}
                      </Text>
                    </TableCell>
                    <TableCell>
                      <Text size="sm" variant="muted">
                        {scopeSummary(r.scope)}
                      </Text>
                    </TableCell>
                    <TableCell className="text-right">{r.boundVariantCount}</TableCell>
                    <TableCell>
                      {r.isActive ? (
                        <Badge color="success" variant="outline">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline">Paused</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Stack direction="row" gap={1} justify="end">
                        <Button
                          size="xs"
                          variant="ghost"
                          color="module"
                          leftIcon={<Play className="h-3.5 w-3.5" />}
                          disabled={busyId === r.id || r.appliesTo === 'document'}
                          onClick={() => onApply(r)}
                          title={
                            r.appliesTo === 'document'
                              ? 'Document-only rules are applied on invoices, not the catalog'
                              : 'Preview and apply across this rule’s scope'
                          }
                        >
                          Apply
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          leftIcon={<Pencil className="h-3.5 w-3.5" />}
                          disabled={busyId === r.id}
                          onClick={() => setEditing(r)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          color="danger"
                          leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                          disabled={busyId === r.id}
                          onClick={() => onDelete(r)}
                        >
                          Delete
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}

// ─── Create / edit form ─────────────────────────────────────────────────

function RuleForm({
  rule,
  collections,
  onClose,
  onSaved,
}: {
  rule: MarkupRuleRow | null;
  collections: CollectionOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState(rule?.name ?? '');
  const [method, setMethod] = React.useState(rule?.method ?? 'percentage');
  const [valueStr, setValueStr] = React.useState(
    rule ? toDisplayValue(rule.method, rule.value) : ''
  );
  const [bands, setBands] = React.useState<BandRowState[]>(() =>
    rule?.method === 'matrix' ? bandsToRows(rule.bands as MatrixBand[]) : [emptyBandRow()]
  );
  const [collectionIds, setCollectionIds] = React.useState<string[]>(() =>
    rule?.scope?.type === 'collection' ? (rule.scope.ids ?? []) : []
  );
  const [costBasis, setCostBasis] = React.useState(rule?.costBasis ?? 'variant_cost');
  const [roundStrategy, setRoundStrategy] = React.useState(rule?.rounding?.strategy ?? 'none');
  const [roundPrecision, setRoundPrecision] = React.useState(
    String(rule?.rounding?.precisionCents ?? 100)
  );
  const [roundEnding, setRoundEnding] = React.useState(String(rule?.rounding?.endingCents ?? 99));
  const [floorProfit, setFloorProfit] = React.useState(
    rule?.floorProfitCents != null ? String(rule.floorProfitCents / 100) : ''
  );
  const [floorMargin, setFloorMargin] = React.useState(
    rule?.floorMargin != null ? String(rule.floorMargin) : ''
  );
  const [ceilingSrc, setCeilingSrc] = React.useState(rule?.ceilingSrc ?? 'none');
  const [ceilingValue, setCeilingValue] = React.useState(
    rule?.ceilingValueCents != null ? String(rule.ceilingValueCents / 100) : ''
  );
  const [appliesTo, setAppliesTo] = React.useState(rule?.appliesTo ?? 'catalog');
  const [scopeType, setScopeType] = React.useState(rule?.scope?.type ?? 'all');
  const [scopeValue, setScopeValue] = React.useState(rule?.scope?.value ?? '');
  const [isActive, setIsActive] = React.useState(rule?.isActive ?? true);
  const [sampleDollars, setSampleDollars] = React.useState('10.00');

  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const isMatrix = method === 'matrix';
  const valueUnit =
    method === 'percentage'
      ? '% over cost'
      : method === 'margin_target'
        ? '% margin'
        : method === 'multiplier'
          ? '× multiplier'
          : '$ flat';

  // Live readout against a sample cost (docs/48 §2 binding rule: show both).
  const preview = React.useMemo(() => {
    const sampleCents = Math.round((Number(sampleDollars) || 0) * 100);
    const matrixBands = isMatrix ? rowsToBands(bands) : null;
    const spec: MarkupRuleSpec = {
      method,
      value: isMatrix ? null : toStoredValue(method, valueStr),
      bands: matrixBands ?? undefined,
      rounding:
        roundStrategy === 'none'
          ? null
          : {
              strategy: roundStrategy,
              precisionCents: roundStrategy === 'nearest' ? Number(roundPrecision) : null,
              endingCents: roundStrategy === 'charm' ? Number(roundEnding) : null,
            },
      floorProfitCents: floorProfit ? Math.round(Number(floorProfit) * 100) : null,
      floorMargin: floorMargin ? Number(floorMargin) : null,
      ceilingSrc,
      ceilingValueCents: ceilingValue ? Math.round(Number(ceilingValue) * 100) : null,
    };
    if (!Number.isFinite(sampleCents)) return null;
    if (isMatrix ? !matrixBands : spec.value == null) return null;
    try {
      return applyMarkupRule(sampleCents, spec, { compareAtCents: null, msrpCents: null });
    } catch {
      return null;
    }
  }, [
    method,
    valueStr,
    bands,
    roundStrategy,
    roundPrecision,
    roundEnding,
    floorProfit,
    floorMargin,
    ceilingSrc,
    ceilingValue,
    sampleDollars,
    isMatrix,
  ]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    let value: number | null = null;
    let matrixBands: MatrixBand[] | null = null;
    if (isMatrix) {
      matrixBands = rowsToBands(bands);
      if (!matrixBands) {
        setError(
          'Each band needs a min cost and a value; an upper bound, if set, must be ≥ the min.'
        );
        return;
      }
    } else {
      value = toStoredValue(method, valueStr);
      if (value == null) {
        setError('Enter a valid value for this method.');
        return;
      }
    }

    let scope: Scope;
    if (scopeType === 'all') {
      scope = { type: 'all' };
    } else if (scopeType === 'collection') {
      if (collectionIds.length === 0) {
        setError('Pick at least one collection to scope to.');
        return;
      }
      scope = { type: 'collection', ids: collectionIds };
    } else if (scopeType === 'product_type') {
      if (!scopeValue.trim()) {
        setError('Enter the product type to scope to.');
        return;
      }
      scope = { type: 'product_type', value: scopeValue.trim() };
    } else {
      if (!scopeValue.trim()) {
        setError('Enter the vendor to scope to.');
        return;
      }
      scope = { type: 'vendor', value: scopeValue.trim() };
    }

    const payload = {
      name: name.trim(),
      method,
      ...(isMatrix ? { value: null, bands: matrixBands } : { value }),
      costBasis,
      rounding:
        roundStrategy === 'none'
          ? { strategy: 'none' as const }
          : roundStrategy === 'nearest'
            ? { strategy: 'nearest' as const, precisionCents: Number(roundPrecision) }
            : { strategy: 'charm' as const, endingCents: Number(roundEnding) },
      floorProfitCents: floorProfit ? Math.round(Number(floorProfit) * 100) : null,
      floorMargin: floorMargin ? Number(floorMargin) : null,
      ceilingSrc,
      ceilingValueCents:
        ceilingSrc === 'fixed' && ceilingValue ? Math.round(Number(ceilingValue) * 100) : null,
      appliesTo,
      scope,
      isActive,
    };

    startTransition(async () => {
      const res = rule
        ? await updateMarkupRuleAction(rule.id, payload)
        : await createMarkupRuleAction(payload);
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      onSaved();
    });
  }

  return (
    <Card>
      <CardHeader>
        <Heading level={3}>{rule ? `Edit "${rule.name}"` : 'New markup rule'}</Heading>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit}>
          <Stack gap={4}>
            <Field label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Standard parts +40%"
                required
              />
            </Field>

            <Stack direction="row" gap={3} wrap>
              <Field label="Method" className="min-w-[12rem] flex-1">
                <NativeSelect value={method} onChange={(e) => setMethod(e.target.value as never)}>
                  <option value="percentage">Percentage over cost</option>
                  <option value="multiplier">Multiplier (keystone)</option>
                  <option value="flat">Flat markup</option>
                  <option value="margin_target">Target margin</option>
                  <option value="matrix">Cost-band matrix</option>
                </NativeSelect>
              </Field>
              {!isMatrix && (
                <Field label={`Value (${valueUnit})`} className="min-w-[10rem] flex-1">
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={valueStr}
                    onChange={(e) => setValueStr(e.target.value)}
                    placeholder={method === 'multiplier' ? '2.5' : method === 'flat' ? '15' : '40'}
                  />
                </Field>
              )}
              <Field label="Cost basis" className="min-w-[10rem] flex-1">
                <NativeSelect
                  value={costBasis}
                  onChange={(e) => setCostBasis(e.target.value as never)}
                >
                  <option value="variant_cost">Variant cost</option>
                  <option value="supplier_cost">Supplier (dropship) cost</option>
                </NativeSelect>
              </Field>
            </Stack>

            {isMatrix && <MatrixBandsEditor rows={bands} onChange={setBands} />}

            {/* Live readout — works for every method incl. matrix */}
            {
              <Stack
                direction="row"
                align="center"
                gap={3}
                wrap
                className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-3"
              >
                <Stack direction="row" align="center" gap={2}>
                  <Text size="sm" variant="muted">
                    If cost is
                  </Text>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={sampleDollars}
                    onChange={(e) => setSampleDollars(e.target.value)}
                    className="h-8 w-24"
                    aria-label="Sample cost in dollars"
                  />
                </Stack>
                {preview ? (
                  <Text size="sm">
                    → price <strong>{fmt(preview.priceCents)}</strong> · markup {preview.markupPct}%
                    · margin {preview.marginPct}% · profit {fmt(preview.profitCents)}
                  </Text>
                ) : (
                  <Text size="sm" variant="muted">
                    Enter a value to preview the price.
                  </Text>
                )}
              </Stack>
            }

            {/* Guards */}
            <Stack direction="row" gap={3} wrap>
              <Field label="Rounding" className="min-w-[9rem] flex-1">
                <NativeSelect
                  value={roundStrategy}
                  onChange={(e) => setRoundStrategy(e.target.value as never)}
                >
                  <option value="none">None</option>
                  <option value="nearest">Nearest</option>
                  <option value="charm">Charm ending</option>
                </NativeSelect>
              </Field>
              {roundStrategy === 'nearest' && (
                <Field label="Round to" className="min-w-[8rem] flex-1">
                  <NativeSelect
                    value={roundPrecision}
                    onChange={(e) => setRoundPrecision(e.target.value)}
                  >
                    <option value="5">$0.05</option>
                    <option value="10">$0.10</option>
                    <option value="50">$0.50</option>
                    <option value="100">$1.00</option>
                  </NativeSelect>
                </Field>
              )}
              {roundStrategy === 'charm' && (
                <Field label="Ends in" className="min-w-[8rem] flex-1">
                  <NativeSelect
                    value={roundEnding}
                    onChange={(e) => setRoundEnding(e.target.value)}
                  >
                    <option value="99">.99</option>
                    <option value="95">.95</option>
                    <option value="50">.50</option>
                    <option value="0">.00</option>
                  </NativeSelect>
                </Field>
              )}
              <Field label="Floor profit ($)" className="min-w-[8rem] flex-1">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={floorProfit}
                  onChange={(e) => setFloorProfit(e.target.value)}
                  placeholder="optional"
                />
              </Field>
              <Field label="Floor margin (%)" className="min-w-[8rem] flex-1">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={floorMargin}
                  onChange={(e) => setFloorMargin(e.target.value)}
                  placeholder="optional"
                />
              </Field>
            </Stack>

            <Stack direction="row" gap={3} wrap>
              <Field label="Ceiling" className="min-w-[9rem] flex-1">
                <NativeSelect
                  value={ceilingSrc}
                  onChange={(e) => setCeilingSrc(e.target.value as never)}
                >
                  <option value="none">None</option>
                  <option value="compare_at">Compare-at price</option>
                  <option value="fixed">Fixed amount</option>
                </NativeSelect>
              </Field>
              {ceilingSrc === 'fixed' && (
                <Field label="Ceiling ($)" className="min-w-[8rem] flex-1">
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={ceilingValue}
                    onChange={(e) => setCeilingValue(e.target.value)}
                  />
                </Field>
              )}
              <Field label="Applies to" className="min-w-[9rem] flex-1">
                <NativeSelect
                  value={appliesTo}
                  onChange={(e) => setAppliesTo(e.target.value as never)}
                >
                  <option value="catalog">Catalog price</option>
                  <option value="document">Invoice/quote lines</option>
                  <option value="both">Both</option>
                </NativeSelect>
              </Field>
            </Stack>

            <Stack direction="row" gap={3} wrap align="end">
              <Field label="Scope" className="min-w-[10rem] flex-1">
                <NativeSelect
                  value={scopeType}
                  onChange={(e) => setScopeType(e.target.value as never)}
                >
                  <option value="all">All products</option>
                  <option value="collection">By collection</option>
                  <option value="product_type">By product type</option>
                  <option value="vendor">By vendor</option>
                </NativeSelect>
              </Field>
              {(scopeType === 'product_type' || scopeType === 'vendor') && (
                <Field
                  label={scopeType === 'vendor' ? 'Vendor' : 'Product type'}
                  className="min-w-[12rem] flex-1"
                >
                  <Input
                    value={scopeValue}
                    onChange={(e) => setScopeValue(e.target.value)}
                    placeholder={scopeType === 'vendor' ? 'Bosch' : 'Injectors'}
                  />
                </Field>
              )}
              <Stack direction="row" align="center" gap={2} className="pb-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Active" />
                <Text size="sm">Active</Text>
              </Stack>
            </Stack>

            {scopeType === 'collection' && (
              <CollectionPicker
                collections={collections}
                selected={collectionIds}
                onChange={setCollectionIds}
              />
            )}

            <Text size="xs" variant="muted">
              Need to target a one-off set of SKUs? Use the{' '}
              <a className="underline" href="/commerce/products/pricing">
                bulk pricing tool
              </a>{' '}
              to preview and apply this rule across an ad-hoc product selection.
            </Text>

            {error && (
              <Text size="sm" variant="danger" role="alert">
                {error}
              </Text>
            )}

            <Stack direction="row" gap={2} justify="end">
              <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" color="module" loading={pending}>
                {rule ? 'Save changes' : 'Create rule'}
              </Button>
            </Stack>
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}

function CollectionPicker({
  collections,
  selected,
  onChange,
}: {
  collections: CollectionOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  if (collections.length === 0) {
    return (
      <Text size="xs" variant="muted">
        No collections yet — create one under Collections first, or scope by product type / vendor.
      </Text>
    );
  }
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }
  return (
    <Stack
      gap={1}
      className="max-h-48 overflow-auto rounded border border-[var(--color-border-default)] p-3"
    >
      {collections.map((c) => (
        <label key={c.id} className="flex cursor-pointer items-center gap-2">
          <Checkbox
            checked={selected.includes(c.id)}
            onCheckedChange={() => toggle(c.id)}
            aria-label={c.name}
          />
          <Text size="sm">{c.name}</Text>
        </label>
      ))}
    </Stack>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Stack gap={1} className={className}>
      <Text size="xs" variant="muted" weight="medium">
        {label}
      </Text>
      {children}
    </Stack>
  );
}
