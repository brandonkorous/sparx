'use client';

// The structured line composer (docs/87 §6) — NOT a canvas. Each line is a typed
// charge: a line type (which carries pricing + tax behavior), description, qty, and
// a price. How the price is set depends on the line type's PRICING MODE:
//   • catalog / flat / labor → a manual unit price (+ optional cost so margin shows)
//   • markup / pass_through  → a cost basis + a markup (a saved rule or an ad-hoc
//     markup), priced LIVE off the same pure engine as catalog/quote markup
//     (docs/48 §5) and snapshotted on the line so the price is reproducible.
// Edits commit to the server per field (on blur / change) — markup is committed as
// a unit via an Apply button, since cost + rule must travel together. A locked
// stage (final/paid) freezes the grid to read-only.
//
// The markup pricing primitives (the cost→price engine + its editor) live in
// ../../_lib/markup so the create wizard prices an identical line the identical way.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Plus, Trash2 } from 'lucide-react';

import { useConfirm } from '@sparx/ui';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardTitle,
  Checkbox,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Input,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';
import { type BandMethod } from '@sparx/commerce-schemas';

import { addLineAction, removeLineAction, updateLineAction } from '../../../document-actions';
import { formatMoney } from '../../../_components/format';
import {
  ADHOC,
  freshMarkupState,
  isMarkupMode,
  MarkupFields,
  METHOD_META,
  type MarkupRuleSummary,
  type MarkupState,
  resolveMarkup,
  SELECT_CLASS,
} from '../../_lib/markup';

// Re-exported for the document editor page, which imports this type from here.
export type { MarkupRuleSummary } from '../../_lib/markup';

// The markup snapshot already on a line (its current cost-derived price), enough
// to seed the editor when re-pricing.
interface LineMarkupView {
  ruleId: string | null;
  ruleName: string | null;
  method: string;
  value: number | null; // engine units
  marginPct: number;
  costBasisValueCents: number;
}

interface LineRow {
  id: string;
  lineTypeId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  costCents: number | null;
  taxable: boolean;
  lineTotal: number;
  markup: LineMarkupView | null;
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
  /** Document-applicable markup rules for the markup/pass_through line picker.
   *  Empty when Commerce is disabled — those lines then price by ad-hoc markup. */
  markupRules: MarkupRuleSummary[];
}

export function LineGrid({
  documentId,
  currency,
  locked,
  lines,
  lineTypes,
  markupRules,
}: LineGridProps) {
  return (
    <Card>
      <CardBody>
        <CardTitle>
          <div className="flex flex-row items-center gap-2">
            Line items
            <Badge color="neutral" variant="soft" size="sm">
              {lines.length}
            </Badge>
            {locked && (
              <Badge color="neutral" variant="soft" size="sm">
                <Lock className="mr-1 h-3 w-3" /> Locked
              </Badge>
            )}
          </div>
        </CardTitle>
        <div className="flex flex-col gap-3">
          <div className="text-base-content hidden grid-cols-12 gap-2 px-1 text-xs font-medium tracking-wide uppercase md:grid">
            <div className="col-span-2">Type</div>
            <div className="col-span-4">Description</div>
            <div className="col-span-1 text-right">Qty</div>
            <div className="col-span-2 text-right">Unit price</div>
            <div className="col-span-2 text-right">Line total</div>
            <div className="col-span-1" />
          </div>

          {lines.length === 0 && (
            <p className="text-base-content px-1 py-2 text-sm">
              No line items yet. Add the first charge below.
            </p>
          )}

          {lines.map((line) => (
            <EditableLineRow
              key={line.id}
              documentId={documentId}
              currency={currency}
              locked={locked}
              line={line}
              lineTypes={lineTypes}
              markupRules={markupRules}
            />
          ))}

          {!locked && (
            <AddLineRow
              documentId={documentId}
              lineTypes={lineTypes}
              markupRules={markupRules}
              currency={currency}
            />
          )}
        </div>
      </CardBody>
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
  markupRules,
}: {
  documentId: string;
  currency: string;
  locked: boolean;
  line: LineRow;
  lineTypes: LineTypeOption[];
  markupRules: MarkupRuleSummary[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  // Switching an EXISTING line to a markup/pass_through type can't commit the
  // type change alone — re-pricing needs a cost + markup directive the type
  // change itself doesn't carry, so an immediate commit always 422s before
  // the markup fields (which only render once markupMode is true) ever get a
  // chance to appear. Stage the pick locally and fold it into the SAME
  // request as "Apply markup" instead, mirroring how AddLineRow already
  // bundles lineTypeKey + markup payload into one atomic add.
  const [pendingTypeId, setPendingTypeId] = React.useState<string | null>(null);
  const selectedTypeId = pendingTypeId ?? line.lineTypeId;
  const currentType = lineTypes.find((t) => t.id === selectedTypeId);
  const pricingMode = currentType?.pricingMode ?? 'flat';
  const markupMode = isMarkupMode(pricingMode);

  // Markup editor state, seeded from the line's current cost + applied markup.
  const [markupState, setMarkupState] = React.useState<MarkupState>(() =>
    seedMarkupState(line, markupRules, pricingMode)
  );
  const resolved = resolveMarkup(markupState, markupRules, pricingMode);

  function commit(patch: Record<string, unknown>) {
    startTransition(async () => {
      setError(null);
      const res = await updateLineAction(documentId, line.id, patch);
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setPendingTypeId(null);
      router.refresh();
    });
  }

  function selectType(t: LineTypeOption) {
    if (isMarkupMode(t.pricingMode)) {
      setPendingTypeId(t.id);
      setMarkupState(freshMarkupState(markupRules, t.pricingMode));
      return;
    }
    setPendingTypeId(null);
    commit({ lineTypeKey: t.key });
  }

  function applyMarkup() {
    if (!resolved.payload) {
      setError(resolved.error);
      return;
    }
    commit({
      ...resolved.payload,
      ...(pendingTypeId ? { lineTypeKey: currentType?.key } : {}),
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
      <div className="border-base-300 grid grid-cols-12 items-center gap-2 rounded-md border px-2 py-2">
        <div className="text-base-content col-span-2 text-sm">{currentType?.label ?? '—'}</div>
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
    <div className="border-base-300 rounded-md border px-2 py-2">
      <div className="grid grid-cols-12 items-center gap-2">
        <div className="col-span-12 md:col-span-2">
          <select
            aria-label="Line type"
            className={SELECT_CLASS}
            value={selectedTypeId ?? ''}
            disabled={pending}
            onChange={(e) => {
              const t = lineTypes.find((x) => x.id === e.target.value);
              if (t) selectType(t);
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
        {markupMode ? (
          <div className="col-span-8 text-right text-sm tabular-nums md:col-span-2">
            {formatMoney(line.unitPrice, currency)}
            <span className="text-base-content ml-1 text-xs">/ unit</span>
          </div>
        ) : (
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
        )}
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

      {markupMode && (
        <div className="mt-2 flex flex-row flex-wrap items-end gap-3 px-1">
          <MarkupFields
            state={markupState}
            rules={markupRules}
            pricingMode={pricingMode}
            resolved={resolved}
            disabled={pending}
            currency={currency}
            onChange={(next) => setMarkupState((s) => ({ ...s, ...next }))}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            color="module"
            disabled={pending || !resolved.payload}
            onClick={applyMarkup}
          >
            Apply markup
          </Button>
        </div>
      )}

      <div className="mt-2 flex flex-row flex-wrap items-center gap-3 px-1">
        <label className="text-base-content flex items-center gap-1.5 text-xs">
          <Checkbox
            color="module"
            defaultChecked={line.taxable}
            disabled={pending}
            onChange={(e) => commit({ taxable: e.target.checked })}
          />
          Taxable
        </label>
        {line.markup && (
          <Badge color="module" variant="soft" className="text-xs">
            {line.markup.ruleName ?? 'Ad-hoc markup'} · {line.markup.marginPct}% margin · cost{' '}
            {formatMoney(line.markup.costBasisValueCents / 100, currency)}
          </Badge>
        )}
        {error && (
          <FieldStatus status="error" attached={false} role="alert">
            {error}
          </FieldStatus>
        )}
      </div>
    </div>
  );
}

// Seed the markup editor from a line's current cost + applied markup snapshot.
function seedMarkupState(
  line: LineRow,
  rules: MarkupRuleSummary[],
  pricingMode: string
): MarkupState {
  const base = freshMarkupState(rules, pricingMode);
  const cost =
    line.costCents != null
      ? String(line.costCents / 100)
      : line.markup
        ? String(line.markup.costBasisValueCents / 100)
        : '';
  if (!line.markup) return { ...base, cost };
  if (line.markup.ruleId && rules.some((r) => r.id === line.markup?.ruleId)) {
    return { ...base, cost, source: line.markup.ruleId };
  }
  // Ad-hoc (or a rule that's since been deleted) → seed the ad-hoc inputs.
  const method = (['percentage', 'margin_target', 'multiplier', 'flat'] as BandMethod[]).includes(
    line.markup.method as BandMethod
  )
    ? (line.markup.method as BandMethod)
    : 'percentage';
  const value =
    line.markup.value != null ? String(METHOD_META[method].fromEngine(line.markup.value)) : '';
  return { cost, source: ADHOC, method, value };
}

// ── Add a line ────────────────────────────────────────────────────────────────

function AddLineRow({
  documentId,
  lineTypes,
  markupRules,
  currency,
}: {
  documentId: string;
  lineTypes: LineTypeOption[];
  markupRules: MarkupRuleSummary[];
  currency: string;
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

  const selectedType = lineTypes.find((t) => t.key === lineTypeKey);
  const pricingMode = selectedType?.pricingMode ?? 'flat';
  const markupMode = isMarkupMode(pricingMode);

  const [markupState, setMarkupState] = React.useState<MarkupState>(() =>
    freshMarkupState(markupRules, pricingMode)
  );
  const resolved = resolveMarkup(markupState, markupRules, pricingMode);

  const v = useFieldValidation(
    { description, quantity, unitPrice, cost },
    {
      description: rule.required('Add a description.'),
      quantity: (val) => {
        const n = Number(String(val).trim());
        if (!Number.isFinite(n)) return 'Enter a number.';
        if (n <= 0) return 'Quantity must be greater than 0.';
        return null;
      },
      unitPrice: (val) => {
        const n = Number(String(val).trim());
        if (!Number.isFinite(n)) return 'Enter a number.';
        if (n < 0) return 'Price cannot be negative.';
        return null;
      },
      cost: (val) => {
        const s = String(val ?? '').trim();
        if (s === '') return null;
        const n = Number(s);
        if (!Number.isFinite(n)) return 'Enter a number.';
        if (n < 0) return 'Cost cannot be negative.';
        return null;
      },
    }
  );

  // Re-seed the markup editor when switching into a different markup mode so the
  // pass-through-at-cost default tracks the selected line type.
  function onTypeChange(nextKey: string) {
    setLineTypeKey(nextKey);
    const nextMode = lineTypes.find((t) => t.key === nextKey)?.pricingMode ?? 'flat';
    if (isMarkupMode(nextMode)) setMarkupState(freshMarkupState(markupRules, nextMode));
  }

  function reset() {
    setDescription('');
    setQuantity('1');
    setUnitPrice('0');
    setCost('');
    setMarkupState(freshMarkupState(markupRules, pricingMode));
  }

  function add() {
    setError(null);
    if (!v.validate()) return;
    const common = {
      lineTypeKey: lineTypeKey || undefined,
      description: description.trim(),
      quantity: Math.max(0.001, Number(quantity) || 1),
    };

    let input: Record<string, unknown>;
    if (markupMode) {
      if (!resolved.payload) {
        setError(resolved.error ?? 'Enter the markup details.');
        return;
      }
      input = { ...common, ...resolved.payload };
    } else {
      const costNum = cost.trim() ? Number(cost) : null;
      input = {
        ...common,
        unitPrice: Math.max(0, Number(unitPrice) || 0),
        ...(costNum != null && Number.isFinite(costNum)
          ? { explicitCostCents: Math.round(costNum * 100) }
          : {}),
      };
    }

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
    <div className="border-base-300 rounded-md border border-dashed px-2 py-3">
      {/* items-end bottom-aligns the icon-only Add button (no label of its
          own) against the input row; self-start on every Field cell keeps
          each field's own label+input flush with its neighbors regardless of
          whether a sibling is showing a taller inline validation error. */}
      <div className="grid grid-cols-12 items-end gap-2">
        <Field className="col-span-12 self-start md:col-span-2">
          <FieldLabel className="text-xs">Type</FieldLabel>
          <select
            className={SELECT_CLASS}
            value={lineTypeKey}
            disabled={pending}
            onChange={(e) => onTypeChange(e.target.value)}
          >
            {lineTypes.map((t) => (
              <option key={t.id} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field {...v.field('description')} className="col-span-12 self-start md:col-span-4">
          <FieldLabel className="text-xs" required>
            Description
          </FieldLabel>
          <FieldControl
            name="line-description"
            value={description}
            disabled={pending}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this charge?"
            {...v.control('description')}
          />
        </Field>
        <Field {...v.field('quantity')} className="col-span-3 self-start md:col-span-1">
          <FieldLabel className="text-xs" required>
            Qty
          </FieldLabel>
          <FieldControl
            name="line-quantity"
            type="number"
            min="0"
            step="0.001"
            className="text-right"
            value={quantity}
            disabled={pending}
            onChange={(e) => setQuantity(e.target.value)}
            {...v.control('quantity')}
          />
        </Field>

        {markupMode ? (
          <div className="col-span-9 self-start md:col-span-4">
            <MarkupFields
              state={markupState}
              rules={markupRules}
              pricingMode={pricingMode}
              resolved={resolved}
              disabled={pending}
              currency={currency}
              onChange={(next) => setMarkupState((s) => ({ ...s, ...next }))}
            />
          </div>
        ) : (
          <>
            <Field {...v.field('unitPrice')} className="col-span-4 self-start md:col-span-2">
              <FieldLabel className="text-xs">Unit price</FieldLabel>
              <FieldControl
                name="line-unit-price"
                type="number"
                min="0"
                step="0.01"
                className="text-right"
                value={unitPrice}
                disabled={pending}
                onChange={(e) => setUnitPrice(e.target.value)}
                {...v.control('unitPrice')}
              />
            </Field>
            <Field {...v.field('cost')} className="col-span-3 self-start md:col-span-2">
              <FieldLabel className="text-xs">Cost (opt.)</FieldLabel>
              <FieldControl
                name="line-cost"
                type="number"
                min="0"
                step="0.01"
                className="text-right"
                value={cost}
                disabled={pending}
                onChange={(e) => setCost(e.target.value)}
                placeholder="—"
                {...v.control('cost')}
              />
            </Field>
          </>
        )}

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
        <FieldStatus status="error" attached={false} role="alert" className="mt-2">
          {error}
        </FieldStatus>
      )}
    </div>
  );
}
