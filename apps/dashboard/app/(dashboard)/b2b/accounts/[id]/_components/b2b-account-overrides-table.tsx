'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';
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
      <Stack gap={3} className="p-6 text-center">
        <Text size="sm" variant="muted">
          No product overrides. Overrides let you set a specific price or additional discount for
          this account on individual variants or collections.
        </Text>
        <div>
          <Button
            color="module"
            variant="outline"
            size="sm"
            leftIcon={<Plus className="h-3.5 w-3.5" />}
            disabled
          >
            Add override
          </Button>
        </div>
      </Stack>
    );
  }

  return (
    <Stack gap={0}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Scope</TableHead>
            <TableHead>SKU / Collection</TableHead>
            <TableHead>Override</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {overrides.map((o) => (
            <TableRow key={o.id}>
              <TableCell>
                <Badge color={o.variantId ? 'module' : 'neutral'} variant="soft" size="sm">
                  {o.variantId ? 'Variant' : 'Collection'}
                </Badge>
              </TableCell>
              <TableCell>
                <Text size="sm">
                  {o.variant
                    ? `${o.variant.sku} — ${o.variant.title}`
                    : (o.collection?.title ?? '—')}
                </Text>
              </TableCell>
              <TableCell>
                {o.priceCents !== null ? (
                  <Badge color="success" variant="soft">
                    ${(o.priceCents / 100).toFixed(2)} fixed
                  </Badge>
                ) : o.discountPercentage !== null ? (
                  <Badge color="module" variant="soft">
                    {Number(o.discountPercentage)}% off
                  </Badge>
                ) : (
                  <Text size="sm" variant="muted">
                    —
                  </Text>
                )}
              </TableCell>
              <TableCell>
                <Text size="sm" variant="muted" className="max-w-[200px] truncate">
                  {o.notes ?? '—'}
                </Text>
              </TableCell>
              <TableCell>
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
                    <Text size="xs" className="text-right text-[var(--color-danger)]">
                      {rowErrors.get(o.id)}
                    </Text>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="border-t border-[var(--color-border-default)] p-4">
        <Button
          color="module"
          variant="outline"
          size="sm"
          leftIcon={<Plus className="h-3.5 w-3.5" />}
          disabled
        >
          Add override
        </Button>
      </div>
    </Stack>
  );
}
