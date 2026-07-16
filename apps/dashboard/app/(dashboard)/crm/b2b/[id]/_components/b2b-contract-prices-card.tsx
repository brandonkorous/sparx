'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardTitle,
  EmptyState,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Table,
} from '@wizeworks/silicaui-react';
import { useFieldValidation } from '@sparx/forms';

import {
  createContractPriceAction,
  deleteContractPriceAction,
  type ContractPriceRow,
} from '../../../../commerce/pricing-actions';

const moneyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export interface VariantSummary {
  id: string;
  sku: string;
  title: string | null;
  basePriceCents: number;
  productTitle: string;
}

// Contract prices are the TOP of the pricing resolution chain (contract price
// → price list → bulk tier → variant base — packages/commerce-schemas/src/
// pricing.ts). This is the merchant-facing surface for the negotiated,
// signed-agreement price a specific B2B account gets on a specific variant.
export function B2bContractPricesCard({
  accountId,
  contractPrices,
  variants,
}: {
  accountId: string;
  contractPrices: ContractPriceRow[];
  variants: VariantSummary[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [variantId, setVariantId] = React.useState('');
  const [price, setPrice] = React.useState('');
  const [validFrom, setValidFrom] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [validTo, setValidTo] = React.useState('');

  const values = { variantId, price };
  const v = useFieldValidation(values, {
    variantId: (val) => (String(val).trim() === '' ? 'Pick a variant.' : null),
    price: (val) => {
      const n = Number(String(val).trim());
      return Number.isFinite(n) && n > 0 ? null : 'Price must be greater than 0.';
    },
  });

  function resetForm() {
    setVariantId('');
    setPrice('');
    setValidTo('');
  }

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!v.validate()) return;

    startTransition(async () => {
      const result = await createContractPriceAction(
        {
          b2bAccountId: accountId,
          variantId,
          priceCents: Math.round(Number(price.trim()) * 100),
          validFrom: new Date(validFrom).toISOString(),
          ...(validTo ? { validTo: new Date(validTo).toISOString() } : {}),
        },
        accountId
      );
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      resetForm();
      router.refresh();
    });
  }

  function onDelete(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteContractPriceAction(id, accountId);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardBody>
        <CardTitle>Contract prices</CardTitle>
        <p className="text-base-content -mt-2 text-sm">
          Negotiated per-variant prices for this account — the first thing checked when pricing an
          order, above price lists and bulk tiers.
        </p>

        <form onSubmit={onAdd} noValidate>
          <div className="border-base-300 bg-base-200 flex flex-row flex-wrap items-end gap-3 rounded border p-3">
            <Field {...v.field('variantId')} className="min-w-[16rem] flex-1">
              <FieldLabel required>Variant</FieldLabel>
              <FieldControl
                name="variantId"
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                {...v.control('variantId')}
                render={
                  <select className="border-base-300 bg-base-100 h-9 rounded border px-3 text-sm">
                    <option value="">— pick —</option>
                    {variants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.productTitle} · {variant.sku}
                        {variant.title ? ` (${variant.title})` : ''} — base{' '}
                        {moneyFmt.format(variant.basePriceCents / 100)}
                      </option>
                    ))}
                  </select>
                }
              />
            </Field>
            <Field {...v.field('price')} className="w-[8rem]">
              <FieldLabel required>Price ($)</FieldLabel>
              <FieldControl
                name="price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                {...v.control('price')}
              />
            </Field>
            <Field className="w-[10rem]">
              <FieldLabel>Valid from</FieldLabel>
              <FieldControl
                name="validFrom"
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
              />
            </Field>
            <Field className="w-[10rem]">
              <FieldLabel>Valid to</FieldLabel>
              <FieldControl
                name="validTo"
                type="date"
                value={validTo}
                onChange={(e) => setValidTo(e.target.value)}
                placeholder="no end"
              />
            </Field>
            <Button color="module" type="submit" size="sm" disabled={pending}>
              {pending ? 'Saving…' : 'Add'}
            </Button>
          </div>
          {error && (
            <FieldStatus
              status="error"
              attached={false}
              role="alert"
              aria-live="polite"
              className="mt-2"
            >
              {error}
            </FieldStatus>
          )}
        </form>

        {contractPrices.length === 0 ? (
          <EmptyState
            icon={<span className="text-2xl">$</span>}
            title="No contract prices yet"
            description="Add one above to give this account a negotiated price on a specific variant."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Price</th>
                <th>Valid</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {contractPrices.map((cp) => (
                <tr key={cp.id}>
                  <td>
                    <span className="font-mono text-xs">{cp.variantSku}</span>
                  </td>
                  <td>{cp.productTitle}</td>
                  <td>
                    <Badge color="module" variant="soft" size="sm">
                      {moneyFmt.format(cp.priceCents / 100)}
                    </Badge>
                  </td>
                  <td className="text-sm">
                    {new Date(cp.validFrom).toLocaleDateString()}
                    {cp.validTo ? ` – ${new Date(cp.validTo).toLocaleDateString()}` : '+'}
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(cp.id)}
                      disabled={pending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}
