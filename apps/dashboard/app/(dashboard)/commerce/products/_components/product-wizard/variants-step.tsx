'use client';

// Product wizard — Variants & options step (slice 2).
//
// The wizard's job is to walk the merchant through the WHOLE product, so this
// step owns the option lattice AND the variant matrix it implies. It reuses the
// detail page's <OptionsEditor> (a self-contained component that POSTs the
// lattice and calls back), then derives the cartesian matrix of value
// combinations and lets the merchant generate a purchasable variant per cell in
// one action.
//
// The product already has ONE variant — the default the merchant priced on the
// Pricing step. When options are added, that default variant is bound to the
// first combination (so we never strand it as an option-less ghost), and the
// remaining combinations are created fresh.

import * as React from 'react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  FieldStatus,
  Input,
  Loading,
} from '@wizeworks/silicaui-react';
import { SurfaceStep } from '@sparx/ui';

import {
  assignVariantOptionValuesAction,
  createVariantAction,
  listProductOptionsAction,
  listVariantsAction,
  renameVariantSkuAction,
  updateVariantAction,
} from '../../../variant-actions';
import { OptionsEditor } from '../../[id]/_components/options-editor';
import type { OptionRow, OptionValueRow, VariantRow } from '../../[id]/_components/variants-panel';

interface VariantsStepProps {
  productId: string;
  productTitle: string;
  /** Physical products ship; digital/service variants must not. Threaded so
   *  generated variants inherit the right shipping flag from the parent. */
  requiresShipping: boolean;
  onBack: () => void;
  onComplete: () => void;
}

// Cap the matrix so a careless 12×12×12 doesn't try to mint 1,728 SKUs. The
// merchant can still generate up to the cap; anything above asks them to trim.
const MAX_COMBOS = 100;

export function VariantsStep({
  productId,
  productTitle,
  requiresShipping,
  onBack,
  onComplete,
}: VariantsStepProps) {
  const [loading, setLoading] = React.useState(true);
  const [options, setOptions] = React.useState<OptionRow[]>([]);
  const [variants, setVariants] = React.useState<VariantRow[]>([]);
  const [editingOptions, setEditingOptions] = React.useState(false);

  // Per-combination overrides the merchant typed before generating.
  const [skuEdits, setSkuEdits] = React.useState<Record<string, string>>({});
  const [priceEdits, setPriceEdits] = React.useState<Record<string, string>>({});

  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    const [oRes, vRes] = await Promise.all([
      listProductOptionsAction(productId),
      listVariantsAction(productId),
    ]);
    if (oRes.ok) setOptions(oRes.data);
    if (vRes.ok) setVariants(vRes.data);
  }, [productId]);

  React.useEffect(() => {
    let cancelled = false;
    void reload().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const defaultVariant = variants.find((v) => v.isDefault) ?? variants[0];
  const baseSku = defaultVariant?.sku ?? '';
  const basePriceCents = defaultVariant?.priceCents ?? 0;

  const combos = React.useMemo(() => cartesian(options.map((o) => o.values)), [options]);
  const overCap = combos.length > MAX_COMBOS;

  // Index existing variants by their option-value signature so we can show which
  // combinations are already real SKUs.
  const variantByKey = React.useMemo(() => {
    const map = new Map<string, VariantRow>();
    for (const v of variants) {
      if (v.optionValueIds.length > 0) map.set(signature(v.optionValueIds), v);
    }
    return map;
  }, [variants]);

  function skuFor(key: string, combo: OptionValueRow[], existing?: VariantRow): string {
    if (key in skuEdits) return skuEdits[key] ?? '';
    return existing?.sku ?? suggestSku(baseSku, combo);
  }

  function priceFor(key: string, existing?: VariantRow): string {
    if (key in priceEdits) return priceEdits[key] ?? '';
    return centsToInput(existing?.priceCents ?? basePriceCents);
  }

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      let usedDefault = false;
      const defaultUnbound = !!defaultVariant && defaultVariant.optionValueIds.length === 0;

      for (let i = 0; i < combos.length; i++) {
        const combo = combos[i];
        if (!combo) continue;
        const ids = combo.map((v) => v.id);
        const key = signature(ids);
        if (variantByKey.has(key)) continue; // already a SKU for this cell

        const sku = skuFor(key, combo).trim();
        const priceCents = inputToCents(priceFor(key)) ?? basePriceCents;
        if (!sku) {
          setError('Every variant needs a SKU.');
          return;
        }

        if (defaultUnbound && !usedDefault && defaultVariant) {
          // Adopt the priced default variant as the first combination.
          usedDefault = true;
          const assign = await assignVariantOptionValuesAction(productId, {
            variantId: defaultVariant.id,
            optionValueIds: ids,
          });
          if (!assign.ok) {
            setError(assign.error.message);
            return;
          }
          if (sku !== defaultVariant.sku) {
            const rename = await renameVariantSkuAction(defaultVariant.id, productId, { sku });
            if (!rename.ok) {
              setError(rename.error.message);
              return;
            }
          }
          if (priceCents !== defaultVariant.priceCents) {
            const upd = await updateVariantAction(defaultVariant.id, productId, { priceCents });
            if (!upd.ok) {
              setError(upd.error.message);
              return;
            }
          }
        } else {
          const created = await createVariantAction(productId, {
            sku,
            priceCents,
            optionValueIds: ids,
            requiresShipping,
            position: i,
          });
          if (!created.ok) {
            setError(created.error.message);
            return;
          }
        }
      }

      setSkuEdits({});
      setPriceEdits({});
      await reload();
    } finally {
      setGenerating(false);
    }
  }

  const pendingCount = combos.filter(
    (c) => !variantByKey.has(signature(c.map((v) => v.id)))
  ).length;

  return (
    <SurfaceStep
      header={{
        title: 'Variants & options',
        supporting:
          'Sell the product in variations — Size, Color, Material. Skip this for a single-SKU product.',
      }}
      actions={{
        onBack,
        onNext: onComplete,
        onSkip: onComplete,
        nextLabel: 'Continue',
        nextDisabled: generating,
      }}
    >
      <Card>
        <CardBody className="py-6">
          {loading ? (
            <div className="text-base-content flex items-center gap-2 py-8">
              <Loading className="h-4 w-4" /> Loading options & variants…
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* ── Options ─────────────────────────────────────────────── */}
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Options</p>
                    <Badge color="neutral" variant="soft" size="sm">
                      {options.length}
                    </Badge>
                  </div>
                  {!editingOptions && (
                    <Button variant="outline" size="sm" onClick={() => setEditingOptions(true)}>
                      {options.length === 0 ? 'Add options' : 'Edit options'}
                    </Button>
                  )}
                </div>

                {editingOptions ? (
                  <div className="border-base-300 rounded-xl border p-4">
                    <OptionsEditor
                      productId={productId}
                      productTitle={productTitle}
                      initialOptions={options}
                      onSaved={() => {
                        setEditingOptions(false);
                        setSkuEdits({});
                        setPriceEdits({});
                        void reload();
                      }}
                      onCancel={() => setEditingOptions(false)}
                    />
                  </div>
                ) : options.length === 0 ? (
                  <p className="text-base-content text-sm">
                    No options — this product is a single SKU (the one you priced). Add an option
                    like Size or Color to sell variations, or continue.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {options.map((o) => (
                      <div key={o.id} className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-medium">{o.name}:</p>
                        {o.values.map((v) => (
                          <Badge key={v.id} variant="soft" size="sm">
                            {v.value}
                          </Badge>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* ── Variant matrix ──────────────────────────────────────── */}
              {!editingOptions && options.length > 0 && (
                <section className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">Variants</p>
                      <Badge color="neutral" variant="soft" size="sm">
                        {combos.length} combination{combos.length === 1 ? '' : 's'}
                      </Badge>
                    </div>
                    {pendingCount > 0 && !overCap && (
                      <Button
                        color="module"
                        size="sm"
                        onClick={() => void generate()}
                        loading={generating}
                        disabled={generating}
                      >
                        Generate {pendingCount} variant{pendingCount === 1 ? '' : 's'}
                      </Button>
                    )}
                  </div>

                  {overCap ? (
                    <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                      {combos.length} combinations exceeds the {MAX_COMBOS}-variant limit. Trim
                      option values, then generate.
                    </FieldStatus>
                  ) : (
                    <div className="border-base-300 overflow-hidden rounded-xl border">
                      {/* eslint-disable-next-line no-restricted-syntax -- table header row with subtle bg, not a reimplemented control */}
                      <div className="border-base-300 bg-base-200 text-base-content grid grid-cols-[1fr_minmax(8rem,1fr)_7rem_5rem] items-center gap-2 border-b px-3 py-2 text-xs font-medium">
                        <span>Combination</span>
                        <span>SKU</span>
                        <span>Price (USD)</span>
                        <span className="text-right">Status</span>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {combos.map((combo) => {
                          const ids = combo.map((v) => v.id);
                          const key = signature(ids);
                          const existing = variantByKey.get(key);
                          const label = combo.map((v) => v.value).join(' · ');
                          return (
                            <div
                              key={key}
                              className="border-base-300 grid grid-cols-[1fr_minmax(8rem,1fr)_7rem_5rem] items-center gap-2 border-b px-3 py-2 last:border-b-0"
                            >
                              <span className="truncate text-sm">{label}</span>
                              <Input
                                value={skuFor(key, combo, existing)}
                                onChange={(e) =>
                                  setSkuEdits((s) => ({ ...s, [key]: e.target.value }))
                                }
                                disabled={!!existing}
                                aria-label={`SKU for ${label}`}
                                className="h-8"
                              />
                              <Input
                                type="number"
                                min="0"
                                inputMode="decimal"
                                value={priceFor(key, existing)}
                                onChange={(e) =>
                                  setPriceEdits((s) => ({ ...s, [key]: e.target.value }))
                                }
                                disabled={!!existing}
                                aria-label={`Price for ${label}`}
                                className="h-8"
                              />
                              <span className="text-right">
                                {existing ? (
                                  <Badge color="success" variant="soft" size="sm">
                                    Created
                                  </Badge>
                                ) : (
                                  <Badge color="info" variant="soft" size="sm">
                                    New
                                  </Badge>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {error && (
                <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                  {error}
                </FieldStatus>
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </SurfaceStep>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function cartesian(arrays: OptionValueRow[][]): OptionValueRow[][] {
  if (arrays.length === 0) return [];
  return arrays.reduce<OptionValueRow[][]>(
    (acc, vals) => acc.flatMap((combo) => vals.map((v) => [...combo, v])),
    [[]]
  );
}

/** Order-independent signature for a set of option-value ids. */
function signature(ids: string[]): string {
  return [...ids].sort().join('|');
}

function suggestSku(base: string, combo: OptionValueRow[]): string {
  const parts = combo.map((v) =>
    v.value
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '')
      .slice(0, 6)
  );
  return [base, ...parts].filter(Boolean).join('-');
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function inputToCents(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100);
}
