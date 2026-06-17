import Link from 'next/link';
import { RefreshCw, Truck } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  Container,
  Heading,
  PageHeader,
  Stack,
  Text,
} from '@sparx/ui';

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
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<RefreshCw className="h-5 w-5" />}
          title="Reorder"
          description="Items at or below their reorder point, grouped by supplier. Confirm the quantities and draft a purchase order to the preferred supplier — lead time sets the expected arrival."
        />

        <Stack direction="row" gap={4} wrap>
          <Stat label="Suppliers to order from" value={String(counts.groups)} />
          <Stat label="Items to reorder" value={String(counts.lines)} />
          <Stat
            label="Estimated cost"
            value={estimatedTotalCents > 0 ? formatMoney(estimatedTotalCents, currency) : '—'}
          />
          <Stat label="No supplier linked" value={String(counts.unsupplied)} />
        </Stack>

        {groups.length === 0 && unsupplied.length === 0 ? (
          <Card>
            <CardContent>
              <Stack gap={2} align="center" className="py-12">
                <Heading level={3}>Nothing to reorder</Heading>
                <Text size="sm" variant="muted">
                  Every tracked item is above its reorder point. Set reorder points on the stock
                  grid to have low items surface here.
                </Text>
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <Link href="/inventory/stock">Go to stock</Link>
                </Button>
              </Stack>
            </CardContent>
          </Card>
        ) : (
          <ReorderBoard groups={groups} />
        )}

        {unsupplied.length > 0 ? <UnsuppliedPanel items={unsupplied} /> : null}
      </Stack>
    </Container>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="min-w-[10rem] flex-1">
      <CardContent>
        <Stack gap={1} className="py-2">
          <Text size="xs" variant="muted">
            {label}
          </Text>
          <Text size="lg">{value}</Text>
        </Stack>
      </CardContent>
    </Card>
  );
}

function UnsuppliedPanel({ items }: { items: UnsuppliedSuggestion[] }) {
  return (
    <Card>
      <CardContent>
        <Stack gap={3} className="py-2">
          <Stack direction="row" align="center" gap={2}>
            <Truck className="h-4 w-4" />
            <Heading level={3}>Low — no supplier linked</Heading>
            <Badge color="warning">{items.length}</Badge>
          </Stack>
          <Text size="sm" variant="muted">
            These items are low but have no purchasing supplier. Link one to a supplier&apos;s
            catalog and they&apos;ll become draftable reorder suggestions.
          </Text>
          <Stack gap={2}>
            {items.map((it) => (
              <Stack
                key={`${it.variantId}-${it.warehouseId}`}
                direction="row"
                align="center"
                gap={3}
                wrap
                className="rounded border border-[var(--color-border-default)] px-3 py-2"
              >
                <Stack gap={0} className="min-w-[12rem] flex-1">
                  <Text size="sm" className="font-medium">
                    {it.title ?? it.sku ?? it.variantId.slice(0, 8)}
                  </Text>
                  <Text size="xs" variant="muted" className="font-mono">
                    {it.sku ?? it.variantId} · {it.warehouseName ?? it.warehouseCode}
                  </Text>
                </Stack>
                <Text size="sm" variant="muted">
                  {it.available} / {it.reorderPoint} reorder pt
                </Text>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/inventory/suppliers?variant=${it.variantId}`}>Link supplier</Link>
                </Button>
              </Stack>
            ))}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
