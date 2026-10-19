// What came in against invoices, day by day, for "Billed and collected" (sparx
// persona issue 360). The report is the invoicing module's; a business without
// invoicing gets an error and the card stays away.

import { useQuery } from '@wizeworks/query';
import { api } from '../../lib/api/client';
import type { CollectedPoint } from './collected-chart-option';

export interface CollectedReport {
  range: { from: string; to: string; grain: 'day' | 'week' | 'month' };
  points: CollectedPoint[];
  totals: { billedCents: number; collectedCents: number };
  currency: string;
}

/** The days the card shows, ending today. */
export const COLLECTED_DAYS = 30;

export function collectedWindow(now: Date): { from: Date; to: Date } {
  return { from: new Date(now.getTime() - (COLLECTED_DAYS - 1) * 86_400_000), to: new Date(now) };
}

export function useCollected() {
  return useQuery({
    queryKey: ['finance', 'collected', COLLECTED_DAYS],
    queryFn: () => {
      const { from, to } = collectedWindow(new Date());
      return api.get<CollectedReport>('/v1/invoicing/reports/collected-timeseries', {
        from: from.toISOString(),
        to: to.toISOString(),
        grain: 'day',
      });
    },
    retry: false,
  });
}
