'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Table } from '@wizeworks/silicaui-react';
import { deleteAccountOverride } from '../../_lib/actions';

interface Override {
  id: string;
  variantId: string | null;
  collectionId: string | null;
  priceCents: number | null;
  discountPercentage: string | null;
  notes: string | null;
  variant?: { id: string; sku: string; title: string } | null;
  collection?: { id: string; title: string } | null;
}

interface Props {
  accountId: string;
  overrides: Override[];
}

export function B2bAccountOverridesTable({ accountId, overrides }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Map<string, string>>(new Map());

  async function handleDelete(oid: string) {
    setDeleting(oid);
    setRowErrors((prev) => {
      const m = new Map(prev);
      m.delete(oid);
      return m;
    });
    try {
      const { error } = await deleteAccountOverride(accountId, oid);
      if (error) {
        setRowErrors((prev) => new Map(prev).set(oid, error));
      } else {
        startTransition(() => router.refresh());
      }
    } finally {
      setDeleting(null);
    }
  }

  if (overrides.length === 0) {
    return (
      <div className="flex flex-col gap-3 p-6 text-center">
        <p className="text-base-content/70 text-sm">
          No product overrides. Overrides let you set a specific price or additional discount for
          this account on individual variants or collections.
        </p>
        <div>
          <Button
            color="module"
            variant="outline"
            size="sm"
            iconStart={<Plus className="h-3.5 w-3.5" />}
            disabled
          >
            Add override
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Table>
        <thead>
          <tr>
            <th>Scope</th>
            <th>SKU / Collection</th>
            <th>Override</th>
            <th>Notes</th>
            <th className="w-12" />
          </tr>
        </thead>
        <tbody>
          {overrides.map((o) => (
            <tr key={o.id}>
              <td>
                <Badge color={o.variantId ? 'module' : 'neutral'} variant="soft" size="sm">
                  {o.variantId ? 'Variant' : 'Collection'}
                </Badge>
              </td>
              <td>
                <p className="text-sm">
                  {o.variant
                    ? `${o.variant.sku} — ${o.variant.title}`
                    : (o.collection?.title ?? '—')}
                </p>
              </td>
              <td>
                {o.priceCents !== null ? (
                  <Badge color="success" variant="soft">
                    ${(o.priceCents / 100).toFixed(2)} fixed
                  </Badge>
                ) : o.discountPercentage !== null ? (
                  <Badge color="module" variant="soft">
                    {Number(o.discountPercentage)}% off
                  </Badge>
                ) : (
                  <p className="text-base-content/70 text-sm">—</p>
                )}
              </td>
              <td>
                <p className="text-base-content/70 max-w-[200px] truncate text-sm">
                  {o.notes ?? '—'}
                </p>
              </td>
              <td>
                <div className="flex flex-col items-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    color="danger"
                    disabled={deleting === o.id}
                    onClick={() => void handleDelete(o.id)}
                    aria-label="Remove override"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  {rowErrors.get(o.id) && (
                    <p className="text-danger text-right text-xs">{rowErrors.get(o.id)}</p>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <div className="border-base-300 border-t p-4">
        <Button
          color="module"
          variant="outline"
          size="sm"
          iconStart={<Plus className="h-3.5 w-3.5" />}
          disabled
        >
          Add override
        </Button>
      </div>
    </div>
  );
}
