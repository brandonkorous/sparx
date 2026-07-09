'use client';

// Product wizard — Fitment step (conditional).
//
// Fitment is GENERALIZED, not automotive: a domain declares an ordered list of
// DIMENSIONS — `level` tiers (vehicle → Make/Model/Engine, pet store →
// Species/Breed) + `range` axes (Year, Weight). This step drives the same
// dimension-aware node drill the detail tab uses, so it stays generic. The
// wizard only renders this step when the tenant actually has fitment data — see
// the gate in index.tsx.
//
// Saves are replace-all (PUT /fitment): load existing rows first, send the full
// set each time.

import * as React from 'react';
import { Plus, Trash } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Loading,
  NativeSelect,
} from '@wizeworks/silicaui-react';
import { SurfaceStep } from '@sparx/ui';

import {
  listFitmentDomainsAction,
  listProductFitmentAction,
  setProductFitmentAction,
  type FitmentDimension,
  type FitmentDomainRow,
  type ProductFitmentRow,
} from '../../../fitment-actions';
import { FitmentNodeDrill } from '../fitment-node-drill';

interface FitmentStepProps {
  productId: string;
  onBack: () => void;
  onComplete: () => void;
}

function levelsOf(d: FitmentDomainRow): FitmentDimension[] {
  return d.dimensions.filter((dim) => dim.kind === 'level');
}
function rangesOf(d: FitmentDomainRow): FitmentDimension[] {
  return d.dimensions.filter((dim) => dim.kind === 'range');
}

/** Convert a saved row back to the PUT entry shape. */
function toEntry(r: ProductFitmentRow): Record<string, unknown> {
  return {
    domainId: r.domainId,
    nodeId: r.nodeId,
    ranges: r.ranges.map((rg) => ({
      dimensionKey: rg.dimensionKey,
      ...(rg.min !== null ? { min: rg.min } : {}),
      ...(rg.max !== null ? { max: rg.max } : {}),
    })),
    ...(r.notes ? { notes: r.notes } : {}),
  };
}

export function FitmentStep({ productId, onBack, onComplete }: FitmentStepProps) {
  const [loading, setLoading] = React.useState(true);
  const [domains, setDomains] = React.useState<FitmentDomainRow[]>([]);
  const [rows, setRows] = React.useState<ProductFitmentRow[]>([]);

  const [domainId, setDomainId] = React.useState('');
  const [nodeId, setNodeId] = React.useState<string | null>(null);
  const [rangeInputs, setRangeInputs] = React.useState<
    Record<string, { min: string; max: string }>
  >({});

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const domain = domains.find((d) => d.id === domainId);
  const ranges = domain ? rangesOf(domain) : [];

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

  React.useEffect(() => {
    setNodeId(null);
    setRangeInputs({});
  }, [domainId]);

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
    if (!domainId) {
      setError('Pick a domain first.');
      return;
    }
    const builtRanges: { dimensionKey: string; min?: number; max?: number }[] = [];
    for (const dim of ranges) {
      const raw = rangeInputs[dim.key];
      const min = raw?.min.trim() ? Number.parseFloat(raw.min) : undefined;
      const max = raw?.max.trim() ? Number.parseFloat(raw.max) : undefined;
      if (min === undefined && max === undefined) continue;
      if (min !== undefined && max !== undefined && min > max) {
        setError(`${dim.label}: from must be ≤ to.`);
        return;
      }
      builtRanges.push({
        dimensionKey: dim.key,
        ...(min !== undefined ? { min } : {}),
        ...(max !== undefined ? { max } : {}),
      });
    }
    const entry = { domainId, nodeId, ranges: builtRanges };
    const ok = await persist([...rows.map(toEntry), entry]);
    if (ok) {
      setNodeId(null);
      setRangeInputs({});
    }
  }

  async function removeRow(id: string) {
    await persist(rows.filter((r) => r.id !== id).map(toEntry));
  }

  function rowLabel(r: ProductFitmentRow): string {
    let label = r.nodePath.length > 0 ? r.nodePath.join(' · ') : 'Any';
    if (r.ranges.length > 0) {
      label += ` (${r.ranges.map((rg) => `${rg.min ?? '…'}–${rg.max ?? '…'}`).join(', ')})`;
    }
    return label;
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
      <Card>
        <CardBody className="py-6">
          {loading ? (
            <div className="text-base-content/60 flex items-center gap-2 py-8">
              <Loading className="h-4 w-4" /> Loading fitment…
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {rows.length > 0 && (
                <div className="flex flex-col gap-2">
                  {rows.map((r) => (
                    <div
                      key={r.id}
                      className="border-base-300 flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
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

              <div className="border-base-300 flex flex-col gap-3 rounded-xl border p-4">
                <p className="text-sm font-medium">Add a fit</p>

                {domains.length > 1 && (
                  <Field>
                    <FieldLabel>Kind</FieldLabel>
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
                  </Field>
                )}

                {domain && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <FitmentNodeDrill
                      key={domainId}
                      domainId={domain.id}
                      levels={levelsOf(domain)}
                      onChange={setNodeId}
                      className="min-w-0"
                    />
                  </div>
                )}

                {ranges.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {ranges.map((dim) => (
                      <div key={dim.key} className="grid grid-cols-2 gap-2">
                        <Field>
                          <FieldLabel>
                            {dim.label} from{dim.unit ? ` (${dim.unit})` : ''}
                          </FieldLabel>
                          <FieldControl
                            id={`ft-${dim.key}-min`}
                            type="number"
                            value={rangeInputs[dim.key]?.min ?? ''}
                            onChange={(e) =>
                              setRangeInputs((prev) => ({
                                ...prev,
                                [dim.key]: { min: e.target.value, max: prev[dim.key]?.max ?? '' },
                              }))
                            }
                          />
                        </Field>
                        <Field>
                          <FieldLabel>{dim.label} to</FieldLabel>
                          <FieldControl
                            id={`ft-${dim.key}-max`}
                            type="number"
                            value={rangeInputs[dim.key]?.max ?? ''}
                            onChange={(e) =>
                              setRangeInputs((prev) => ({
                                ...prev,
                                [dim.key]: { min: prev[dim.key]?.min ?? '', max: e.target.value },
                              }))
                            }
                          />
                        </Field>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    type="button"
                    color="module"
                    size="sm"
                    onClick={() => void addRow()}
                    disabled={saving}
                    loading={saving}
                    iconStart={<Plus className="h-3.5 w-3.5" />}
                  >
                    Add fit
                  </Button>
                </div>
              </div>

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
