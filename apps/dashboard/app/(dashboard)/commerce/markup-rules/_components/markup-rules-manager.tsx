'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Play, Plus, Trash2 } from 'lucide-react';

import { applyMarkupRule, type MarkupRuleSpec } from '@sparx/commerce-schemas';
import { useConfirm } from '@sparx/ui';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Checkbox,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Input,
  NativeSelect,
  Switch,
  Table,
} from '@wizeworks/silicaui-react';
import { rule as fieldRule, useFieldValidation } from '@sparx/forms';

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
  recomputeMode: 'auto' | 'review' | 'off';
  recomputeTolerancePct: number | null;
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
    <div className="flex flex-col gap-2">
      <p className="text-base-content text-xs font-medium">Cost bands</p>
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-row flex-wrap items-end gap-2">
            <Field className="w-28">
              <FieldLabel>Cost ≥ ($)</FieldLabel>
              <FieldControl
                type="number"
                inputMode="decimal"
                step="any"
                value={r.minStr}
                onChange={(e) => patch(i, { minStr: e.target.value })}
              />
            </Field>
            <Field className="w-28">
              <FieldLabel>Cost &lt; ($)</FieldLabel>
              <FieldControl
                type="number"
                inputMode="decimal"
                step="any"
                value={r.maxStr}
                onChange={(e) => patch(i, { maxStr: e.target.value })}
                placeholder="∞"
              />
            </Field>
            <Field className="w-40">
              <FieldLabel>Method</FieldLabel>
              <FieldControl
                render={
                  <NativeSelect>
                    <option value="percentage">Percentage</option>
                    <option value="multiplier">Multiplier</option>
                    <option value="flat">Flat</option>
                    <option value="margin_target">Target margin</option>
                  </NativeSelect>
                }
                value={r.method}
                onChange={(e) => patch(i, { method: e.target.value as BandMethod })}
              />
            </Field>
            <Field className="w-28">
              <FieldLabel>{BAND_UNIT[r.method]}</FieldLabel>
              <FieldControl
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
              iconStart={<Trash2 className="h-3.5 w-3.5" />}
              onClick={() => remove(i)}
              disabled={rows.length === 1}
              aria-label={`Remove band ${i + 1}`}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
      <div>
        <Button
          type="button"
          size="xs"
          variant="outline"
          iconStart={<Plus className="h-3.5 w-3.5" />}
          onClick={add}
        >
          Add band
        </Button>
      </div>
      <p className="text-base-content text-xs">
        Bands are matched low → high by cost. Leave the top band’s upper bound blank for open-ended.
        A cost outside every band clamps to the nearest.
      </p>
    </div>
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
    <div className="flex flex-col gap-5">
      {notice && (
        <p className="text-success text-sm" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="text-danger text-sm" role="alert">
          {error}
        </p>
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
        <CardBody>
          <div className="flex flex-row flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-semibold">Rules</h3>
            {!editing && (
              <Button
                color="module"
                size="sm"
                iconStart={<Plus className="h-4 w-4" />}
                onClick={() => setEditing('new')}
              >
                New rule
              </Button>
            )}
          </div>
          {initialRules.length === 0 ? (
            <p className="text-base-content py-6 text-center text-base">
              No markup rules yet. Create one to price products from their cost.
            </p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Method</th>
                  <th>Cost basis</th>
                  <th>Scope</th>
                  <th className="text-right">Bound</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {initialRules.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="flex flex-col gap-1">
                        <p className="text-base font-medium">{r.name}</p>
                        {r.appliesTo !== 'document' && r.recomputeMode !== 'auto' && (
                          <p className="text-base-content text-xs">
                            {r.recomputeMode === 'off'
                              ? 'Cost changes ignored'
                              : 'Cost changes queued for review'}
                          </p>
                        )}
                      </div>
                    </td>
                    <td>
                      <Badge color="info" variant="soft" size="sm">
                        {methodSummary(r)}
                      </Badge>
                    </td>
                    <td>
                      <p className="text-base-content text-sm">
                        {r.costBasis === 'supplier_cost' ? 'Supplier cost' : 'Variant cost'}
                      </p>
                    </td>
                    <td>
                      <p className="text-base-content text-sm">{scopeSummary(r.scope)}</p>
                    </td>
                    <td className="text-right">{r.boundVariantCount}</td>
                    <td>
                      <Badge color={r.isActive ? 'success' : 'neutral'} variant="soft" size="sm">
                        {r.isActive ? 'Active' : 'Paused'}
                      </Badge>
                    </td>
                    <td className="text-right">
                      <div className="flex flex-row justify-end gap-1">
                        <Button
                          size="xs"
                          variant="ghost"
                          color="module"
                          iconStart={<Play className="h-3.5 w-3.5" />}
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
                          iconStart={<Pencil className="h-3.5 w-3.5" />}
                          disabled={busyId === r.id}
                          onClick={() => setEditing(r)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          color="danger"
                          iconStart={<Trash2 className="h-3.5 w-3.5" />}
                          disabled={busyId === r.id}
                          onClick={() => onDelete(r)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
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
  const [recomputeMode, setRecomputeMode] = React.useState(rule?.recomputeMode ?? 'auto');
  const [recomputeTolerance, setRecomputeTolerance] = React.useState(
    rule?.recomputeTolerancePct != null ? String(rule.recomputeTolerancePct) : '15'
  );
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

  const values = { name, valueStr };
  const v = useFieldValidation(values, {
    name: fieldRule.required('Name is required.'),
    // Value is a per-method display number; only required when the method isn't a
    // cost-band matrix (the matrix edits its bands separately, so this field is hidden).
    valueStr: (val) => {
      if (isMatrix) return null;
      const n = Number(String(val).trim());
      return Number.isFinite(n) ? null : 'Enter a valid number.';
    },
  });

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
    if (!v.validate()) return;

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
      recomputeMode,
      // Tolerance only matters in auto mode; blank = unbounded (any delta auto-applies).
      recomputeTolerancePct:
        recomputeMode === 'auto' && recomputeTolerance.trim() !== ''
          ? Number(recomputeTolerance)
          : null,
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
      <CardBody>
        <h3 className="text-xl font-semibold">
          {rule ? `Edit "${rule.name}"` : 'New markup rule'}
        </h3>
        <form onSubmit={onSubmit}>
          <div className="flex flex-col gap-4">
            <Field {...v.field('name')}>
              <FieldLabel>Name</FieldLabel>
              <FieldControl
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Standard parts +40%"
                required
                {...v.control('name')}
              />
            </Field>

            <div className="flex flex-row flex-wrap gap-3">
              <Field className="min-w-[12rem] flex-1">
                <FieldLabel>Method</FieldLabel>
                <FieldControl
                  render={
                    <NativeSelect>
                      <option value="percentage">Percentage over cost</option>
                      <option value="multiplier">Multiplier (keystone)</option>
                      <option value="flat">Flat markup</option>
                      <option value="margin_target">Target margin</option>
                      <option value="matrix">Cost-band matrix</option>
                    </NativeSelect>
                  }
                  value={method}
                  onChange={(e) => setMethod(e.target.value as never)}
                />
              </Field>
              {!isMatrix && (
                <Field {...v.field('valueStr')} className="min-w-[10rem] flex-1">
                  <FieldLabel>{`Value (${valueUnit})`}</FieldLabel>
                  <FieldControl
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={valueStr}
                    onChange={(e) => setValueStr(e.target.value)}
                    placeholder={method === 'multiplier' ? '2.5' : method === 'flat' ? '15' : '40'}
                    {...v.control('valueStr')}
                  />
                </Field>
              )}
              <Field className="min-w-[10rem] flex-1">
                <FieldLabel>Cost basis</FieldLabel>
                <FieldControl
                  render={
                    <NativeSelect>
                      <option value="variant_cost">Variant cost</option>
                      <option value="supplier_cost">Supplier (dropship) cost</option>
                    </NativeSelect>
                  }
                  value={costBasis}
                  onChange={(e) => setCostBasis(e.target.value as never)}
                />
              </Field>
            </div>

            {isMatrix && <MatrixBandsEditor rows={bands} onChange={setBands} />}

            {/* Live readout — works for every method incl. matrix */}
            {
              <div className="border-base-300 bg-base-200 flex flex-row flex-wrap items-center gap-3 rounded border p-3">
                <div className="flex flex-row items-center gap-2">
                  <p className="text-base-content text-sm">If cost is</p>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={sampleDollars}
                    onChange={(e) => setSampleDollars(e.target.value)}
                    className="h-8 w-24"
                    aria-label="Sample cost in dollars"
                  />
                </div>
                {preview ? (
                  <p className="text-sm">
                    → price <strong>{fmt(preview.priceCents)}</strong> · markup {preview.markupPct}%
                    · margin {preview.marginPct}% · profit {fmt(preview.profitCents)}
                  </p>
                ) : (
                  <p className="text-base-content text-sm">Enter a value to preview the price.</p>
                )}
              </div>
            }

            {/* Guards */}
            <div className="flex flex-row flex-wrap gap-3">
              <Field className="min-w-[9rem] flex-1">
                <FieldLabel>Rounding</FieldLabel>
                <FieldControl
                  render={
                    <NativeSelect>
                      <option value="none">None</option>
                      <option value="nearest">Nearest</option>
                      <option value="charm">Charm ending</option>
                    </NativeSelect>
                  }
                  value={roundStrategy}
                  onChange={(e) => setRoundStrategy(e.target.value as never)}
                />
              </Field>
              {roundStrategy === 'nearest' && (
                <Field className="min-w-[8rem] flex-1">
                  <FieldLabel>Round to</FieldLabel>
                  <FieldControl
                    render={
                      <NativeSelect>
                        <option value="5">$0.05</option>
                        <option value="10">$0.10</option>
                        <option value="50">$0.50</option>
                        <option value="100">$1.00</option>
                      </NativeSelect>
                    }
                    value={roundPrecision}
                    onChange={(e) => setRoundPrecision(e.target.value)}
                  />
                </Field>
              )}
              {roundStrategy === 'charm' && (
                <Field className="min-w-[8rem] flex-1">
                  <FieldLabel>Ends in</FieldLabel>
                  <FieldControl
                    render={
                      <NativeSelect>
                        <option value="99">.99</option>
                        <option value="95">.95</option>
                        <option value="50">.50</option>
                        <option value="0">.00</option>
                      </NativeSelect>
                    }
                    value={roundEnding}
                    onChange={(e) => setRoundEnding(e.target.value)}
                  />
                </Field>
              )}
              <Field className="min-w-[8rem] flex-1">
                <FieldLabel>Floor profit ($)</FieldLabel>
                <FieldControl
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={floorProfit}
                  onChange={(e) => setFloorProfit(e.target.value)}
                  placeholder="optional"
                />
              </Field>
              <Field className="min-w-[8rem] flex-1">
                <FieldLabel>Floor margin (%)</FieldLabel>
                <FieldControl
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={floorMargin}
                  onChange={(e) => setFloorMargin(e.target.value)}
                  placeholder="optional"
                />
              </Field>
            </div>

            <div className="flex flex-row flex-wrap gap-3">
              <Field className="min-w-[9rem] flex-1">
                <FieldLabel>Ceiling</FieldLabel>
                <FieldControl
                  render={
                    <NativeSelect>
                      <option value="none">None</option>
                      <option value="compare_at">Compare-at price</option>
                      <option value="fixed">Fixed amount</option>
                    </NativeSelect>
                  }
                  value={ceilingSrc}
                  onChange={(e) => setCeilingSrc(e.target.value as never)}
                />
              </Field>
              {ceilingSrc === 'fixed' && (
                <Field className="min-w-[8rem] flex-1">
                  <FieldLabel>Ceiling ($)</FieldLabel>
                  <FieldControl
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={ceilingValue}
                    onChange={(e) => setCeilingValue(e.target.value)}
                  />
                </Field>
              )}
              <Field className="min-w-[9rem] flex-1">
                <FieldLabel>Applies to</FieldLabel>
                <FieldControl
                  render={
                    <NativeSelect>
                      <option value="catalog">Catalog price</option>
                      <option value="document">Invoice/quote lines</option>
                      <option value="both">Both</option>
                    </NativeSelect>
                  }
                  value={appliesTo}
                  onChange={(e) => setAppliesTo(e.target.value as never)}
                />
              </Field>
            </div>

            {/* Cost-driven recompute (docs/48 §8) — only meaningful for catalog rules. */}
            {appliesTo !== 'document' && (
              <div className="border-base-300 bg-base-200 flex flex-col gap-2 rounded border p-3">
                <p className="text-base-content text-xs font-medium">
                  When a bound variant’s cost changes
                </p>
                <div className="flex flex-row flex-wrap items-end gap-3">
                  <Field className="min-w-[14rem] flex-1">
                    <FieldLabel>Recompute</FieldLabel>
                    <FieldControl
                      render={
                        <NativeSelect>
                          <option value="auto">Auto-apply within tolerance</option>
                          <option value="review">Always queue for review</option>
                          <option value="off">Don’t recompute</option>
                        </NativeSelect>
                      }
                      value={recomputeMode}
                      onChange={(e) => setRecomputeMode(e.target.value as never)}
                    />
                  </Field>
                  {recomputeMode === 'auto' && (
                    <Field className="min-w-[10rem] flex-1">
                      <FieldLabel>Tolerance (± % price change)</FieldLabel>
                      <FieldControl
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={recomputeTolerance}
                        onChange={(e) => setRecomputeTolerance(e.target.value)}
                        placeholder="blank = any"
                      />
                    </Field>
                  )}
                </div>
                <p className="text-base-content text-xs">
                  {recomputeMode === 'off'
                    ? 'Prices stay frozen when costs move — re-apply the rule manually to refresh.'
                    : recomputeMode === 'review'
                      ? 'Every cost-driven price change waits in the Price changes queue for approval.'
                      : 'Small price moves apply automatically; anything beyond the tolerance is queued for review so a cost spike never silently reprices.'}
                </p>
              </div>
            )}

            <div className="flex flex-row flex-wrap items-end gap-3">
              <Field className="min-w-[10rem] flex-1">
                <FieldLabel>Scope</FieldLabel>
                <FieldControl
                  render={
                    <NativeSelect>
                      <option value="all">All products</option>
                      <option value="collection">By collection</option>
                      <option value="product_type">By product type</option>
                      <option value="vendor">By vendor</option>
                    </NativeSelect>
                  }
                  value={scopeType}
                  onChange={(e) => setScopeType(e.target.value as never)}
                />
              </Field>
              {(scopeType === 'product_type' || scopeType === 'vendor') && (
                <Field className="min-w-[12rem] flex-1">
                  <FieldLabel>{scopeType === 'vendor' ? 'Vendor' : 'Product type'}</FieldLabel>
                  <FieldControl
                    value={scopeValue}
                    onChange={(e) => setScopeValue(e.target.value)}
                    placeholder={scopeType === 'vendor' ? 'Bosch' : 'Injectors'}
                  />
                </Field>
              )}
              <div className="flex flex-row items-center gap-2 pb-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Active" />
                <p className="text-sm">Active</p>
              </div>
            </div>

            {scopeType === 'collection' && (
              <CollectionPicker
                collections={collections}
                selected={collectionIds}
                onChange={setCollectionIds}
              />
            )}

            <p className="text-base-content text-xs">
              Need to target a one-off set of SKUs? Use the{' '}
              <a className="underline" href="/commerce/products/pricing">
                bulk pricing tool
              </a>{' '}
              to preview and apply this rule across an ad-hoc product selection.
            </p>

            {error && (
              <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                {error}
              </FieldStatus>
            )}

            <div className="flex flex-row justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" color="module" loading={pending}>
                {rule ? 'Save changes' : 'Create rule'}
              </Button>
            </div>
          </div>
        </form>
      </CardBody>
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
      <p className="text-base-content text-xs">
        No collections yet — create one under Collections first, or scope by product type / vendor.
      </p>
    );
  }
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }
  return (
    <div className="border-base-300 flex max-h-48 flex-col gap-1 overflow-auto rounded border p-3">
      {collections.map((c) => (
        <label key={c.id} className="flex cursor-pointer items-center gap-2">
          <Checkbox
            color="module"
            checked={selected.includes(c.id)}
            onChange={() => toggle(c.id)}
            aria-label={c.name}
          />
          <p className="text-sm">{c.name}</p>
        </label>
      ))}
    </div>
  );
}
