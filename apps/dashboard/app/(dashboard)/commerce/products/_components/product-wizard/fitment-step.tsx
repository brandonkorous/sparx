'use client';

// Product wizard — Fitment step (conditional).
//
// Fitment is GENERALIZED, not automotive: a domain declares its levels and
// labels (vehicle → Make/Model/Engine, pet store → Species/Breed, phone cases →
// Brand/Model). This step drives the same domain → category → item → variant
// cascade the detail tab uses, labelled dynamically from the domain so it stays
// generic. The wizard only renders this step when the tenant actually has
// fitment data (a domain with categories) — see the gate in index.tsx.
//
// Saves are replace-all (PUT /fitment), so we load existing rows first and send
// the full set each time.

import * as React from 'react';
import { Plus, Trash } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  NativeSelect,
  Spinner,
  Text,
  SurfaceStep,
} from '@sparx/ui';

import {
  listFitmentCategoriesAction,
  listFitmentDomainsAction,
  listFitmentItemsAction,
  listFitmentVariantsAction,
  listProductFitmentAction,
  setProductFitmentAction,
  type FitmentCategoryRow,
  type FitmentDomainRow,
  type FitmentItemRow,
  type FitmentVariantRow,
  type ProductFitmentRow,
} from '../../../fitment-actions';

interface FitmentStepProps {
  productId: string;
  onBack: () => void;
  onComplete: () => void;
}

/** Convert a display-named row back to the PUT entry shape. */
function toEntry(r: ProductFitmentRow): Record<string, unknown> {
  return {
    domainId: r.domainId,
    categoryId: r.categoryId,
    ...(r.itemId ? { itemId: r.itemId } : {}),
    ...(r.variantId ? { variantId: r.variantId } : {}),
    ...(r.rangeMin !== null ? { rangeMin: r.rangeMin } : {}),
    ...(r.rangeMax !== null ? { rangeMax: r.rangeMax } : {}),
    ...(r.notes ? { notes: r.notes } : {}),
  };
}

export function FitmentStep({ productId, onBack, onComplete }: FitmentStepProps) {
  const [loading, setLoading] = React.useState(true);
  const [domains, setDomains] = React.useState<FitmentDomainRow[]>([]);
  const [rows, setRows] = React.useState<ProductFitmentRow[]>([]);

  const [domainId, setDomainId] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [itemId, setItemId] = React.useState('');
  const [variantId, setVariantId] = React.useState('');
  const [rangeMin, setRangeMin] = React.useState('');
  const [rangeMax, setRangeMax] = React.useState('');

  const [categories, setCategories] = React.useState<FitmentCategoryRow[]>([]);
  const [items, setItems] = React.useState<FitmentItemRow[]>([]);
  const [variants, setVariants] = React.useState<FitmentVariantRow[]>([]);

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const domain = domains.find((d) => d.id === domainId);

  const reloadRows = React.useCallback(async () => {
    const res = await listProductFitmentAction(productId);
    if (res.ok) setRows(res.data);
  }, [productId]);

  React.useEffect(() => {
    let cancelled = false;
    void Promise.all([listFitmentDomainsAction(), listProductFitmentAction(productId)])
      .then(([dRes, fRes]) => {
        if (cancelled) return;
        if (dRes.ok) {
          setDomains(dRes.data);
          setDomainId((prev) => (prev ? prev : (dRes.data[0]?.id ?? '')));
        }
        if (fRes.ok) setRows(fRes.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  // Cascade: domain → categories.
  React.useEffect(() => {
    if (!domainId) return;
    let cancelled = false;
    setCategoryId('');
    setItems([]);
    setVariants([]);
    void listFitmentCategoriesAction(domainId).then((res) => {
      if (!cancelled && res.ok) setCategories(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [domainId]);

  // category → items (only if the domain has an L2 level).
  React.useEffect(() => {
    if (!categoryId || !domain?.labels.l2) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setItemId('');
    setVariants([]);
    void listFitmentItemsAction(categoryId).then((res) => {
      if (!cancelled && res.ok) setItems(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [categoryId, domain?.labels.l2]);

  // item → variants (only if the domain has an L3 level).
  React.useEffect(() => {
    if (!itemId || !domain?.labels.l3) {
      setVariants([]);
      return;
    }
    let cancelled = false;
    setVariantId('');
    void listFitmentVariantsAction(itemId).then((res) => {
      if (!cancelled && res.ok) setVariants(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [itemId, domain?.labels.l3]);

  async function persist(next: Record<string, unknown>[]) {
    setSaving(true);
    setError(null);
    try {
      const res = await setProductFitmentAction(productId, next);
      if (!res.ok) {
        setError(res.error.message);
        return false;
      }
      await reloadRows();
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function addRow() {
    if (!domainId || !categoryId) {
      setError(`Pick a ${domain?.labels.l1?.toLowerCase() ?? 'category'} first.`);
      return;
    }
    const min = rangeMin.trim() ? Number.parseFloat(rangeMin) : undefined;
    const max = rangeMax.trim() ? Number.parseFloat(rangeMax) : undefined;
    if (min !== undefined && max !== undefined && min > max) {
      setError('Range min must be ≤ range max.');
      return;
    }
    const entry: Record<string, unknown> = {
      domainId,
      categoryId,
      ...(itemId ? { itemId } : {}),
      ...(variantId ? { variantId } : {}),
      ...(min !== undefined && Number.isFinite(min) ? { rangeMin: min } : {}),
      ...(max !== undefined && Number.isFinite(max) ? { rangeMax: max } : {}),
    };
    const ok = await persist([...rows.map(toEntry), entry]);
    if (ok) {
      setCategoryId('');
      setItemId('');
      setVariantId('');
      setRangeMin('');
      setRangeMax('');
    }
  }

  async function removeRow(id: string) {
    await persist(rows.filter((r) => r.id !== id).map(toEntry));
  }

  function rowLabel(r: ProductFitmentRow): string {
    const parts = [r.categoryName, r.itemName, r.variantName].filter(Boolean);
    let label = parts.join(' · ');
    if (r.rangeMin !== null || r.rangeMax !== null) {
      label += ` (${r.rangeMin ?? '…'}–${r.rangeMax ?? '…'})`;
    }
    return label.length > 0 ? label : r.domainSlug;
  }

  return (
    <SurfaceStep
      header={{
        title: 'Fitment & compatibility',
        supporting: 'List what this product fits or works with. Add as many entries as you need.',
      }}
      actions={{
        onBack,
        onNext: onComplete,
        onSkip: onComplete,
        nextLabel: 'Continue',
        nextDisabled: saving,
      }}
    >
      <Card variant="module">
        <CardContent className="py-6">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-[var(--color-text-muted)]">
              <Spinner className="h-4 w-4" /> Loading fitment…
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* Existing entries */}
              {rows.length > 0 && (
                <div className="flex flex-col gap-2">
                  {rows.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border-default)] px-3 py-2"
                    >
                      <span className="flex items-center gap-2 text-sm">
                        <Badge variant="soft" size="sm">
                          {r.domainSlug}
                        </Badge>
                        {rowLabel(r)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void removeRow(r.id)}
                        disabled={saving}
                        aria-label={`Remove ${rowLabel(r)}`}
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add a new entry — the cascade */}
              <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border-default)] p-4">
                <Text size="sm" weight="medium">
                  Add a fit
                </Text>

                {domains.length > 1 && (
                  <div>
                    <Label htmlFor="ft-domain">Kind</Label>
                    <NativeSelect
                      id="ft-domain"
                      value={domainId}
                      onChange={(e) => setDomainId(e.target.value)}
                    >
                      {domains.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.displayName}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="ft-cat">{domain?.labels.l1 ?? 'Category'}</Label>
                    <NativeSelect
                      id="ft-cat"
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>

                  {domain?.labels.l2 && (
                    <div>
                      <Label htmlFor="ft-item">{domain.labels.l2}</Label>
                      <NativeSelect
                        id="ft-item"
                        value={itemId}
                        onChange={(e) => setItemId(e.target.value)}
                        disabled={!categoryId || items.length === 0}
                      >
                        <option value="">Any</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  )}

                  {domain?.labels.l3 && (
                    <div>
                      <Label htmlFor="ft-variant">{domain.labels.l3}</Label>
                      <NativeSelect
                        id="ft-variant"
                        value={variantId}
                        onChange={(e) => setVariantId(e.target.value)}
                        disabled={!itemId || variants.length === 0}
                      >
                        <option value="">Any</option>
                        {variants.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                  )}
                </div>

                {(domain?.rangeUnit != null || domain?.labels.range != null) && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="ft-min">
                        {domain.labels.range ?? 'Range'} from
                        {domain.rangeUnit ? ` (${domain.rangeUnit})` : ''}
                      </Label>
                      <Input
                        id="ft-min"
                        inputMode="numeric"
                        value={rangeMin}
                        onChange={(e) => setRangeMin(e.target.value)}
                        placeholder="2011"
                      />
                    </div>
                    <div>
                      <Label htmlFor="ft-max">{domain.labels.range ?? 'Range'} to</Label>
                      <Input
                        id="ft-max"
                        inputMode="numeric"
                        value={rangeMax}
                        onChange={(e) => setRangeMax(e.target.value)}
                        placeholder="2016"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    type="button"
                    color="module"
                    size="sm"
                    onClick={() => void addRow()}
                    disabled={saving || !categoryId}
                    loading={saving}
                    leftIcon={<Plus className="h-3.5 w-3.5" />}
                  >
                    Add fit
                  </Button>
                </div>
              </div>

              {error && (
                <Text size="sm" variant="danger" role="alert">
                  {error}
                </Text>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </SurfaceStep>
  );
}
