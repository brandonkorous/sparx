'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDownAZ,
  Boxes,
  ChevronDown,
  ChevronRight,
  Plus,
  Sliders,
  Star,
  X,
} from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  Input,
  NativeSelect,
  Table,
} from '@wizeworks/silicaui-react';
import { useConfirm, statusLabel } from '@sparx/ui';

import {
  archiveVariantAction,
  setDefaultVariantAction,
  updateVariantAction,
} from '../../../variant-actions';
import { bindVariantMarkupAction, unbindVariantMarkupAction } from '../../../markup-actions';

import { NewVariantForm } from './new-variant-form';
import { OptionsEditor } from './options-editor';

export interface MarkupRuleOption {
  id: string;
  name: string;
}

export interface OptionValueRow {
  id: string;
  optionId: string;
  value: string;
  swatchHex: string | null;
  swatchImageId: string | null;
  position: number;
}

export interface OptionRow {
  id: string;
  productId: string;
  name: string;
  displayType: string;
  position: number;
  values: OptionValueRow[];
}

export interface VariantRow {
  id: string;
  productId: string;
  sku: string;
  title: string | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  costCents: number | null;
  currency: string;
  inventoryPolicy: string;
  isDefault: boolean;
  /** Set when the price is derived from a markup rule (docs/48); null = manual. */
  markupRuleId: string | null;
  optionValueIds: string[];
  imageCount: number;
  deletedAt: string | null;
}

interface Props {
  productId: string;
  productTitle: string;
  options: OptionRow[];
  variants: VariantRow[];
  /** Active catalog markup rules, for the per-variant "Price by rule" control. */
  markupRules: MarkupRuleOption[];
}

// Variants tab — two stacked sections: Options (the lattice) and
// Variants (purchasable SKUs). Each section has an inline collapsible
// editor so this works without a Dialog primitive — the dashboard
// doesn't ship one yet and adding it just for this feels premature.

export function VariantsPanel({ productId, productTitle, options, variants, markupRules }: Props) {
  const router = useRouter();
  const [optionsOpen, setOptionsOpen] = React.useState(false);
  const [newVariantOpen, setNewVariantOpen] = React.useState(false);

  const valuesById = React.useMemo(() => {
    const map = new Map<string, { option: OptionRow; value: OptionValueRow }>();
    for (const o of options) {
      for (const v of o.values) map.set(v.id, { option: o, value: v });
    }
    return map;
  }, [options]);

  const activeVariants = variants.filter((v) => !v.deletedAt);
  const archivedVariants = variants.filter((v) => v.deletedAt);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardBody>
          <div className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex flex-row items-center gap-2">
                <Sliders className="text-module h-4 w-4" />
                <h3 className="text-xl font-semibold">Options</h3>
                <Badge color="neutral" variant="soft" size="sm">
                  {options.length} option{options.length === 1 ? '' : 's'}
                </Badge>
              </div>
              <p className="opacity-70">
                Define the axes shoppers pick — Color, Size, Material, etc. Each variant binds to
                one value per option.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setOptionsOpen((v) => !v)}
              iconStart={optionsOpen ? <X className="h-4 w-4" /> : <Sliders className="h-4 w-4" />}
            >
              {optionsOpen ? 'Cancel' : options.length === 0 ? 'Set up options' : 'Edit options'}
            </Button>
          </div>
          {!optionsOpen && options.length > 0 && (
            <div className="flex flex-col gap-3">
              {options.map((option) => (
                <OptionPreview key={option.id} option={option} />
              ))}
            </div>
          )}
          {optionsOpen && (
            <OptionsEditor
              productId={productId}
              productTitle={productTitle}
              initialOptions={options}
              onSaved={() => {
                setOptionsOpen(false);
                router.refresh();
              }}
              onCancel={() => setOptionsOpen(false)}
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          <div className="flex flex-col gap-4 p-6">
            <div className="flex flex-row flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex flex-row items-center gap-2">
                  <Boxes className="text-module h-4 w-4" />
                  <h3 className="text-xl font-semibold">Variants</h3>
                  <Badge color="neutral" variant="soft" size="sm">
                    {activeVariants.length} active
                    {archivedVariants.length > 0 ? ` · ${archivedVariants.length} archived` : ''}
                  </Badge>
                </div>
                <p className="opacity-70">
                  One row per purchasable SKU. Each variant ties to one value per option (or none
                  for option-less products). Price + inventory policy edit inline.
                </p>
              </div>
              <Button
                color="module"
                onClick={() => setNewVariantOpen((v) => !v)}
                iconStart={
                  newVariantOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />
                }
              >
                {newVariantOpen ? 'Cancel' : 'Add variant'}
              </Button>
            </div>
            {newVariantOpen && (
              <NewVariantForm
                productId={productId}
                options={options}
                onCreated={() => {
                  setNewVariantOpen(false);
                  router.refresh();
                }}
                onCancel={() => setNewVariantOpen(false)}
              />
            )}
          </div>
          {activeVariants.length === 0 && archivedVariants.length === 0 ? (
            <div className="border-base-300 flex flex-col items-center gap-2 border-t py-10 text-center">
              <Boxes className="text-base-content h-5 w-5" />
              <p className="text-base-content text-sm">
                No variants yet. Add at least one before publishing.
              </p>
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Options</th>
                  <th className="text-right">Price (cents)</th>
                  <th>Inventory policy</th>
                  <th className="text-right">Images</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...activeVariants, ...archivedVariants].map((variant) => (
                  <VariantRowEditor
                    key={variant.id}
                    variant={variant}
                    productId={productId}
                    valuesById={valuesById}
                    markupRules={markupRules}
                    onChanged={() => router.refresh()}
                  />
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function OptionPreview({ option }: { option: OptionRow }) {
  return (
    <div className="border-base-300 bg-base-200 flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-row items-center gap-2">
        <span className="text-sm font-medium">{option.name}</span>
        <Badge color="neutral" variant="soft" size="sm">
          {statusLabel(option.displayType)}
        </Badge>
        <span className="text-base-content text-xs">
          {option.values.length} value{option.values.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="flex flex-row flex-wrap gap-2">
        {option.values.map((v) => (
          <div
            key={v.id}
            className="border-base-300 bg-base-100 flex flex-row items-center gap-1 rounded border px-2 py-1"
          >
            {v.swatchHex && (
              <span
                aria-hidden
                className="border-base-300 inline-block h-3 w-3 rounded-sm border"
                style={{ backgroundColor: v.swatchHex }}
              />
            )}
            <span className="text-xs">{v.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface VariantRowProps {
  variant: VariantRow;
  productId: string;
  valuesById: Map<string, { option: OptionRow; value: OptionValueRow }>;
  markupRules: MarkupRuleOption[];
  onChanged: () => void;
}

function VariantRowEditor({
  variant,
  productId,
  valuesById,
  markupRules,
  onChanged,
}: VariantRowProps) {
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [priceDraft, setPriceDraft] = React.useState(variant.priceCents.toString());

  // A rule-bound variant's price is rewritten server-side (bind/apply); keep the
  // inline field in sync when that happens.
  const isRulePriced = variant.markupRuleId != null;
  React.useEffect(() => {
    setPriceDraft(variant.priceCents.toString());
  }, [variant.priceCents]);

  function onPricingModeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setError(null);
    startTransition(async () => {
      const result =
        next === 'manual'
          ? await unbindVariantMarkupAction(variant.id, productId)
          : await bindVariantMarkupAction(variant.id, productId, next);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onChanged();
    });
  }

  const optionsLabel = variant.optionValueIds
    .map((vid) => {
      const entry = valuesById.get(vid);
      return entry ? `${entry.option.name}: ${entry.value.value}` : null;
    })
    .filter(Boolean)
    .join(' · ');

  function commit(payload: Record<string, unknown>) {
    setError(null);
    startTransition(async () => {
      const result = await updateVariantAction(variant.id, productId, payload);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onChanged();
    });
  }

  function onPriceBlur() {
    const next = Number.parseInt(priceDraft, 10);
    if (!Number.isFinite(next) || next < 0) {
      setError('Price must be a non-negative integer (cents)');
      setPriceDraft(variant.priceCents.toString());
      return;
    }
    if (next === variant.priceCents) return;
    commit({ priceCents: next });
  }

  function makeDefault() {
    setError(null);
    startTransition(async () => {
      const result = await setDefaultVariantAction(variant.id, productId);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onChanged();
    });
  }

  async function archive() {
    const ok = await confirm({
      title: `Archive variant ${variant.sku}?`,
      description:
        'Carts referencing this variant will fail to checkout. You can restore it from the archived list.',
      confirmLabel: 'Archive variant',
      tone: 'danger',
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const result = await archiveVariantAction(variant.id, productId);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onChanged();
    });
  }

  return (
    <tr className={variant.deletedAt ? 'opacity-50' : undefined}>
      <td>
        <div className="flex flex-col gap-1">
          <div className="flex flex-row items-center gap-2">
            <span className="text-sm font-medium">{variant.sku}</span>
            {variant.isDefault && (
              <Badge color="module" className="text-xs">
                default
              </Badge>
            )}
            {variant.deletedAt && (
              <Badge color="warning" className="text-xs">
                archived
              </Badge>
            )}
          </div>
          {variant.title && <span className="text-base-content text-xs">{variant.title}</span>}
        </div>
      </td>
      <td>
        <span className="text-base-content text-sm">{optionsLabel || '—'}</span>
      </td>
      <td className="text-right tabular-nums">
        <div className="flex flex-col items-end gap-1">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={priceDraft}
            onChange={(e) => setPriceDraft(e.target.value)}
            onBlur={onPriceBlur}
            disabled={pending || !!variant.deletedAt || isRulePriced}
            className="h-8 w-28 text-right"
            aria-label={`Price for ${variant.sku}`}
            title={isRulePriced ? 'Price is derived from a markup rule' : undefined}
          />
          {markupRules.length > 0 && !variant.deletedAt && (
            <NativeSelect
              size="sm"
              className="w-auto"
              value={variant.markupRuleId ?? 'manual'}
              onChange={onPricingModeChange}
              disabled={pending}
              aria-label={`Pricing mode for ${variant.sku}`}
            >
              <option value="manual">Manual price</option>
              {markupRules.map((r) => (
                <option key={r.id} value={r.id}>
                  By rule: {r.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </div>
      </td>
      <td>
        <NativeSelect
          size="sm"
          className="w-auto"
          value={variant.inventoryPolicy}
          onChange={(e) => commit({ inventoryPolicy: e.target.value })}
          disabled={pending || !!variant.deletedAt}
          aria-label={`Inventory policy for ${variant.sku}`}
        >
          <option value="deny">Deny when out</option>
          <option value="continue">Continue selling</option>
          <option value="preorder">Preorder</option>
        </NativeSelect>
      </td>
      <td className="text-right tabular-nums">
        <span className="text-base-content text-sm">{variant.imageCount}</span>
      </td>
      <td className="text-right">
        <div className="flex flex-row justify-end gap-1">
          {!variant.deletedAt && !variant.isDefault && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={makeDefault}
              disabled={pending}
              iconStart={<Star className="h-3.5 w-3.5" />}
              title="Make default"
            >
              Default
            </Button>
          )}
          {!variant.deletedAt && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void archive()}
              disabled={pending}
              iconStart={<ArrowDownAZ className="h-3.5 w-3.5" />}
            >
              Archive
            </Button>
          )}
        </div>
        {error && <p className="text-danger mt-1 text-xs">{error}</p>}
      </td>
    </tr>
  );
}

export { ChevronDown, ChevronRight };
