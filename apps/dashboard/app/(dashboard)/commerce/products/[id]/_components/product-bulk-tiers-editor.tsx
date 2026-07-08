'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Layers, Trash2 } from 'lucide-react';

import { Badge, Button, EmptyState, Input, Label, NativeSelect, Table } from 'silicaui-react';
import { useConfirm } from '@sparx/ui';

import { createBulkTierAction, deleteBulkTierAction } from '../../../pricing-actions';

// Variant-scoped bulk price tiers, managed from the product's Pricing tab. A
// tier is a quantity ramp ("10+ at a lower unit price"); it's always scoped to
// ONE variant here (price-list-scoped tiers are created from a price list). The
// resolution engine applies a tier only when its unit price beats the otherwise-
// resolved price (pricing-service `resolve`), so a tier at or above base is inert
// — flagged in the table so the operator catches it.

export interface BulkTierVariant {
  id: string;
  sku: string;
  title: string | null;
  priceCents: number;
  currency: string;
}

export interface BulkTierRow {
  id: string;
  variantId: string | null;
  minQuantity: number;
  unitPriceCents: number;
}

// A tier joined to its variant + precomputed display fields — the table is then
// purely presentational.
interface DisplayTier {
  tier: BulkTierRow;
  name: string;
  sku: string | null;
  priceLabel: string;
  offPct: number | null;
}

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(
    cents / 100
  );
}

export function ProductBulkTiersEditor({
  variants,
  tiers,
}: {
  variants: BulkTierVariant[];
  tiers: BulkTierRow[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [variantId, setVariantId] = React.useState(variants[0]?.id ?? '');
  const [minQuantity, setMinQuantity] = React.useState('');
  const [unitPrice, setUnitPrice] = React.useState('');

  const single = variants.length === 1;
  const byId = React.useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);
  const currency = byId.get(variantId)?.currency ?? variants[0]?.currency ?? 'USD';

  // Join each variant-scoped tier to its variant and precompute display fields,
  // ordered by variant SKU then ascending quantity.
  const rows: DisplayTier[] = tiers
    .filter((t): t is BulkTierRow & { variantId: string } => !!t.variantId && byId.has(t.variantId))
    .sort((a, b) => {
      const sa = byId.get(a.variantId)?.sku ?? '';
      const sb = byId.get(b.variantId)?.sku ?? '';
      return sa === sb ? a.minQuantity - b.minQuantity : sa.localeCompare(sb);
    })
    .map((tier) => {
      const v = byId.get(tier.variantId);
      const base = v?.priceCents ?? 0;
      return {
        tier,
        name: v?.title ?? v?.sku ?? '—',
        sku: v?.title ? (v?.sku ?? null) : null,
        priceLabel: money(tier.unitPriceCents, v?.currency ?? currency),
        offPct: base > 0 ? ((base - tier.unitPriceCents) / base) * 100 : null,
      };
    });

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!variantId) {
      setError('Pick a variant.');
      return;
    }
    const min = Number(minQuantity);
    if (!Number.isInteger(min) || min < 2) {
      setError('Minimum quantity must be a whole number of 2 or more.');
      return;
    }
    const dollars = Number(unitPrice);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError('Unit price must be greater than zero.');
      return;
    }
    startTransition(async () => {
      const result = await createBulkTierAction({
        variantId,
        minQuantity: min,
        unitPriceCents: Math.round(dollars * 100),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setMinQuantity('');
      setUnitPrice('');
      router.refresh();
    });
  }

  function onDelete(tier: BulkTierRow) {
    setError(null);
    const v = tier.variantId ? byId.get(tier.variantId) : null;
    void (async () => {
      const okConfirm = await confirm({
        title: 'Delete this bulk tier?',
        description: `The ${tier.minQuantity}+ tier${v ? ` on ${v.sku}` : ''} will be removed. That quantity falls back to the standard price-resolution chain.`,
        confirmLabel: 'Delete tier',
        tone: 'danger',
      });
      if (!okConfirm) return;
      startTransition(async () => {
        const result = await deleteBulkTierAction(tier.id);
        if (!result.ok) {
          setError(result.error.message);
          return;
        }
        router.refresh();
      });
    })();
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onAdd}>
        <div className="flex flex-row flex-wrap items-end gap-3 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-3">
          {!single && (
            <div className="flex min-w-[14rem] flex-1 flex-col gap-1">
              <Label htmlFor="bt-variant">Variant</Label>
              <NativeSelect
                id="bt-variant"
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
              >
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title ?? v.sku} · base {money(v.priceCents, v.currency)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          <div className="flex w-28 flex-col gap-1">
            <Label htmlFor="bt-min">Min qty</Label>
            <Input
              id="bt-min"
              value={minQuantity}
              onChange={(e) => setMinQuantity(e.target.value)}
              placeholder="10"
              inputMode="numeric"
            />
          </div>
          <div className="flex w-36 flex-col gap-1">
            <Label htmlFor="bt-price">Unit price ({currency})</Label>
            <Input
              id="bt-price"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
            />
          </div>
          <Button color="module" type="submit" disabled={pending} loading={pending}>
            Add tier
          </Button>
        </div>
        {error && (
          <p className="text-danger mt-2 text-xs" role="alert" aria-live="polite">
            {error}
          </p>
        )}
      </form>

      <BulkTierTable rows={rows} pending={pending} onDelete={onDelete} />
    </div>
  );
}

// Presentational results table — joined display rows in, delete callback out.
function BulkTierTable({
  rows,
  pending,
  onDelete,
}: {
  rows: DisplayTier[];
  pending: boolean;
  onDelete: (tier: BulkTierRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Layers className="h-5 w-5" />}
        title="No bulk tiers yet"
        description="Add a quantity ramp above — e.g. 10+ at a lower unit price. A tier applies only when its price beats the otherwise-resolved price, and variant tiers override price-list tiers."
      />
    );
  }
  return (
    <Table>
      <thead>
        <tr>
          <th>Variant</th>
          <th className="text-right">Min qty</th>
          <th className="text-right">Unit price</th>
          <th className="text-right">vs. base</th>
          <th className="w-10" />
        </tr>
      </thead>
      <tbody>
        {rows.map(({ tier, name, sku, priceLabel, offPct }) => (
          <tr key={tier.id}>
            <td>
              <div className="flex flex-col gap-0">
                <span className="font-medium">{name}</span>
                {sku && (
                  <span className="font-mono text-xs text-[var(--color-text-muted)]">{sku}</span>
                )}
              </div>
            </td>
            <td className="text-right tabular-nums">{tier.minQuantity}+</td>
            <td className="text-right tabular-nums">{priceLabel}</td>
            <td className="text-right">
              {offPct === null ? (
                <span className="text-base-content/70 text-sm">—</span>
              ) : offPct > 0 ? (
                <Badge color="success" variant="soft" size="sm">
                  {offPct.toFixed(0)}% off
                </Badge>
              ) : (
                <Badge color="warning" variant="soft" size="sm">
                  at/above base
                </Badge>
              )}
            </td>
            <td>
              <Button
                variant="ghost"
                color="danger"
                size="sm"
                onClick={() => onDelete(tier)}
                disabled={pending}
                aria-label={`Delete the ${tier.minQuantity}+ tier`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
