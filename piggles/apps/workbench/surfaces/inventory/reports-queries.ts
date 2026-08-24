// The four queries behind the reports pane, loaded together and refreshed
// together, so the surface itself holds filters rather than plumbing.

import {
  useAgingReport,
  useInventorySummary,
  useShrinkageReport,
  useTurnoverReport,
} from './reports-data';

export interface ReportRange {
  from: string;
  to: string;
}

export type ReportQueries = ReturnType<typeof useReportQueries>;

/**
 * Shrinkage follows the SAME period picker as turnover. A losses figure over a
 * different window than the selling figure beside it is how two numbers on one
 * screen quietly stop being comparable.
 */
export function useReportQueries(range: ReportRange, locationId: string) {
  const summary = useInventorySummary();
  const turnover = useTurnoverReport(range);
  const aging = useAgingReport({ warehouseId: locationId, deadStockDays: 90 });
  const shrinkage = useShrinkageReport(range, locationId || undefined);

  const refreshAll = () => {
    void summary.refetch();
    void turnover.refetch();
    void aging.refetch();
    void shrinkage.refetch();
  };

  return {
    summary,
    turnover,
    aging,
    shrinkage,
    refreshAll,
    isFetching: summary.isFetching || turnover.isFetching || aging.isFetching,
  };
}
