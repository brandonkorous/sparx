import { RefreshCw } from 'lucide-react';

import { Card, CardBody } from '@wizeworks/silicaui-react';
import { ListPageShell, PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { ReorderWorkspace } from './_components/reorder-workspace';
import { formatMoney, type ReorderSuggestions } from './_components/types';

// Reorder (docs/100 P3d) — the replenishment surface. Levels at/below their
// reorder point become suggestions grouped by (supplier, warehouse); the buyer
// confirms quantities and drafts one PO per group to the preferred supplier. The
// same engine runs automatically via the (opt-in, paused-by-default) inventory.low
// automation. Items with no supplier link surface separately — link a supplier
// first. "On order" units (already on an open PO) are flagged so nothing is
// double-ordered.
//
// Suggestions are a single bounded fetch (not paginated), so this page has no
// ListToolbar/ListPager at the shell level — the search/filter bar + Table/Cards
// question are handled inside `ReorderWorkspace` (see its header comment).

export const dynamic = 'force-dynamic';

export default async function ReorderPage() {
  const res = await api.get<ReorderSuggestions>('/v1/inventory/reorder/suggestions?take=500');
  const { groups, unsupplied, counts } = res;
  const estimatedTotalCents = groups.reduce((s, g) => s + g.estimatedTotalCents, 0);
  const currency = groups[0]?.currency ?? 'USD';

  return (
    <ListPageShell
      header={
        <PageHeader
          className="mb-0"
          icon={<RefreshCw className="h-5 w-5" />}
          title="Reorder"
          description="Items at or below their reorder point, grouped by supplier. Confirm the quantities and draft a purchase order to the preferred supplier — lead time sets the expected arrival."
        />
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-row flex-wrap gap-4">
          <Stat label="Suppliers to order from" value={String(counts.groups)} />
          <Stat label="Items to reorder" value={String(counts.lines)} />
          <Stat
            label="Estimated cost"
            value={estimatedTotalCents > 0 ? formatMoney(estimatedTotalCents, currency) : '—'}
          />
          <Stat label="No supplier linked" value={String(counts.unsupplied)} />
        </div>

        <ReorderWorkspace groups={groups} unsupplied={unsupplied} />
      </div>
    </ListPageShell>
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
