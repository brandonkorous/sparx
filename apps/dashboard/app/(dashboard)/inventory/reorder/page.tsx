import Link from 'next/link';
import { RefreshCw, Truck } from 'lucide-react';

import { Badge, Button, Card, CardBody } from '@wizeworks/silicaui-react';
import { PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { ReorderBoard } from './_components/reorder-board';
import {
  formatMoney,
  type ReorderSuggestions,
  type UnsuppliedSuggestion,
} from './_components/types';

// Reorder (docs/100 P3d) — the replenishment surface. Levels at/below their
// reorder point become suggestions grouped by (supplier, warehouse); the buyer
// confirms quantities and drafts one PO per group to the preferred supplier. The
// same engine runs automatically via the (opt-in, paused-by-default) inventory.low
// automation. Items with no supplier link surface separately — link a supplier
// first. "On order" units (already on an open PO) are flagged so nothing is
// double-ordered.

export const dynamic = 'force-dynamic';

export default async function ReorderPage() {
  const res = await api.get<ReorderSuggestions>('/v1/inventory/reorder/suggestions?take=500');
  const { groups, unsupplied, counts } = res;
  const estimatedTotalCents = groups.reduce((s, g) => s + g.estimatedTotalCents, 0);
  const currency = groups[0]?.currency ?? 'USD';

  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          icon={<RefreshCw className="h-5 w-5" />}
          title="Reorder"
          description="Items at or below their reorder point, grouped by supplier. Confirm the quantities and draft a purchase order to the preferred supplier — lead time sets the expected arrival."
        />

        <div className="flex flex-row flex-wrap gap-4">
          <Stat label="Suppliers to order from" value={String(counts.groups)} />
          <Stat label="Items to reorder" value={String(counts.lines)} />
          <Stat
            label="Estimated cost"
            value={estimatedTotalCents > 0 ? formatMoney(estimatedTotalCents, currency) : '—'}
          />
          <Stat label="No supplier linked" value={String(counts.unsupplied)} />
        </div>

        {groups.length === 0 && unsupplied.length === 0 ? (
          <Card>
            <CardBody>
              <div className="flex flex-col items-center gap-2 py-12">
                <h3 className="text-xl font-semibold">Nothing to reorder</h3>
                <p className="text-base-content/70 text-sm">
                  Every tracked item is above its reorder point. Set reorder points on the stock
                  grid to have low items surface here.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  render={<Link href="/inventory/stock" />}
                >
                  Go to stock
                </Button>
              </div>
            </CardBody>
          </Card>
        ) : (
          <ReorderBoard groups={groups} />
        )}

        {unsupplied.length > 0 ? <UnsuppliedPanel items={unsupplied} /> : null}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="min-w-[10rem] flex-1">
      <CardBody>
        <div className="flex flex-col gap-1 py-2">
          <p className="text-base-content/70 text-xs">{label}</p>
          <p className="text-lg">{value}</p>
        </div>
      </CardBody>
    </Card>
  );
}

function UnsuppliedPanel({ items }: { items: UnsuppliedSuggestion[] }) {
  return (
    <Card>
      <CardBody>
        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-row items-center gap-2">
            <Truck className="h-4 w-4" />
            <h3 className="text-xl font-semibold">Low — no supplier linked</h3>
            <Badge color="warning">{items.length}</Badge>
          </div>
          <p className="text-base-content/70 text-sm">
            These items are low but have no purchasing supplier. Link one to a supplier&apos;s
            catalog and they&apos;ll become draftable reorder suggestions.
          </p>
          <div className="flex flex-col gap-2">
            {items.map((it) => (
              <div
                key={`${it.variantId}-${it.warehouseId}`}
                className="border-base-300 flex flex-row flex-wrap items-center gap-3 rounded border px-3 py-2"
              >
                <div className="flex min-w-[12rem] flex-1 flex-col gap-0">
                  <p className="text-sm font-medium">
                    {it.title ?? it.sku ?? it.variantId.slice(0, 8)}
                  </p>
                  <p className="text-base-content/70 font-mono text-xs">
                    {it.sku ?? it.variantId} · {it.warehouseName ?? it.warehouseCode}
                  </p>
                </div>
                <p className="text-base-content/70 text-sm">
                  {it.available} / {it.reorderPoint} reorder pt
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`/inventory/suppliers?variant=${it.variantId}`} />}
                >
                  Link supplier
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
