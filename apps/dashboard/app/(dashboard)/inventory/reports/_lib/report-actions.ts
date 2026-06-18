'use server';

// CSV export for the inventory reports (docs/100 P6b). The api-rest analytics
// endpoints emit `text/csv` when asked with `?format=csv`; this server action
// fetches the raw response (authenticated) and hands the CSV text back to the
// client, which triggers a browser download. Server-only — the api token never
// reaches the browser.

import { api, type ApiRestError } from '@/lib/api-rest-client';
import type { ReportKind } from '../_components/types';

const PATH: Record<ReportKind, string> = {
  turnover: '/v1/inventory/reports/turnover',
  aging: '/v1/inventory/reports/aging',
  'reorder-analysis': '/v1/inventory/reports/reorder-analysis',
};

export async function exportReportCsv(
  kind: ReportKind,
  query: Record<string, string> = {}
): Promise<{ csv: string } | { error: string }> {
  try {
    const params = new URLSearchParams({ ...query, format: 'csv' }).toString();
    const res = await api.getRaw(`${PATH[kind]}?${params}`);
    if (!res.ok) {
      return { error: `Export failed (${res.status}).` };
    }
    return { csv: await res.text() };
  } catch (err) {
    return { error: (err as ApiRestError).message ?? 'Export failed.' };
  }
}
