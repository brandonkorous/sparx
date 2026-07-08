'use client';

// Bulk "List on sparx.market" modal (docs/106 §4.7). The bulk list endpoint takes
// an optional category for the whole selection, so listing several products at
// once first asks which marketplace aisle they go in — then POSTs
// /v1/market/products/bulk { productIds, listed: true, category }.

import * as React from 'react';
import { MARKET_CATEGORIES } from '@sparx/commerce-schemas';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Label,
  Select,
} from 'silicaui-react';
import { toast } from '@sparx/ui';

import { bulkSetProductMarketStateAction } from '../../product-actions';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productIds: string[];
  onListed: () => void;
}

export function BulkMarketListModal({ open, onOpenChange, productIds, onListed }: Props) {
  const [category, setCategory] = React.useState('general');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setCategory('general');
      setError(null);
      setBusy(false);
    }
    onOpenChange(next);
  }

  async function onConfirm() {
    setBusy(true);
    setError(null);
    const res = await bulkSetProductMarketStateAction({ productIds, listed: true, category });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    const n = res.data.updated;
    toast.success(
      n === 1 ? 'Product listed on sparx.market' : `${n} products listed on sparx.market`,
      { description: 'They’re now discoverable on the marketplace.' }
    );
    onListed();
    handleOpenChange(false);
  }

  const count = productIds.length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <div>
          <DialogTitle>List on sparx.market</DialogTitle>
          <DialogDescription>
            List {count} product{count === 1 ? '' : 's'} on the first-party marketplace. Pick the
            category they belong in.
          </DialogDescription>
        </div>
        <div className="flex flex-col gap-2 px-6 py-2">
          <Label htmlFor="bulk-market-category">Category</Label>
          <Select
            id="bulk-market-category"
            value={category}
            onValueChange={(v) => setCategory(v as string)}
            disabled={busy}
            items={Object.fromEntries(MARKET_CATEGORIES.map((c) => [c.slug, c.name]))}
          />
          {error && (
            <p className="text-danger text-sm" role="alert" aria-live="polite">
              {error}
            </p>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button color="module" onClick={() => void onConfirm()} loading={busy} disabled={busy}>
            List {count} product{count === 1 ? '' : 's'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
