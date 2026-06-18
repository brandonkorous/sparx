import { BarChart3 } from 'lucide-react';

import { Container, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { AgingPanel, ReorderAnalysisPanel, TurnoverPanel } from './_components/report-panels';
import type { AgingReport, ReorderAnalysisReport, TurnoverReport } from './_components/types';

// Inventory reports (docs/100 P6b, docs/09 §8) — the analytical lens on the
// master stock model + ledger: how fast stock turns (turnover / DIO), what's
// gone stale (aging + dead-stock), and what needs reordering with velocity +
// projected stockout. Each report exports to CSV. Inventory-module-gated.

export const dynamic = 'force-dynamic';

export default async function InventoryReportsPage() {
  const [turnover, aging, reorder] = await Promise.all([
    api.get<TurnoverReport>('/v1/inventory/reports/turnover'),
    api.get<AgingReport>('/v1/inventory/reports/aging'),
    api.get<ReorderAnalysisReport>('/v1/inventory/reports/reorder-analysis'),
  ]);

  return (
    <Container size="full">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<BarChart3 className="h-5 w-5" />}
          title="Reports"
          description="Inventory analytics over your stock and movement history — turnover, aging and dead stock, and reorder analysis. Export any report to CSV."
        />

        <TurnoverPanel report={turnover} />
        <ReorderAnalysisPanel report={reorder} />
        <AgingPanel report={aging} />
      </Stack>
    </Container>
  );
}
